alter table public.tasks
  add column if not exists checklist jsonb not null default '[]'::jsonb;

alter table public.tasks
  add constraint tasks_checklist_array_check check (jsonb_typeof(checklist) = 'array');
