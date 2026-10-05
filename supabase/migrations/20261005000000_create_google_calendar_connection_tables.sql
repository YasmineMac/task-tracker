create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  google_account_id text not null,
  google_email text null,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  token_type text null,
  expires_at timestamptz not null,
  granted_scope text null,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz null,
  last_calendar_discovery_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_connections_sync_account_unique unique (sync_code, google_account_id)
);

create table if not exists public.google_calendars (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  google_calendar_id text not null,
  summary text not null,
  description text null,
  primary_calendar boolean not null default false,
  background_color text null,
  foreground_color text null,
  selected boolean not null default false,
  timezone text null,
  access_role text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendars_connection_calendar_unique unique (connection_id, google_calendar_id)
);

create index if not exists google_calendar_connections_sync_code_idx
  on public.google_calendar_connections (sync_code);

create index if not exists google_calendar_connections_google_account_id_idx
  on public.google_calendar_connections (google_account_id);

create index if not exists google_calendars_sync_code_idx
  on public.google_calendars (sync_code);

create index if not exists google_calendars_connection_id_idx
  on public.google_calendars (connection_id);

create index if not exists google_calendars_selected_idx
  on public.google_calendars (sync_code, selected);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_google_calendar_connections_updated_at on public.google_calendar_connections;
create trigger set_google_calendar_connections_updated_at
before update on public.google_calendar_connections
for each row
execute function public.set_updated_at();

drop trigger if exists set_google_calendars_updated_at on public.google_calendars;
create trigger set_google_calendars_updated_at
before update on public.google_calendars
for each row
execute function public.set_updated_at();

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendars enable row level security;

drop policy if exists "google_calendar_connections_select_yasmine_sync" on public.google_calendar_connections;
create policy "google_calendar_connections_select_yasmine_sync"
on public.google_calendar_connections
for select
using (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_connections_insert_yasmine_sync" on public.google_calendar_connections;
create policy "google_calendar_connections_insert_yasmine_sync"
on public.google_calendar_connections
for insert
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_connections_update_yasmine_sync" on public.google_calendar_connections;
create policy "google_calendar_connections_update_yasmine_sync"
on public.google_calendar_connections
for update
using (sync_code = 'YAS-TEST-001')
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendar_connections_delete_yasmine_sync" on public.google_calendar_connections;
create policy "google_calendar_connections_delete_yasmine_sync"
on public.google_calendar_connections
for delete
using (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendars_select_yasmine_sync" on public.google_calendars;
create policy "google_calendars_select_yasmine_sync"
on public.google_calendars
for select
using (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendars_insert_yasmine_sync" on public.google_calendars;
create policy "google_calendars_insert_yasmine_sync"
on public.google_calendars
for insert
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendars_update_yasmine_sync" on public.google_calendars;
create policy "google_calendars_update_yasmine_sync"
on public.google_calendars
for update
using (sync_code = 'YAS-TEST-001')
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "google_calendars_delete_yasmine_sync" on public.google_calendars;
create policy "google_calendars_delete_yasmine_sync"
on public.google_calendars
for delete
using (sync_code = 'YAS-TEST-001');
