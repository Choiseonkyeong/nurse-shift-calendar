-- =====================================================================
-- 근무 교환 요청 (그룹 멤버 간)
--  - 요청자: 날짜 1~2개를 골라 상대에게 교환 요청
--  - 상대방이 수락하면 서버에서 두 사람의 해당 날짜 근무를 한 번에 맞바꿈 (원자적)
--  - 요청 이후 둘 중 누구든 해당 날짜 근무가 바뀌었으면 수락 불가(stale)
-- =====================================================================

create table if not exists public.shift_swaps (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups(id) on delete cascade,
  requester_id   uuid not null references public.profiles(id) on delete cascade,
  target_id      uuid not null references public.profiles(id) on delete cascade,
  dates          date[] not null check (cardinality(dates) between 1 and 2),
  -- 요청 시점 근무 스냅샷: {"2026-10-01": {"requester": "D", "target": "N"}}
  snapshot       jsonb not null,
  message        text check (message is null or char_length(message) <= 200),
  status         text not null default 'pending'
                   check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  check (requester_id <> target_id)
);

create index if not exists shift_swaps_group_idx on public.shift_swaps (group_id, created_at desc);
create index if not exists shift_swaps_target_idx on public.shift_swaps (target_id, status);

alter table public.shift_swaps enable row level security;

-- 조회: 같은 그룹 멤버. 생성/변경은 RPC 전용
drop policy if exists shift_swaps_select on public.shift_swaps;
create policy shift_swaps_select on public.shift_swaps for select to authenticated
  using (public.is_group_member(group_id));

revoke all on public.shift_swaps from anon;
revoke insert, update, delete on public.shift_swaps from authenticated;
grant select on public.shift_swaps to authenticated;

-- 특정 사람의 특정 날짜 근무 코드 (없으면 NULL)
create or replace function public.shift_code_of(p_profile_id uuid, p_date date)
returns text
language sql stable security definer set search_path = public
as $$
  select t.code
    from public.shift_entries e
    join public.shift_types t on t.id = e.shift_type_id
   where e.profile_id = p_profile_id and e.work_date = p_date
$$;

-- 교환 요청 생성
create or replace function public.create_shift_swap(
  p_group_id uuid,
  p_target_id uuid,
  p_dates date[],
  p_message text default null
)
returns public.shift_swaps
language plpgsql security definer set search_path = public
as $$
declare
  v_me       uuid := public.current_profile_id();
  v_dates    date[];
  v_snapshot jsonb := '{}'::jsonb;
  v_date     date;
  v_row      public.shift_swaps;
begin
  if v_me is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;
  if v_me = p_target_id then
    raise exception '자기 자신과는 교환할 수 없습니다' using errcode = '22023';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and profile_id = v_me)
     or not exists (select 1 from public.group_members where group_id = p_group_id and profile_id = p_target_id) then
    raise exception '같은 그룹 멤버끼리만 교환할 수 있습니다' using errcode = '42501';
  end if;

  select array_agg(distinct d order by d) into v_dates from unnest(p_dates) d where d is not null;
  if v_dates is null or cardinality(v_dates) not between 1 and 2 then
    raise exception '교환할 날짜는 1~2개입니다' using errcode = '22023';
  end if;

  foreach v_date in array v_dates loop
    v_snapshot := v_snapshot || jsonb_build_object(
      v_date::text,
      jsonb_build_object('requester', public.shift_code_of(v_me, v_date),
                         'target', public.shift_code_of(p_target_id, v_date))
    );
  end loop;

  -- 맞바꿔도 달라지는 게 없으면 거절
  if not exists (
    select 1 from jsonb_each(v_snapshot) s
     where (s.value->>'requester') is distinct from (s.value->>'target')
  ) then
    raise exception '두 사람의 근무가 같아 교환할 내용이 없습니다' using errcode = '22023';
  end if;

  insert into public.shift_swaps (group_id, requester_id, target_id, dates, snapshot, message)
  values (p_group_id, v_me, p_target_id, v_dates, v_snapshot, nullif(btrim(p_message), ''))
  returning * into v_row;
  return v_row;
end $$;

-- 한 사람의 한 날짜 근무를 코드로 설정 (코드가 그 사람 근무 종류에 없으면 오류)
create or replace function public.set_shift_code_for(p_profile_id uuid, p_date date, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_pattern_id uuid;
  v_type_id    uuid;
begin
  if p_code is null then
    delete from public.shift_entries where profile_id = p_profile_id and work_date = p_date;
    return;
  end if;
  select coalesce(pattern_id, (select id from public.shift_patterns where slug = 'nurse-3shift'))
    into v_pattern_id from public.profiles where id = p_profile_id;
  select id into v_type_id from public.shift_types
   where pattern_id = v_pattern_id and upper(code) = upper(p_code);
  if v_type_id is null then
    raise exception '근무 종류 "%" 가 상대방 근무 종류에 없습니다', p_code using errcode = '22023';
  end if;
  insert into public.shift_entries (profile_id, work_date, shift_type_id)
  values (p_profile_id, p_date, v_type_id)
  on conflict (profile_id, work_date) do update set shift_type_id = excluded.shift_type_id;
end $$;

-- 수락/거절(상대방) · 취소(요청자)
create or replace function public.respond_shift_swap(p_swap_id uuid, p_action text)
returns public.shift_swaps
language plpgsql security definer set search_path = public
as $$
declare
  v_me   uuid := public.current_profile_id();
  v_swap public.shift_swaps;
  v_date date;
  v_snap jsonb;
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;
  if not found then
    raise exception '교환 요청을 찾을 수 없습니다' using errcode = 'P0002';
  end if;
  if v_swap.status <> 'pending' then
    raise exception '이미 처리된 요청입니다' using errcode = '22023';
  end if;

  if p_action = 'cancel' then
    if v_me <> v_swap.requester_id then
      raise exception '요청한 사람만 취소할 수 있습니다' using errcode = '42501';
    end if;
    update public.shift_swaps set status = 'cancelled', decided_at = now() where id = p_swap_id returning * into v_swap;
    return v_swap;
  end if;

  if v_me <> v_swap.target_id then
    raise exception '요청받은 사람만 응답할 수 있습니다' using errcode = '42501';
  end if;

  if p_action = 'decline' then
    update public.shift_swaps set status = 'declined', decided_at = now() where id = p_swap_id returning * into v_swap;
    return v_swap;
  end if;

  if p_action <> 'accept' then
    raise exception 'unknown action' using errcode = '22023';
  end if;

  -- 요청 이후 근무가 바뀌었으면 수락 불가
  foreach v_date in array v_swap.dates loop
    v_snap := v_swap.snapshot -> v_date::text;
    if public.shift_code_of(v_swap.requester_id, v_date) is distinct from (v_snap->>'requester')
       or public.shift_code_of(v_swap.target_id, v_date) is distinct from (v_snap->>'target') then
      raise exception '요청 이후 근무가 바뀌어 교환할 수 없습니다. 새로 요청해 주세요' using errcode = '40001';
    end if;
  end loop;

  foreach v_date in array v_swap.dates loop
    v_snap := v_swap.snapshot -> v_date::text;
    perform public.set_shift_code_for(v_swap.requester_id, v_date, v_snap->>'target');
    perform public.set_shift_code_for(v_swap.target_id, v_date, v_snap->>'requester');
  end loop;

  update public.shift_swaps set status = 'accepted', decided_at = now() where id = p_swap_id returning * into v_swap;
  return v_swap;
end $$;

revoke execute on function public.shift_code_of(uuid, date) from public, anon, authenticated;
revoke execute on function public.set_shift_code_for(uuid, date, text) from public, anon, authenticated;
revoke execute on function public.create_shift_swap(uuid, uuid, date[], text) from public, anon;
revoke execute on function public.respond_shift_swap(uuid, text) from public, anon;
grant execute on function public.create_shift_swap(uuid, uuid, date[], text) to authenticated;
grant execute on function public.respond_shift_swap(uuid, text) to authenticated;
