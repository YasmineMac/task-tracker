create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  event_type text not null,
  title text not null,
  description text null,
  all_day boolean not null default false,
  start_at timestamptz null,
  end_at timestamptz null,
  start_date date null,
  end_date date null,
  timezone text not null default 'Europe/Madrid',
  task_id uuid null references public.tasks(id) on delete set null,
  category_id text null,
  location text null,
  video_url text null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  recurrence_rule text null,
  recurrence_parent_id uuid null references public.calendar_events(id) on delete cascade,
  recurrence_exception_date date null,
  recurrence_status text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_event_type_check check (
    event_type in ('work', 'class', 'meeting', 'deadline', 'milestone', 'personal', 'travel')
  ),
  constraint calendar_events_recurrence_status_check check (
    recurrence_status is null or recurrence_status in ('active', 'cancelled', 'moved')
  ),
  constraint calendar_events_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint calendar_events_date_shape_check check (
    (all_day = true and start_date is not null)
    or
    (all_day = false and start_at is not null)
  ),
  constraint calendar_events_date_order_check check (
    end_date is null or start_date is null or end_date >= start_date
  ),
  constraint calendar_events_time_order_check check (
    end_at is null or start_at is null or end_at >= start_at
  )
);

create index if not exists calendar_events_sync_code_start_at_idx
  on public.calendar_events (sync_code, start_at);

create index if not exists calendar_events_sync_code_start_date_idx
  on public.calendar_events (sync_code, start_date);

create index if not exists calendar_events_task_id_idx
  on public.calendar_events (task_id);

create index if not exists calendar_events_recurrence_parent_id_idx
  on public.calendar_events (recurrence_parent_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row
execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select_yasmine_sync" on public.calendar_events;
create policy "calendar_events_select_yasmine_sync"
on public.calendar_events
for select
using (sync_code = 'YAS-TEST-001');

drop policy if exists "calendar_events_insert_yasmine_sync" on public.calendar_events;
create policy "calendar_events_insert_yasmine_sync"
on public.calendar_events
for insert
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "calendar_events_update_yasmine_sync" on public.calendar_events;
create policy "calendar_events_update_yasmine_sync"
on public.calendar_events
for update
using (sync_code = 'YAS-TEST-001')
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "calendar_events_delete_yasmine_sync" on public.calendar_events;
create policy "calendar_events_delete_yasmine_sync"
on public.calendar_events
for delete
using (sync_code = 'YAS-TEST-001');
