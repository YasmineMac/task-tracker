alter table public.time_logs
  drop constraint if exists time_logs_hours_check;

alter table public.time_logs
  alter column hours drop not null;

alter table public.time_logs
  add column if not exists end_date date null;

alter table public.time_logs
  add constraint time_logs_hours_positive_or_null
  check (hours is null or hours > 0);
