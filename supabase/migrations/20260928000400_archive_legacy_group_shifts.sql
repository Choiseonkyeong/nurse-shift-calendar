-- =====================================================================
-- 레거시 group_shifts 보관 처리
--  - v2 이관(…000100) 완료 후 구버전 클라이언트 접근이 모두 끊겼으므로 테이블을 백업 이름으로 변경
--  - 데이터는 그대로 보존 (되돌리기: alter table public.group_shifts_legacy_backup rename to group_shifts;)
--  - 앱/RPC 는 이 테이블을 사용하지 않으며, 클라이언트(anon/authenticated) 접근을 완전히 차단
-- 재실행해도 안전하다.
-- =====================================================================

do $$
begin
  if to_regclass('public.group_shifts') is not null
     and to_regclass('public.group_shifts_legacy_backup') is null then
    alter table public.group_shifts rename to group_shifts_legacy_backup;
  end if;

  if to_regclass('public.group_shifts_legacy_backup') is not null then
    alter table public.group_shifts_legacy_backup enable row level security;
    revoke all on public.group_shifts_legacy_backup from anon, authenticated;
    comment on table public.group_shifts_legacy_backup is
      'v1 레거시 데이터 백업 (2026-09-28 v2 관계형 스키마로 이관 완료). 앱에서 사용하지 않음.';
  end if;
end $$;
