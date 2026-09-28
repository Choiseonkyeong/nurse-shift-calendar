-- =====================================================================
-- 계정 삭제 (앱스토어 5.1.1(v) / 구글 플레이 계정 삭제 정책)
--  - 본인 계정과 모든 데이터 삭제: 근무·메모·근무 종류·설정·그룹 멤버십·게시글·교환 요청·알림 토큰
--  - 내가 만든 그룹은 다른 멤버가 있으면 남기고(소유자 없음), 아무도 없으면 삭제
--  - 로그인 계정(auth.users)까지 삭제
-- =====================================================================

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

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
