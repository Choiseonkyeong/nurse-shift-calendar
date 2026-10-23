-- =====================================================================
-- 보안 수정 (2026-10-23)
--  1) ensure_profile: 이름만으로 미연결 레거시 프로필을 내 계정에 연결하던 기능 차단
--     - 이름은 본인 확인 수단이 아님 (동료 이름을 넣으면 그 사람 근무·그룹을 가져갈 수 있었음)
--     - 함수 시그니처는 그대로 두어 구버전 앱 호환 (p_claim_legacy 는 무시)
--     - 미연결 레거시 프로필·데이터는 삭제하지 않고 보존 (관리자가 확인 후 수동 연결)
--  2) delete_my_account: 내가 만든 그룹은 남은 멤버 중 가장 먼저 들어온 사람에게 소유권 이전
--     - 예전엔 owner_id 가 NULL(레거시 취급)이 되어 남은 멤버 누구나 그룹을 지울 수 있었음
--     - 남은 멤버가 없으면 그룹 삭제 (기존 동작 유지)
-- 재실행해도 안전하다.
-- =====================================================================

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

  -- p_claim_legacy 는 보안상 무시: 이름 기반 레거시 연결은 하지 않고 항상 새 프로필 생성
  insert into public.profiles (auth_user_id, display_name, pattern_id)
  values (v_uid, v_name, (select id from public.shift_patterns where slug = 'nurse-3shift'))
  returning * into v_profile;
  return v_profile;
end $$;

create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_profile_id uuid := public.current_profile_id();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_profile_id is not null then
    -- 내가 소유한 그룹: 나 말고 남은 멤버 중 가장 먼저 들어온 사람에게 소유권 이전
    -- (남은 멤버가 없으면 그대로 두고 아래에서 빈 그룹으로 삭제)
    update public.groups g
       set owner_id = (
         select m.profile_id
           from public.group_members m
          where m.group_id = g.id and m.profile_id <> v_profile_id
          order by m.joined_at, m.profile_id
          limit 1
       )
     where g.owner_id = v_profile_id
       and exists (select 1 from public.group_members m
                    where m.group_id = g.id and m.profile_id <> v_profile_id);

    -- 근무 기록을 먼저 지움 (근무 종류 삭제 제약 때문)
    delete from public.shift_entries where profile_id = v_profile_id;
    -- 프로필 삭제 → 메모·멤버십·게시글·교환 요청·알림 토큰·설정·내 근무 종류는 연쇄 삭제
    delete from public.profiles where id = v_profile_id;
    -- 멤버가 한 명도 남지 않은 그룹 정리
    delete from public.groups g
     where not exists (select 1 from public.group_members m where m.group_id = g.id);
  end if;

  delete from auth.users where id = v_uid;
end $$;

revoke execute on function public.ensure_profile(text, boolean) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.ensure_profile(text, boolean) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
