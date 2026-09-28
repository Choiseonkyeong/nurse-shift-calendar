-- =====================================================================
-- 날짜별 개인 메모 (본인만 조회/수정, 그룹 동료에게 공개하지 않음)
-- =====================================================================

create table if not exists public.day_notes (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  note_date   date not null,
  body        text not null check (char_length(body) between 1 and 500),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, note_date)
);

alter table public.day_notes enable row level security;

drop policy if exists day_notes_own on public.day_notes;
create policy day_notes_own on public.day_notes for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes
  for each row execute function public.touch_updated_at();

revoke all on public.day_notes from anon;
grant select, insert, update, delete on public.day_notes to authenticated;
