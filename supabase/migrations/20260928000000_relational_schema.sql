-- =====================================================================
-- 교대근무 관계형 스키마 (v2)
--   profiles        : 사용자 (Supabase Auth 익명/정식 계정과 1:1, 레거시 유저는 미연결 상태)
--   shift_patterns  : 근무 패턴 세트 (간호사 3교대, 4조2교대 등). owner_id NULL = 시스템 프리셋
--   shift_types     : 패턴별 근무 코드 (D/E/N/M/OFF/연차 ...) + 시간/야간시간/색상
--   shift_entries   : 사용자 x 날짜 근무 기록 (1일 1근무)
--   groups          : 공유 그룹 (초대 코드, 테마 색상)
--   group_members   : 그룹 x 사용자
-- 모든 쓰기는 RLS 또는 SECURITY DEFINER RPC를 통해서만 허용한다.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------

create table public.shift_patterns (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,                       -- NULL = 시스템 프리셋 (FK는 profiles 생성 후 추가)
  slug        text unique,                -- 프리셋 식별자 (예: 'nurse-3shift')
  name        text not null check (char_length(name) between 1 and 50),
  category    text not null default 'general', -- nurse / firefighter / factory / general ...
  description text,
  cycle       text[],                     -- 순환 패턴 (예: {D,D,N,N,OFF,OFF}). NULL = 비순환(수기 입력)
  created_at  timestamptz not null default now()
);

create table public.shift_types (
  id           uuid primary key default gen_random_uuid(),
  pattern_id   uuid not null references public.shift_patterns(id) on delete cascade,
  code         text not null check (char_length(code) between 1 and 10),
  label        text not null,
  kind         text not null default 'work' check (kind in ('work', 'off', 'leave')),
  start_time   time,
  end_time     time,                      -- start_time 보다 작으면 익일 종료
  night_hours  numeric(4,2) not null default 0 check (night_hours >= 0),
  bg_color     text not null default '#F1F5F9' check (bg_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color   text not null default '#475569' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order   smallint not null default 0,
  unique (pattern_id, code)
);

create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null, -- NULL = 미연결 레거시 유저
  display_name  text not null check (char_length(display_name) between 1 and 30),
  pattern_id    uuid references public.shift_patterns(id) on delete set null,
  legacy_user_name text unique,          -- 레거시 group_shifts.user_name (이관 매핑/계정 연결 키)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.shift_patterns
  add constraint shift_patterns_owner_fk
  foreign key (owner_id) references public.profiles(id) on delete cascade;

create table public.shift_entries (
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  work_date     date not null,
  shift_type_id uuid not null references public.shift_types(id) on delete restrict,
  memo          text,
  updated_at    timestamptz not null default now(),
  primary key (profile_id, work_date)
);

create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  invite_code  text not null unique check (invite_code ~ '^[A-Z0-9]{1,12}$'),
  name         text not null check (char_length(name) between 1 and 50),
  color        text not null default '#6366F1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  owner_id     uuid references public.profiles(id) on delete set null, -- NULL = 소유자 불명(레거시)
  created_at   timestamptz not null default now()
);

create table public.group_members (
  group_id    uuid not null references public.groups(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create index shift_types_pattern_idx   on public.shift_types (pattern_id, sort_order);
create index shift_entries_date_idx    on public.shift_entries (work_date);
create index group_members_profile_idx on public.group_members (profile_id);
create index shift_patterns_owner_idx  on public.shift_patterns (owner_id);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch      before update on public.profiles      for each row execute function public.touch_updated_at();
create trigger shift_entries_touch before update on public.shift_entries for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 2. 프리셋 시드
-- ---------------------------------------------------------------------

insert into public.shift_patterns (slug, name, category, description, cycle) values
  ('nurse-3shift', '간호사 3교대', 'nurse',   'D/E/N 3교대 + M(미드), 수기 편성', null),
  ('4team-2shift', '4조 2교대',   'general', '주주야야비휴 (D-D-N-N-OFF-OFF)',  array['D','D','N','N','OFF','OFF']),
  ('3team-2shift', '3조 2교대',   'general', '주야비 (D-N-OFF)',               array['D','N','OFF']);

insert into public.shift_types (pattern_id, code, label, kind, start_time, end_time, night_hours, bg_color, text_color, sort_order)
select p.id, t.code, t.label, t.kind, t.start_time::time, t.end_time::time, t.night_hours, t.bg, t.fg, t.ord
from public.shift_patterns p
join (values
  ('nurse-3shift', 'D',   'Day (데이)',       'work',  '07:30', '15:30', 0,   '#FEF08A', '#854D0E', 1),
  ('nurse-3shift', 'E',   'Evening (이브닝)', 'work',  '14:30', '22:30', 0.5, '#FFEDD5', '#9A3412', 2),
  ('nurse-3shift', 'N',   'Night (나이트)',   'work',  '21:30', '08:00', 8,   '#E0F2FE', '#0369A1', 3),
  ('nurse-3shift', 'M',   'Mid (미드)',       'work',  '09:00', '17:00', 0,   '#F3E8FF', '#6B21A8', 4),
  ('nurse-3shift', 'OFF', 'OFF (휴무)',       'off',   null,    null,    0,   '#F1F5F9', '#475569', 5),
  ('nurse-3shift', '연차', '연차 (휴가)',      'leave', null,    null,    0,   '#FFE4E6', '#E11D48', 6),
  ('4team-2shift', 'D',   '주간',             'work',  '07:00', '19:00', 0,   '#FEF08A', '#854D0E', 1),
  ('4team-2shift', 'N',   '야간',             'work',  '19:00', '07:00', 8,   '#E0F2FE', '#0369A1', 2),
  ('4team-2shift', 'OFF', '비번/휴무',        'off',   null,    null,    0,   '#F1F5F9', '#475569', 3),
  ('4team-2shift', '연차', '연차',            'leave', null,    null,    0,   '#FFE4E6', '#E11D48', 4),
  ('3team-2shift', 'D',   '주간',             'work',  '09:00', '18:00', 0,   '#FEF08A', '#854D0E', 1),
  ('3team-2shift', 'N',   '야간',             'work',  '18:00', '09:00', 8,   '#E0F2FE', '#0369A1', 2),
  ('3team-2shift', 'OFF', '비번/휴무',        'off',   null,    null,    0,   '#F1F5F9', '#475569', 3),
  ('3team-2shift', '연차', '연차',            'leave', null,    null,    0,   '#FFE4E6', '#E11D48', 4)
) as t(slug, code, label, kind, start_time, end_time, night_hours, bg, fg, ord)
  on t.slug = p.slug;

-- ---------------------------------------------------------------------
-- 3. 헬퍼 함수 (RLS 재귀 방지를 위해 SECURITY DEFINER)
-- ---------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and profile_id = public.current_profile_id()
  )
$$;

create or replace function public.shares_group_with(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.profile_id = public.current_profile_id()
      and b.profile_id = p_profile_id
  )
$$;

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.shift_patterns enable row level security;
alter table public.shift_types    enable row level security;
alter table public.shift_entries  enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;

-- profiles: 본인 + 같은 그룹 멤버 조회, 본인만 수정. 생성은 RPC(ensure_profile) 전용.
create policy profiles_select on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.shares_group_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- shift_patterns / shift_types: 프리셋 + 내 패턴 조회, 내 패턴만 쓰기
create policy patterns_select on public.shift_patterns for select to authenticated
  using (owner_id is null or owner_id = public.current_profile_id());
create policy patterns_write on public.shift_patterns for all to authenticated
  using (owner_id = public.current_profile_id())
  with check (owner_id = public.current_profile_id());

create policy types_select on public.shift_types for select to authenticated
  using (exists (select 1 from public.shift_patterns p
                 where p.id = pattern_id and (p.owner_id is null or p.owner_id = public.current_profile_id())));
create policy types_write on public.shift_types for all to authenticated
  using (exists (select 1 from public.shift_patterns p
                 where p.id = pattern_id and p.owner_id = public.current_profile_id()))
  with check (exists (select 1 from public.shift_patterns p
                 where p.id = pattern_id and p.owner_id = public.current_profile_id()));

-- shift_entries: 본인 것만 직접 접근. 동료 근무는 get_group_schedule RPC로만 노출.
create policy entries_own on public.shift_entries for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- groups: 멤버만 조회/색상 수정. 삭제는 소유자(레거시 그룹은 멤버 누구나). 생성/입장은 RPC 전용.
create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_member(id)) with check (public.is_group_member(id));
create policy groups_delete on public.groups for delete to authenticated
  using (owner_id = public.current_profile_id()
         or (owner_id is null and public.is_group_member(id)));

-- group_members: 같은 그룹 멤버 목록 조회, 본인 탈퇴만 허용.
create policy members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy members_leave on public.group_members for delete to authenticated
  using (profile_id = public.current_profile_id());

-- 컬럼 단위 권한: groups는 name/color만, profiles는 display_name/pattern_id만 수정 가능
revoke update on public.groups   from authenticated;
revoke update on public.profiles from authenticated;
grant  update (name, color)                on public.groups   to authenticated;
grant  update (display_name, pattern_id)   on public.profiles to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- 5. RPC
-- ---------------------------------------------------------------------

-- 로그인 직후 호출: 내 프로필 반환(없으면 생성).
-- p_claim_legacy = true 이면 같은 이름의 미연결 레거시 프로필을 내 계정에 연결한다.
create or replace function public.ensure_profile(p_display_name text, p_claim_legacy boolean default false)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text := nullif(btrim(p_display_name), '');
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where auth_user_id = v_uid;
  if found then
    return v_profile;
  end if;

  if v_name is null then
    raise exception 'display_name required' using errcode = '22023';
  end if;

  if p_claim_legacy then
    update public.profiles
       set auth_user_id = v_uid
     where id = (select id from public.profiles
                  where auth_user_id is null and legacy_user_name = v_name
                  order by created_at limit 1
                  for update skip locked)
    returning * into v_profile;
    if found then
      return v_profile;
    end if;
  end if;

  insert into public.profiles (auth_user_id, display_name, pattern_id)
  values (v_uid, v_name, (select id from public.shift_patterns where slug = 'nurse-3shift'))
  returning * into v_profile;
  return v_profile;
end $$;

-- 내 근무 조회: {date, code}
create or replace function public.get_my_shifts(p_from date default null, p_to date default null)
returns table (work_date date, code text)
language sql stable security definer set search_path = public
as $$
  select e.work_date, t.code
  from public.shift_entries e
  join public.shift_types t on t.id = e.shift_type_id
  where e.profile_id = public.current_profile_id()
    and (p_from is null or e.work_date >= p_from)
    and (p_to   is null or e.work_date <= p_to)
  order by e.work_date
$$;

-- 내 근무 일괄 저장: {"2026-09-01": "D", "2026-09-02": null(삭제)}
-- 코드는 내 활성 패턴에서 해석. 모르는 코드는 건너뛰고 skipped 로 반환.
create or replace function public.set_my_shifts(p_changes jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_pattern_id uuid;
  v_key        text;
  v_code       text;
  v_type_id    uuid;
  v_upserted   int := 0;
  v_deleted    int := 0;
  v_skipped    jsonb := '[]'::jsonb;
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;
  if jsonb_typeof(p_changes) <> 'object' then
    raise exception 'p_changes must be a json object' using errcode = '22023';
  end if;

  select coalesce(pattern_id, (select id from public.shift_patterns where slug = 'nurse-3shift'))
    into v_pattern_id
    from public.profiles where id = v_profile_id;

  for v_key, v_code in select key, nullif(btrim(value #>> '{}'), '') from jsonb_each(p_changes)
  loop
    if v_key !~ '^\d{4}-\d{2}-\d{2}$' then
      v_skipped := v_skipped || to_jsonb(v_key);
      continue;
    end if;

    if v_code is null then
      delete from public.shift_entries where profile_id = v_profile_id and work_date = v_key::date;
      if found then v_deleted := v_deleted + 1; end if;
      continue;
    end if;

    select id into v_type_id from public.shift_types
     where pattern_id = v_pattern_id and upper(code) = upper(v_code);
    if v_type_id is null then
      v_skipped := v_skipped || to_jsonb(v_key);
      continue;
    end if;

    insert into public.shift_entries (profile_id, work_date, shift_type_id)
    values (v_profile_id, v_key::date, v_type_id)
    on conflict (profile_id, work_date)
      do update set shift_type_id = excluded.shift_type_id
      where public.shift_entries.shift_type_id is distinct from excluded.shift_type_id;
    v_upserted := v_upserted + 1;
  end loop;

  return jsonb_build_object('upserted', v_upserted, 'deleted', v_deleted, 'skipped', v_skipped);
end $$;

-- 순환 패턴 자동 편성: p_from ~ p_to 구간에 cycle 을 p_offset 부터 채움 (기존 기록 덮어씀)
create or replace function public.apply_pattern_cycle(p_pattern_id uuid, p_from date, p_to date, p_offset int default 0)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_cycle      text[];
  v_count      int;
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  select cycle into v_cycle from public.shift_patterns
   where id = p_pattern_id and (owner_id is null or owner_id = v_profile_id);
  if v_cycle is null or cardinality(v_cycle) = 0 then
    raise exception 'pattern has no cycle' using errcode = '22023';
  end if;

  insert into public.shift_entries (profile_id, work_date, shift_type_id)
  select v_profile_id, d::date, t.id
  from generate_series(p_from, p_to, interval '1 day') with ordinality as g(d, i)
  join public.shift_types t
    on t.pattern_id = p_pattern_id
   and t.code = v_cycle[1 + ((((i::int - 1 + p_offset) % cardinality(v_cycle)) + cardinality(v_cycle)) % cardinality(v_cycle))]
  on conflict (profile_id, work_date) do update set shift_type_id = excluded.shift_type_id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 초대 코드 생성 (혼동 문자 0/O/1/I 제외)
create or replace function public.generate_invite_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code  text;
begin
  loop
    select string_agg(substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.groups where invite_code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public.create_group(p_name text, p_color text default '#6366F1')
returns public.groups
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_group      public.groups;
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;

  insert into public.groups (invite_code, name, color, owner_id)
  values (public.generate_invite_code(), btrim(p_name), coalesce(p_color, '#6366F1'), v_profile_id)
  returning * into v_group;

  insert into public.group_members (group_id, profile_id) values (v_group.id, v_profile_id);
  return v_group;
end $$;

create or replace function public.join_group(p_invite_code text)
returns public.groups
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_group      public.groups;
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;

  select * into v_group from public.groups where invite_code = upper(btrim(p_invite_code));
  if not found then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  insert into public.group_members (group_id, profile_id)
  values (v_group.id, v_profile_id)
  on conflict do nothing;
  return v_group;
end $$;

-- 내 그룹 목록 + 멤버 (한 번에)
create or replace function public.get_my_groups()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(g_json order by g_created), '[]'::jsonb)
  from (
    select g.created_at as g_created,
           jsonb_build_object(
             'id', g.id,
             'code', g.invite_code,
             'name', g.name,
             'color', g.color,
             'is_owner', coalesce(g.owner_id = public.current_profile_id(), false),
             'can_delete', coalesce(g.owner_id = public.current_profile_id(), g.owner_id is null),
             'members', (
               select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by m.joined_at, p.display_name)
               from public.group_members m join public.profiles p on p.id = m.profile_id
               where m.group_id = g.id
             )
           ) as g_json
    from public.groups g
    where public.is_group_member(g.id)
  ) s
$$;

-- 그룹 근무표 조회 (멤버만 가능)
create or replace function public.get_group_schedule(p_group_id uuid, p_from date, p_to date)
returns table (profile_id uuid, work_date date, code text, bg_color text, text_color text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 93 then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  return query
  select e.profile_id, e.work_date, t.code, t.bg_color, t.text_color
  from public.group_members m
  join public.shift_entries e on e.profile_id = m.profile_id
  join public.shift_types   t on t.id = e.shift_type_id
  where m.group_id = p_group_id
    and e.work_date between p_from and p_to;
end $$;

-- RPC 실행 권한: 로그인 사용자(익명 로그인 포함)만
revoke execute on all functions in schema public from public, anon;
grant  execute on function
  public.ensure_profile(text, boolean),
  public.get_my_shifts(date, date),
  public.set_my_shifts(jsonb),
  public.apply_pattern_cycle(uuid, date, date, int),
  public.create_group(text, text),
  public.join_group(text),
  public.get_my_groups(),
  public.get_group_schedule(uuid, date, date),
  public.current_profile_id(),
  public.is_group_member(uuid),
  public.shares_group_with(uuid)
to authenticated;
