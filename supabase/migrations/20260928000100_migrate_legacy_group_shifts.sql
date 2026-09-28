-- =====================================================================
-- 레거시 group_shifts(1유저-1행 JSONB) → v2 관계형 스키마 이관
--  - user_name 별로 미연결 profiles 생성 (auth_user_id NULL)
--    → 앱 최초 실행 시 ensure_profile(name, claim_legacy => true) 로 본인 계정에 연결
--  - 같은 유저가 여러 그룹에 중복 저장한 날짜는 먼저 읽힌 값 1개만 유지
--  - 레거시 그룹은 소유자 정보가 없으므로 owner_id NULL (멤버 누구나 삭제 가능)
--  - group_shifts 테이블은 롤백 대비로 보존 (구버전 클라이언트 전환 완료 후 별도 마이그레이션에서 DROP)
-- 재실행해도 중복 생성되지 않는다.
-- =====================================================================

create or replace function pg_temp.safe_date(p text) returns date
language plpgsql immutable as $f$
begin
  return case when p ~ '^\d{4}-\d{2}-\d{2}$' then p::date end;
exception when others then
  return null;
end $f$;

do $$
declare
  v_pattern_id uuid;
begin
  if to_regclass('public.group_shifts') is null then
    raise notice 'group_shifts not found, skip legacy migration';
    return;
  end if;

  select id into v_pattern_id from public.shift_patterns where slug = 'nurse-3shift';

  -- 1) 프로필
  insert into public.profiles (display_name, legacy_user_name, pattern_id)
  select distinct left(btrim(gs.user_name), 30), btrim(gs.user_name), v_pattern_id
  from public.group_shifts gs
  where nullif(btrim(gs.user_name), '') is not null
  on conflict (legacy_user_name) do nothing;

  -- 2) 그룹
  insert into public.groups (invite_code, name, color)
  select upper(btrim(gs.group_code)),
         min(gs.group_name),
         coalesce(max(gs.color) filter (where gs.color ~ '^#[0-9A-Fa-f]{6}$'), '#6366F1')
  from public.group_shifts gs
  where upper(btrim(gs.group_code)) ~ '^[A-Z0-9]{1,12}$'
    and nullif(btrim(gs.group_name), '') is not null
  group by upper(btrim(gs.group_code))
  on conflict (invite_code) do nothing;

  -- 3) 그룹 멤버
  insert into public.group_members (group_id, profile_id)
  select distinct g.id, p.id
  from public.group_shifts gs
  join public.groups   g on g.invite_code = upper(btrim(gs.group_code))
  join public.profiles p on p.legacy_user_name = btrim(gs.user_name)
  on conflict do nothing;

  -- 4) 근무 기록 (JSONB 펼치기)
  insert into public.shift_entries (profile_id, work_date, shift_type_id)
  select distinct on (p.id, pg_temp.safe_date(kv.key)) p.id, pg_temp.safe_date(kv.key), t.id
  from public.group_shifts gs
  join public.profiles p on p.legacy_user_name = btrim(gs.user_name)
  cross join lateral jsonb_each_text(
    case jsonb_typeof(gs.shifts::jsonb)
      when 'object' then gs.shifts::jsonb
      when 'string' then coalesce(nullif(gs.shifts::jsonb #>> '{}', ''), '{}')::jsonb  -- 문자열로 이중 저장된 JSON
      else '{}'::jsonb
    end
  ) as kv(key, value)
  join public.shift_types t
    on t.pattern_id = v_pattern_id and upper(t.code) = upper(btrim(kv.value))
  where pg_temp.safe_date(kv.key) is not null
  order by p.id, pg_temp.safe_date(kv.key), gs.id
  on conflict (profile_id, work_date) do nothing;
end $$;
