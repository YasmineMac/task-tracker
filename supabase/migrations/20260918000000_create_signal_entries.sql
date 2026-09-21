create table if not exists public.signal_entries (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  signal_type text not null,
  drink_type text not null,
  quantity numeric(10,3) not null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  alcohol_units numeric(10,3) null,
  feelings_symptoms jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signal_entries_signal_type_check check (signal_type in ('alcohol')),
  constraint signal_entries_quantity_positive_check check (quantity > 0),
  constraint signal_entries_alcohol_units_positive_check check (
    alcohol_units is null or alcohol_units > 0
  ),
  constraint signal_entries_time_order_check check (
    ended_at is null or ended_at >= started_at
  ),
  constraint signal_entries_feelings_symptoms_object_check check (
    feelings_symptoms is null or jsonb_typeof(feelings_symptoms) = 'object'
  )
);

create index if not exists signal_entries_sync_code_started_at_idx
  on public.signal_entries (sync_code, started_at desc);

create index if not exists signal_entries_sync_code_signal_type_idx
  on public.signal_entries (sync_code, signal_type);

drop trigger if exists set_signal_entries_updated_at on public.signal_entries;
create trigger set_signal_entries_updated_at
before update on public.signal_entries
for each row
execute function public.set_updated_at();

alter table public.signal_entries enable row level security;

drop policy if exists "signal_entries_select_yasmine_sync" on public.signal_entries;
create policy "signal_entries_select_yasmine_sync"
on public.signal_entries
for select
using (sync_code = 'YAS-TEST-001');

drop policy if exists "signal_entries_insert_yasmine_sync" on public.signal_entries;
create policy "signal_entries_insert_yasmine_sync"
on public.signal_entries
for insert
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "signal_entries_update_yasmine_sync" on public.signal_entries;
create policy "signal_entries_update_yasmine_sync"
on public.signal_entries
for update
using (sync_code = 'YAS-TEST-001')
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "signal_entries_delete_yasmine_sync" on public.signal_entries;
create policy "signal_entries_delete_yasmine_sync"
on public.signal_entries
for delete
using (sync_code = 'YAS-TEST-001');
