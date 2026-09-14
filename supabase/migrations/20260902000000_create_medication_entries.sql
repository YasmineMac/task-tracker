create table if not exists public.medication_entries (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  entry_type text not null,
  occurred_at timestamptz not null,
  medication text null,
  amount numeric(10,3) null,
  unit text null,
  feeling text null,
  valence text null,
  intensity text null,
  daypart text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_entries_entry_type_check check (
    entry_type in ('input', 'observation')
  ),
  constraint medication_entries_amount_positive_check check (
    amount is null or amount > 0
  ),
  constraint medication_entries_valence_check check (
    valence is null or valence in ('positive', 'neutral', 'negative')
  ),
  constraint medication_entries_intensity_check check (
    intensity is null or intensity in ('low', 'medium', 'high')
  ),
  constraint medication_entries_daypart_check check (
    daypart is null or daypart in ('morning', 'noon', 'afternoon', 'evening', 'night')
  ),
  constraint medication_entries_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint medication_entries_shape_check check (
    (entry_type = 'input' and medication is not null)
    or
    (entry_type = 'observation' and feeling is not null)
  )
);

create index if not exists medication_entries_sync_code_occurred_at_idx
  on public.medication_entries (sync_code, occurred_at desc);

create index if not exists medication_entries_sync_code_entry_type_idx
  on public.medication_entries (sync_code, entry_type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_medication_entries_updated_at on public.medication_entries;
create trigger set_medication_entries_updated_at
before update on public.medication_entries
for each row
execute function public.set_updated_at();

alter table public.medication_entries enable row level security;

drop policy if exists "medication_entries_select_yasmine_sync" on public.medication_entries;
create policy "medication_entries_select_yasmine_sync"
on public.medication_entries
for select
using (sync_code = 'YAS-TEST-001');

drop policy if exists "medication_entries_insert_yasmine_sync" on public.medication_entries;
create policy "medication_entries_insert_yasmine_sync"
on public.medication_entries
for insert
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "medication_entries_update_yasmine_sync" on public.medication_entries;
create policy "medication_entries_update_yasmine_sync"
on public.medication_entries
for update
using (sync_code = 'YAS-TEST-001')
with check (sync_code = 'YAS-TEST-001');

drop policy if exists "medication_entries_delete_yasmine_sync" on public.medication_entries;
create policy "medication_entries_delete_yasmine_sync"
on public.medication_entries
for delete
using (sync_code = 'YAS-TEST-001');

