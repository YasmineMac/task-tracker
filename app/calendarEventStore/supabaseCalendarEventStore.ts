import { supabase } from "@/lib/supabase";
import {
  isValidCalendarEventUuid,
  normalizeCalendarEvent,
  type CalendarEvent,
} from "./calendarEventTypes";

type CalendarEventRow = Record<string, unknown>;

function calendarEventFromRow(row: CalendarEventRow) {
  return normalizeCalendarEvent({
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    allDay: row.all_day,
    startAt: row.start_at,
    endAt: row.end_at,
    startDate: row.start_date,
    endDate: row.end_date,
    timezone: row.timezone,
    taskId: row.task_id,
    categoryId: row.category_id,
    location: row.location,
    videoUrl: row.video_url,
    notes: row.notes,
    metadata: row.metadata,
    recurrenceRule: row.recurrence_rule,
    recurrenceParentId: row.recurrence_parent_id,
    recurrenceExceptionDate: row.recurrence_exception_date,
    recurrenceStatus: row.recurrence_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function calendarEventPayload(event: CalendarEvent, syncCode: string) {
  return {
    id: event.id,
    sync_code: syncCode,
    event_type: event.eventType,
    title: event.title,
    description: event.description ?? null,
    all_day: event.allDay,
    start_at: event.allDay ? null : event.startAt ?? null,
    end_at: event.allDay ? null : event.endAt ?? null,
    start_date: event.allDay ? event.startDate ?? null : null,
    end_date: event.allDay ? event.endDate ?? null : null,
    timezone: event.timezone,
    task_id: event.taskId ?? null,
    category_id: event.categoryId ?? null,
    location: event.location ?? null,
    video_url: event.videoUrl ?? null,
    notes: event.notes ?? null,
    metadata: event.metadata ?? {},
    recurrence_rule: event.recurrenceRule ?? null,
    recurrence_parent_id: event.recurrenceParentId ?? null,
    recurrence_exception_date: event.recurrenceExceptionDate ?? null,
    recurrence_status: event.recurrenceStatus ?? null,
  };
}

export async function loadCalendarEvents(syncCode: string) {
  if (!supabase) {
    console.warn("Skipped calendar event load: Supabase env vars are missing");
    return { ok: false, events: [] as CalendarEvent[] };
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      [
        "id",
        "event_type",
        "title",
        "description",
        "all_day",
        "start_at",
        "end_at",
        "start_date",
        "end_date",
        "timezone",
        "task_id",
        "category_id",
        "location",
        "video_url",
        "notes",
        "metadata",
        "recurrence_rule",
        "recurrence_parent_id",
        "recurrence_exception_date",
        "recurrence_status",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("sync_code", syncCode)
    .order("start_date", { ascending: true })
    .order("start_at", { ascending: true });

  if (error) {
    console.warn("Failed to load calendar events from Supabase:", error);
    return { ok: false, events: [] as CalendarEvent[] };
  }

  const rows = (data ?? []) as unknown as CalendarEventRow[];
  const events = rows
    .map((row) => calendarEventFromRow(row))
    .filter((event): event is CalendarEvent => Boolean(event));

  if (events.length !== rows.length) {
    console.warn("Skipped invalid calendar event rows while loading from Supabase", {
      received: rows.length,
      normalized: events.length,
    });
  }

  return { ok: true, events };
}

export async function saveCalendarEvent(event: CalendarEvent, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped calendar event save: Supabase env vars are missing");
    return false;
  }

  const normalizedEvent = normalizeCalendarEvent(event);

  if (!normalizedEvent) {
    console.warn("Skipped calendar event save: event failed normalization", { id: event.id });
    return false;
  }

  const { error } = await supabase
    .from("calendar_events")
    .upsert(calendarEventPayload(normalizedEvent, syncCode), { onConflict: "id" });

  if (error) {
    console.warn("Failed to save calendar event to Supabase:", {
      operation: "upsert",
      id: normalizedEvent.id,
      error,
    });
    return false;
  }

  return true;
}

export async function deleteCalendarEvent(id: string, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped calendar event delete: Supabase env vars are missing");
    return false;
  }

  if (!isValidCalendarEventUuid(id)) {
    console.warn("Skipped calendar event delete: id is not a Supabase-compatible UUID", { id });
    return false;
  }

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("sync_code", syncCode)
    .eq("id", id);

  if (error) {
    console.warn("Failed to delete calendar event from Supabase:", {
      operation: "delete",
      id,
      error,
    });
    return false;
  }

  return true;
}
