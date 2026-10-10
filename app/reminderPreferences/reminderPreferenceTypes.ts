export type ReminderSourceType = "google_event" | "calendar_event" | "task";
export type ReminderMode = "default" | "offset" | "at_start" | "off";
export type ReminderOffsetUnit = "minutes" | "hours" | "days";

export type ReminderPreference = {
  id: string;
  sourceType: ReminderSourceType;
  sourceId: string;
  reminderMode: ReminderMode;
  offsetAmount: number | null;
  offsetUnit: ReminderOffsetUnit | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type ReminderPreferenceInput = {
  sourceType: ReminderSourceType;
  sourceId: string;
  reminderMode: ReminderMode;
  offsetAmount?: number | null;
  offsetUnit?: ReminderOffsetUnit | null;
};

export const REMINDER_SOURCE_TYPES = new Set<ReminderSourceType>([
  "google_event",
  "calendar_event",
  "task",
]);

export const REMINDER_MODES = new Set<ReminderMode>([
  "default",
  "offset",
  "at_start",
  "off",
]);

export const REMINDER_OFFSET_UNITS = new Set<ReminderOffsetUnit>([
  "minutes",
  "hours",
  "days",
]);

export function reminderPreferenceKey(sourceType: ReminderSourceType, sourceId: string) {
  return `${sourceType}:${sourceId}`;
}
