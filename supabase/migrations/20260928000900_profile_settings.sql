-- =====================================================================
-- 사용자 설정 서버 저장 (시급·연차·정산 기준·휴일수당·알림 설정 등)
--  - 새 폰에서 계정 로그인해도 설정이 그대로 복원되도록
--  - 본인만 읽기/쓰기 (RPC 전용), 최대 16KB
-- =====================================================================

alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists settings_updated_at timestamptz;

-- 설정 조회: { settings, updated_at }
create or replace function public.get_my_settings()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('settings', p.settings, 'updated_at', p.settings_updated_at)
    from public.profiles p
   where p.id = public.current_profile_id()
$$;

-- 설정 저장 (기기에서 바꾼 시각을 함께 저장해 여러 기기 중 최신 설정이 이기도록)
create or replace function public.set_my_settings(p_settings jsonb, p_updated_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_row        public.profiles;
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    raise exception 'p_settings must be a json object' using errcode = '22023';
  end if;
  if octet_length(p_settings::text) > 16384 then
    raise exception '설정이 너무 큽니다' using errcode = '22023';
  end if;

  update public.profiles
     set settings = p_settings,
         settings_updated_at = least(coalesce(p_updated_at, now()), now() + interval '5 minutes')
   where id = v_profile_id
     -- 더 최근 기기 설정을 오래된 값으로 덮어쓰지 않음
     and (settings_updated_at is null or settings_updated_at <= coalesce(p_updated_at, now()))
  returning * into v_row;

  if not found then
    select * into v_row from public.profiles where id = v_profile_id;
  end if;
  return jsonb_build_object('settings', v_row.settings, 'updated_at', v_row.settings_updated_at);
end $$;

revoke execute on function public.get_my_settings() from public, anon;
revoke execute on function public.set_my_settings(jsonb, timestamptz) from public, anon;
grant execute on function public.get_my_settings() to authenticated;
grant execute on function public.set_my_settings(jsonb, timestamptz) to authenticated;
