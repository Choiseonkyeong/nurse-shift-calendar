-- =====================================================================
-- 백그라운드 푸시 알림 (FCM)
--   device_tokens          : 기기별 FCM 토큰 (한 기기 = 한 토큰, 로그인 사용자 변경 시 재할당)
--   notification_settings  : 근무 시작 알림 on/off, 몇 분 전, 사용자 시간대
--   profile_shift_times    : 사용자별 근무 시작 시각 (패턴 기본값 덮어쓰기, 수당 탭 설정과 동기화)
--   notification_log       : 발송 이력 (중복 발송 방지 키)
-- 발송 흐름: pg_cron(5분) → Edge Function send-shift-reminders
--           → claim_due_shift_reminders() 로 대상 선점 → FCM HTTP v1 발송
-- =====================================================================

create table public.device_tokens (
  token       text primary key check (char_length(token) between 20 and 4096),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  platform    text not null check (platform in ('android', 'ios', 'web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index device_tokens_profile_idx on public.device_tokens (profile_id);

create table public.notification_settings (
  profile_id              uuid primary key references public.profiles(id) on delete cascade,
  shift_reminder_enabled  boolean not null default false,
  reminder_minutes        smallint not null default 60 check (reminder_minutes between 5 and 720),
  timezone                text not null default 'Asia/Seoul',
  updated_at              timestamptz not null default now()
);

create table public.profile_shift_times (
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  shift_type_id  uuid not null references public.shift_types(id) on delete cascade,
  start_time     time not null,
  primary key (profile_id, shift_type_id)
);

create table public.notification_log (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  work_date   date not null,
  kind        text not null,
  sent_at     timestamptz not null default now(),
  primary key (profile_id, work_date, kind)
);
create index notification_log_sent_idx on public.notification_log (sent_at);

-- 알림 대상 조회용 인덱스 (활성 사용자만)
create index notification_settings_enabled_idx
  on public.notification_settings (profile_id) where shift_reminder_enabled;

create trigger device_tokens_touch         before update on public.device_tokens         for each row execute function public.touch_updated_at();
create trigger notification_settings_touch before update on public.notification_settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS: 본인 설정 조회만 직접 허용, 쓰기는 RPC 전용. 토큰/로그는 클라이언트 접근 불가.
-- ---------------------------------------------------------------------
alter table public.device_tokens         enable row level security;
alter table public.notification_settings enable row level security;
alter table public.profile_shift_times   enable row level security;
alter table public.notification_log      enable row level security;

create policy notif_settings_select on public.notification_settings for select to authenticated
  using (profile_id = public.current_profile_id());
create policy shift_times_select on public.profile_shift_times for select to authenticated
  using (profile_id = public.current_profile_id());

revoke all on public.device_tokens, public.notification_log from anon, authenticated;
revoke insert, update, delete on public.notification_settings, public.profile_shift_times from anon, authenticated;
revoke all on public.notification_settings, public.profile_shift_times from anon;

-- ---------------------------------------------------------------------
-- 클라이언트 RPC
-- ---------------------------------------------------------------------

-- 기기 토큰 등록 (같은 기기에서 다른 계정으로 로그인하면 토큰 소유자 이전)
create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;

  insert into public.device_tokens (token, profile_id, platform)
  values (btrim(p_token), v_profile_id, p_platform)
  on conflict (token) do update
    set profile_id = excluded.profile_id,
        platform   = excluded.platform,
        updated_at = now();
end $$;

create or replace function public.unregister_device_token(p_token text)
returns void
language sql security definer set search_path = public
as $$
  delete from public.device_tokens
  where token = btrim(p_token) and profile_id = public.current_profile_id()
$$;

-- 알림 설정 저장. p_start_times: {"D": "07:30", "E": "14:30"} (내 패턴 코드 기준, 생략 시 기존 값 유지)
create or replace function public.set_notification_settings(
  p_enabled boolean,
  p_minutes int,
  p_timezone text default 'Asia/Seoul',
  p_start_times jsonb default null
)
returns public.notification_settings
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_pattern_id uuid;
  v_row        public.notification_settings;
begin
  if v_profile_id is null then
    raise exception 'profile not found' using errcode = '28000';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid timezone: %', p_timezone using errcode = '22023';
  end if;

  insert into public.notification_settings (profile_id, shift_reminder_enabled, reminder_minutes, timezone)
  values (v_profile_id, p_enabled, p_minutes, p_timezone)
  on conflict (profile_id) do update
    set shift_reminder_enabled = excluded.shift_reminder_enabled,
        reminder_minutes       = excluded.reminder_minutes,
        timezone               = excluded.timezone
  returning * into v_row;

  if p_start_times is not null and jsonb_typeof(p_start_times) = 'object' then
    select coalesce(pattern_id, (select id from public.shift_patterns where slug = 'nurse-3shift'))
      into v_pattern_id from public.profiles where id = v_profile_id;

    insert into public.profile_shift_times (profile_id, shift_type_id, start_time)
    select v_profile_id, t.id, kv.value::time
    from jsonb_each_text(p_start_times) kv
    join public.shift_types t on t.pattern_id = v_pattern_id and upper(t.code) = upper(kv.key)
    where t.kind = 'work' and kv.value ~ '^([01]?\d|2[0-3]):[0-5]\d$'
    on conflict (profile_id, shift_type_id) do update set start_time = excluded.start_time;
  end if;

  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- 서버(Edge Function, service_role) 전용
-- ---------------------------------------------------------------------

-- 지금 발송해야 할 근무 시작 알림을 notification_log 에 선점(insert)하고 반환.
-- 동시에 여러 번 호출돼도 PK 충돌로 1회만 반환된다. p_lookback 만큼 지연된 cron 실행도 보정.
create or replace function public.claim_due_shift_reminders(
  p_now timestamptz default now(),
  p_lookback interval default interval '15 minutes'
)
returns table (
  profile_id       uuid,
  display_name     text,
  work_date        date,
  code             text,
  label            text,
  start_time       time,
  reminder_minutes smallint,
  tokens           text[]
)
language sql volatile security definer set search_path = public
as $$
  with due as (
    select e.profile_id, e.work_date, t.code, t.label,
           coalesce(o.start_time, t.start_time) as start_time,
           s.reminder_minutes,
           ((e.work_date + coalesce(o.start_time, t.start_time)) at time zone s.timezone)
             - make_interval(mins => s.reminder_minutes) as remind_at
    from public.notification_settings s
    join public.shift_entries e
      on e.profile_id = s.profile_id
     and e.work_date between (p_now at time zone s.timezone)::date - 1
                         and (p_now at time zone s.timezone)::date + 1
    join public.shift_types t on t.id = e.shift_type_id and t.kind = 'work'
    left join public.profile_shift_times o
      on o.profile_id = e.profile_id and o.shift_type_id = t.id
    where s.shift_reminder_enabled
      and coalesce(o.start_time, t.start_time) is not null
  ),
  claimed as (
    insert into public.notification_log (profile_id, work_date, kind)
    select d.profile_id, d.work_date, 'shift_start'
    from due d
    where d.remind_at <= p_now
      and d.remind_at >  p_now - p_lookback
      and exists (select 1 from public.device_tokens dt where dt.profile_id = d.profile_id)
    on conflict do nothing
    returning notification_log.profile_id, notification_log.work_date
  )
  select d.profile_id, p.display_name, d.work_date, d.code, d.label, d.start_time, d.reminder_minutes,
         (select array_agg(dt.token) from public.device_tokens dt where dt.profile_id = d.profile_id)
  from claimed c
  join due d on d.profile_id = c.profile_id and d.work_date = c.work_date
  join public.profiles p on p.id = d.profile_id
$$;

revoke execute on function public.claim_due_shift_reminders(timestamptz, interval) from public, anon, authenticated;
grant  execute on function public.claim_due_shift_reminders(timestamptz, interval) to service_role;

revoke execute on function
  public.register_device_token(text, text),
  public.unregister_device_token(text),
  public.set_notification_settings(boolean, int, text, jsonb)
from public, anon;
grant execute on function
  public.register_device_token(text, text),
  public.unregister_device_token(text),
  public.set_notification_settings(boolean, int, text, jsonb)
to authenticated;
