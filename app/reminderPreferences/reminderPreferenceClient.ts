import type {
  ReminderPreference,
  ReminderPreferenceInput,
  ReminderSourceType,
} from "./reminderPreferenceTypes";

export async function loadReminderPreference(sourceType: ReminderSourceType, sourceId: string) {
  const params = new URLSearchParams({ sourceType, sourceId });
  const response = await fetch(`/api/reminders?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) return { ok: false, preference: null as ReminderPreference | null };
  const data = (await response.json()) as { ok: boolean; preference?: ReminderPreference | null };
  return { ok: data.ok === true, preference: data.preference ?? null };
}

export async function saveReminderPreference(input: ReminderPreferenceInput) {
  const response = await fetch("/api/reminders", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ok: false, preference: null as ReminderPreference | null };
  const data = (await response.json()) as { ok: boolean; preference?: ReminderPreference };
  return { ok: data.ok === true, preference: data.preference ?? null };
}

export async function resetReminderPreference(sourceType: ReminderSourceType, sourceId: string) {
  const response = await fetch("/api/reminders", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceType, sourceId }),
  });
  return response.ok;
}
