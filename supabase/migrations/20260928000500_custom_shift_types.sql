-- =====================================================================
-- 사용자 정의 근무 종류
--  - 처음 편집할 때 현재 프리셋 패턴을 "내 근무 설정" 패턴으로 복제하고 profiles.pattern_id 를 전환
--    (기존 근무 기록도 같은 코드의 복제본으로 옮겨 색상·이름 변경이 동료 화면에도 반영)
--  - 이후 코드별 추가/수정/삭제는 내 패턴에서만 수행
-- =====================================================================

-- 휴가 종류별 연차 차감 일수 (연차 1, 반차 0.5, 병가 0 ...). work/off 는 NULL
alter table public.shift_types add column if not exists leave_days numeric(3,2)
  check (leave_days is null or (leave_days >= 0 and leave_days <= 1));
update public.shift_types set leave_days = 1 where kind = 'leave' and leave_days is null;

create or replace function public.ensure_my_pattern()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_current    uuid;
  v_owner      uuid;
  v_new        uuid;
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;

  select coalesce(p.pattern_id, (select id from public.shift_patterns where slug = 'nurse-3shift'))
    into v_current from public.profiles p where p.id = v_profile_id;
  select owner_id into v_owner from public.shift_patterns where id = v_current;

  if v_owner = v_profile_id then
    return v_current;
  end if;

  insert into public.shift_patterns (owner_id, name, category, description, cycle)
  select v_profile_id, '내 근무 설정', category, '사용자 정의 (' || name || ' 기반)', cycle
  from public.shift_patterns where id = v_current
  returning id into v_new;

  insert into public.shift_types (pattern_id, code, label, kind, start_time, end_time, night_hours, bg_color, text_color, sort_order, leave_days)
  select v_new, code, label, kind, start_time, end_time, night_hours, bg_color, text_color, sort_order, leave_days
  from public.shift_types where pattern_id = v_current;

  -- 내 기존 근무 기록을 복제된 근무 종류로 이전 (코드 기준)
  update public.shift_entries e
     set shift_type_id = nt.id
    from public.shift_types ot
    join public.shift_types nt on nt.pattern_id = v_new and nt.code = ot.code
   where e.profile_id = v_profile_id
     and e.shift_type_id = ot.id
     and ot.pattern_id <> v_new;

  update public.profiles set pattern_id = v_new where id = v_profile_id;
  return v_new;
end $$;

create or replace function public.get_my_shift_types()
returns table (code text, label text, kind text, start_time time, end_time time,
               night_hours numeric, bg_color text, text_color text, sort_order smallint, leave_days numeric)
language sql stable security definer set search_path = public
as $$
  select t.code, t.label, t.kind, t.start_time, t.end_time, t.night_hours, t.bg_color, t.text_color, t.sort_order, t.leave_days
  from public.shift_types t
  where t.pattern_id = (
    select coalesce(p.pattern_id, (select id from public.shift_patterns where slug = 'nurse-3shift'))
    from public.profiles p where p.id = public.current_profile_id()
  )
  order by t.sort_order, t.code
$$;

create or replace function public.upsert_my_shift_type(
  p_code text,
  p_label text,
  p_kind text,
  p_bg text,
  p_fg text,
  p_start time default null,
  p_end time default null,
  p_night_hours numeric default 0,
  p_sort_order smallint default null,
  p_leave_days numeric default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pattern uuid := public.ensure_my_pattern();
begin
  insert into public.shift_types (pattern_id, code, label, kind, start_time, end_time, night_hours, bg_color, text_color, sort_order, leave_days)
  values (
    v_pattern, btrim(p_code), coalesce(nullif(btrim(p_label), ''), btrim(p_code)), p_kind, p_start, p_end,
    coalesce(p_night_hours, 0), p_bg, p_fg,
    coalesce(p_sort_order, (select coalesce(max(sort_order), 0) + 1 from public.shift_types where pattern_id = v_pattern)),
    case when p_kind = 'leave' then coalesce(p_leave_days, 1) end
  )
  on conflict (pattern_id, code) do update
    set label       = excluded.label,
        kind        = excluded.kind,
        start_time  = excluded.start_time,
        end_time    = excluded.end_time,
        night_hours = excluded.night_hours,
        bg_color    = excluded.bg_color,
        text_color  = excluded.text_color,
        sort_order  = coalesce(p_sort_order, public.shift_types.sort_order),
        leave_days  = excluded.leave_days;
end $$;

-- 사용 중인 근무 종류는 삭제 불가 (근무 기록 보존)
create or replace function public.delete_my_shift_type(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pattern uuid := public.ensure_my_pattern();
  v_type    uuid;
begin
  select id into v_type from public.shift_types where pattern_id = v_pattern and code = btrim(p_code);
  if v_type is null then
    return;
  end if;
  if exists (select 1 from public.shift_entries where shift_type_id = v_type) then
    raise exception '달력에 입력된 근무는 삭제할 수 없습니다. 해당 날짜의 근무를 먼저 지워 주세요.' using errcode = '23503';
  end if;
  delete from public.shift_types where id = v_type;
end $$;

revoke execute on function
  public.ensure_my_pattern(),
  public.get_my_shift_types(),
  public.upsert_my_shift_type(text, text, text, text, text, time, time, numeric, smallint, numeric),
  public.delete_my_shift_type(text)
from public, anon;
grant execute on function
  public.ensure_my_pattern(),
  public.get_my_shift_types(),
  public.upsert_my_shift_type(text, text, text, text, text, time, time, numeric, smallint, numeric),
  public.delete_my_shift_type(text)
to authenticated;
