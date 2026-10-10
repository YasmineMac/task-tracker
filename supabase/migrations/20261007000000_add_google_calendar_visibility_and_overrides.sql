alter table public.google_calendars
  add column if not exists visible_in_planner boolean not null default true;

alter table public.google_calendars
  add column if not exists default_category text not null default 'personal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'google_calendars_default_category_check'
      and conrelid = 'public.google_calendars'::regclass
  ) then
    alter table public.google_calendars
      add constraint google_calendars_default_category_check
      check (default_category in (
        'work',
        'class',
        'meeting',
        'deadline',
        'milestone',
        'personal',
        'travel',
        'date',
        'social',
        'active',
        'admin'
      ));
  end if;
end $$;

create index if not exists google_calendars_visible_in_planner_idx
  on public.google_calendars (sync_code, visible_in_planner);

update public.google_calendars
set default_category = 'class'
where lower(coalesce(google_calendar_id, '')) in ('yasmine.maccallum.laraki@students.iaac.net')
   or lower(coalesce(summary, '')) in ('25/26 iaac precourse');

update public.google_calendars
set default_category = 'personal'
where lower(coalesce(google_calendar_id, '')) in (
    'yasmine.maccallum@hotmail.com',
    'yasmine.maccallum@gmail.com',
    'ymaccallum.laraki@gmail.com'
  )
   or lower(coalesce(summary, '')) in ('holidays in spain');

create table if not exists public.google_calendar_event_overrides (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  google_calendar_event_row_id uuid not null references public.google_calendar_events(id) on delete cascade,
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  google_calendar_id text not null,
  google_instance_id text not null,
  category_override text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_event_overrides_event_unique unique (google_calendar_event_row_id),
  constraint google_calendar_event_overrides_identity_unique unique (connection_id, google_calendar_id, google_instance_id),
  constraint google_calendar_event_overrides_category_check check (
    category_override is null
    or category_override in (
      'work',
      'class',
      'meeting',
      'deadline',
      'milestone',
      'personal',
      'travel',
      'date',
      'social',
      'active',
      'admin'
    )
  )
);

create index if not exists google_calendar_event_overrides_sync_code_idx
  on public.google_calendar_event_overrides (sync_code);

create index if not exists google_calendar_event_overrides_identity_idx
  on public.google_calendar_event_overrides (connection_id, google_calendar_id, google_instance_id);

drop trigger if exists set_google_calendar_event_overrides_updated_at on public.google_calendar_event_overrides;
create trigger set_google_calendar_event_overrides_updated_at
before update on public.google_calendar_event_overrides
for each row
execute function public.set_updated_at();

alter table public.google_calendar_event_overrides enable row level security;

drop policy if exists "google_calendar_event_overrides_select_yasmine_sync" on public.google_calendar_event_overrides;
create policy "google_calendar_event_overrides_select_yasmine_sync"
on public.google_calendar_event_overrides
for select
using (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_event_overrides_insert_yasmine_sync" on public.google_calendar_event_overrides;
create policy "google_calendar_event_overrides_insert_yasmine_sync"
on public.google_calendar_event_overrides
for insert
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_event_overrides_update_yasmine_sync" on public.google_calendar_event_overrides;
create policy "google_calendar_event_overrides_update_yasmine_sync"
on public.google_calendar_event_overrides
for update
using (sync_code = 'YAS-TEST-001')
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_event_overrides_delete_yasmine_sync" on public.google_calendar_event_overrides;
create policy "google_calendar_event_overrides_delete_yasmine_sync"
on public.google_calendar_event_overrides
for delete
using (sync_code = 'YAS-TEST-001');
