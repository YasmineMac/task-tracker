alter table public.time_logs
  add column if not exists paused_at timestamptz null,
  add column if not exists paused_seconds numeric not null default 0;

alter table public.time_logs
  add constraint time_logs_paused_seconds_valid
  check (paused_seconds >= 0 and paused_seconds < 'Infinity'::numeric);

alter table public.time_logs
  add constraint time_logs_paused_at_valid
  check (paused_at is null or (isfinite(paused_at) and hours is null and end_time is null));
