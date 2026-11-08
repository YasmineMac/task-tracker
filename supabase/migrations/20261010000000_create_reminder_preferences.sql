create table if not exists public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  source_type text not null,
  source_id text not null,
  reminder_mode text not null default 'default',
  offset_amount integer null,
  offset_unit text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_preferences_source_unique unique (sync_code, source_type, source_id),
  constraint reminder_preferences_source_type_check check (
    source_type in ('google_event', 'calendar_event', 'task')
  ),
  constraint reminder_preferences_mode_check check (
    reminder_mode in ('default', 'offset', 'at_start', 'off')
  ),
  constraint reminder_preferences_offset_unit_check check (
    offset_unit is null or offset_unit in ('minutes', 'hours', 'days')
  ),
  constraint reminder_preferences_offset_shape_check check (
    (
      reminder_mode = 'offset'
      and offset_amount is not null
      and offset_amount > 0
      and offset_unit is not null
    )
    or
    (
      reminder_mode <> 'offset'
      and offset_amount is null
      and offset_unit is null
    )
  ),
  constraint reminder_preferences_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists reminder_preferences_sync_code_idx
  on public.reminder_preferences (sync_code);

drop trigger if exists set_reminder_preferences_updated_at on public.reminder_preferences;
create trigger set_reminder_preferences_updated_at
before update on public.reminder_preferences
for each row
execute function public.set_updated_at();

alter table public.reminder_preferences enable row level security;
