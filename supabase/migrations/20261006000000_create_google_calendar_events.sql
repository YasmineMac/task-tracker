create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  google_calendar_row_id uuid not null references public.google_calendars(id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  google_instance_id text not null,
  title text not null,
  description text null,
  location text null,
  html_link text null,
  all_day boolean not null default false,
  start_at timestamptz null,
  end_at timestamptz null,
  start_date date null,
  end_date date null,
  timezone text null,
  status text null,
  google_updated_at timestamptz null,
  etag text null,
  recurring_event_id text null,
  original_start_at timestamptz null,
  original_start_date date null,
  raw jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_events_identity_unique unique (connection_id, google_calendar_id, google_instance_id),
  constraint google_calendar_events_raw_object_check check (jsonb_typeof(raw) = 'object'),
  constraint google_calendar_events_date_shape_check check (
    (all_day = true and start_date is not null)
    or
    (all_day = false and start_at is not null)
  ),
  constraint google_calendar_events_date_order_check check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  constraint google_calendar_events_time_order_check check (
    end_at is null or start_at is null or end_at >= start_at
  )
);

create index if not exists google_calendar_events_sync_code_idx
  on public.google_calendar_events (sync_code);

create index if not exists google_calendar_events_calendar_window_idx
  on public.google_calendar_events (sync_code, google_calendar_row_id, start_at, start_date);

create index if not exists google_calendar_events_connection_idx
  on public.google_calendar_events (connection_id);

drop trigger if exists set_google_calendar_events_updated_at on public.google_calendar_events;
create trigger set_google_calendar_events_updated_at
before update on public.google_calendar_events
for each row
execute function public.set_updated_at();

alter table public.google_calendar_events enable row level security;

drop policy if exists "google_calendar_events_select_yasmine_sync" on public.google_calendar_events;
create policy "google_calendar_events_select_yasmine_sync"
on public.google_calendar_events
for select
using (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_events_insert_yasmine_sync" on public.google_calendar_events;
create policy "google_calendar_events_insert_yasmine_sync"
on public.google_calendar_events
for insert
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_events_update_yasmine_sync" on public.google_calendar_events;
create policy "google_calendar_events_update_yasmine_sync"
on public.google_calendar_events
for update
using (sync_code = 'YAS-TEST-001')
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_events_delete_yasmine_sync" on public.google_calendar_events;
create policy "google_calendar_events_delete_yasmine_sync"
on public.google_calendar_events
for delete
using (sync_code = 'YAS-TEST-001');
