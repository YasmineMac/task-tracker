import type {
  GoogleCalendarConnectionSummary,
  GoogleCalendarEvent,
  GoogleCalendarSummary,
} from "./googleCalendarTypes";

export async function loadGoogleCalendarSettings() {
  const response = await fetch("/api/google/calendars", { cache: "no-store" });
  if (!response.ok) return { ok: false, connections: [], calendars: [] };
  const data = (await response.json()) as {
    ok: boolean;
    connections?: GoogleCalendarConnectionSummary[];
    calendars?: GoogleCalendarSummary[];
  };
  return {
    ok: data.ok === true,
    connections: data.connections ?? [],
    calendars: data.calendars ?? [],
  };
}

export async function updateGoogleCalendarSelection(calendarId: string, selected: boolean) {
  const response = await fetch("/api/google/calendars", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ calendarId, selected }),
  });
  return response.ok;
}

export async function syncGoogleCalendarEvents() {
  const response = await fetch("/api/google/sync", { method: "POST" });
  if (!response.ok) return { ok: false, synced: 0 };
  const data = (await response.json()) as { ok: boolean; synced?: number };
  return { ok: data.ok === true, synced: data.synced ?? 0 };
}

export async function loadGoogleCalendarEvents() {
  const response = await fetch("/api/google/events", { cache: "no-store" });
  if (!response.ok) return { ok: false, events: [] };
  const data = (await response.json()) as { ok: boolean; events?: GoogleCalendarEvent[] };
  return { ok: data.ok === true, events: data.events ?? [] };
}
