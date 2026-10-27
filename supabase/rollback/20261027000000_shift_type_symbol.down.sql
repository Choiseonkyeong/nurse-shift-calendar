-- 되돌리기: 20261027000000_shift_type_symbol.sql 적용 전 상태로
-- (입력된 표시 기호는 사라짐. 근무 코드·근무 기록은 그대로)
drop function if exists public.upsert_my_shift_type(text, text, text, text, text, time, time, numeric, smallint, numeric, text);
drop function if exists public.get_my_shift_types();

create function public.get_my_shift_types()
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

create function public.upsert_my_shift_type(
  p_code text, p_label text, p_kind text, p_bg text, p_fg text,
  p_start time default null, p_end time default null, p_night_hours numeric default 0,
  p_sort_order smallint default null, p_leave_days numeric default null
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
    set label = excluded.label, kind = excluded.kind, start_time = excluded.start_time, end_time = excluded.end_time,
        night_hours = excluded.night_hours, bg_color = excluded.bg_color, text_color = excluded.text_color,
        sort_order = coalesce(p_sort_order, public.shift_types.sort_order), leave_days = excluded.leave_days;
end $$;

revoke execute on function public.get_my_shift_types(),
  public.upsert_my_shift_type(text, text, text, text, text, time, time, numeric, smallint, numeric) from public, anon;
grant execute on function public.get_my_shift_types(),
  public.upsert_my_shift_type(text, text, text, text, text, time, time, numeric, smallint, numeric) to authenticated;

alter table public.shift_types drop column if exists symbol;
