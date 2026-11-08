create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  disabled_at timestamptz null,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists push_subscriptions_sync_code_idx
  on public.push_subscriptions (sync_code);

create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions (sync_code, disabled_at)
  where disabled_at is null;

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  sync_code text not null,
  source_type text not null,
  source_id text not null,
  reminder_fire_at timestamptz not null,
  source_start_at timestamptz null,
  status text not null default 'pending',
  claimed_at timestamptz null,
  claim_token uuid null,
  sent_at timestamptz null,
  failed_at timestamptz null,
  attempt_count integer not null default 0,
  error text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_deliveries_source_unique unique (
    sync_code,
    source_type,
    source_id,
    reminder_fire_at
  ),
  constraint reminder_deliveries_source_type_check check (
    source_type in ('google_event', 'calendar_event', 'task')
  ),
  constraint reminder_deliveries_status_check check (
    status in ('pending', 'claimed', 'sent', 'failed', 'skipped')
  ),
  constraint reminder_deliveries_attempt_count_check check (attempt_count >= 0),
  constraint reminder_deliveries_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists reminder_deliveries_sync_code_idx
  on public.reminder_deliveries (sync_code);

create index if not exists reminder_deliveries_due_pending_idx
  on public.reminder_deliveries (sync_code, reminder_fire_at)
  where status = 'pending';

create index if not exists reminder_deliveries_claimed_idx
  on public.reminder_deliveries (sync_code, claimed_at)
  where status = 'claimed';

create index if not exists reminder_deliveries_source_idx
  on public.reminder_deliveries (sync_code, source_type, source_id);

drop trigger if exists set_reminder_deliveries_updated_at on public.reminder_deliveries;
create trigger set_reminder_deliveries_updated_at
before update on public.reminder_deliveries
for each row
execute function public.set_updated_at();

alter table public.reminder_deliveries enable row level security;
