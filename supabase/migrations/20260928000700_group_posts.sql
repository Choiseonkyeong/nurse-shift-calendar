-- =====================================================================
-- 그룹 게시판 (그룹 멤버 전용 비공개 게시판)
--  - 조회/작성: 해당 그룹 멤버만
--  - 삭제: 작성자 본인만
-- =====================================================================

create table if not exists public.group_posts (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists group_posts_group_idx on public.group_posts (group_id, created_at desc);

alter table public.group_posts enable row level security;

drop policy if exists group_posts_select on public.group_posts;
create policy group_posts_select on public.group_posts for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists group_posts_insert on public.group_posts;
create policy group_posts_insert on public.group_posts for insert to authenticated
  with check (author_id = public.current_profile_id() and public.is_group_member(group_id));

drop policy if exists group_posts_delete on public.group_posts;
create policy group_posts_delete on public.group_posts for delete to authenticated
  using (author_id = public.current_profile_id());

revoke all on public.group_posts from anon;
revoke update on public.group_posts from authenticated;
grant select, insert, delete on public.group_posts to authenticated;
