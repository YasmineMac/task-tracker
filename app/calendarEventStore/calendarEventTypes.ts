export type CalendarEventType =
  | "work"
  | "class"
  | "meeting"
  | "deadline"
  | "milestone"
  | "personal"
  | "travel";

export type CalendarEvent = {
  id: string;
  eventType: CalendarEventType;
  title: string;
  description?: string | null;
  allDay: boolean;
  startAt?: string | null;
  endAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  timezone: string;
  taskId?: string | null;
  categoryId?: string | null;
  location?: string | null;
  videoUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  recurrenceRule?: string | null;
  recurrenceParentId?: string | null;
  recurrenceExceptionDate?: string | null;
  recurrenceStatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const CALENDAR_EVENT_TYPES = new Set<CalendarEventType>([
  "work",
  "class",
  "meeting",
  "deadline",
  "milestone",
  "personal",
  "travel",
]);

const RECURRENCE_STATUSES = new Set(["active", "cancelled", "moved"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createCalendarEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isCalendarEventType(value: unknown): value is CalendarEventType {
  return typeof value === "string" && CALENDAR_EVENT_TYPES.has(value as CalendarEventType);
}

export function isValidCalendarEventUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalUuid(value: unknown) {
  return isValidCalendarEventUuid(value) ? value : null;
}

function optionalDateOnly(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return isValidDateOnly(value) ? value : undefined;
}

function optionalTimestamp(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return isValidTimestamp(value) ? value : undefined;
}

function optionalRecurrenceStatus(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && RECURRENCE_STATUSES.has(value) ? value : undefined;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function normalizeCalendarEvent(value: unknown): CalendarEvent | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const id = raw.id;
  const title = optionalString(raw.title);
  const eventType = raw.eventType;
  const recurrenceStatus = optionalRecurrenceStatus(raw.recurrenceStatus);

  if (!isValidCalendarEventUuid(id) || !title || !isCalendarEventType(eventType)) {
    return null;
  }

  if (recurrenceStatus === undefined) return null;

  const allDay = raw.allDay === true;
  const timezone = optionalString(raw.timezone) ?? "Europe/Madrid";
  const startDate = optionalDateOnly(raw.startDate);
  const endDate = optionalDateOnly(raw.endDate);
  const startAt = optionalTimestamp(raw.startAt);
  const endAt = optionalTimestamp(raw.endAt);
  const recurrenceExceptionDate = optionalDateOnly(raw.recurrenceExceptionDate);

  if (
    startDate === undefined ||
    endDate === undefined ||
    startAt === undefined ||
    endAt === undefined ||
    recurrenceExceptionDate === undefined
  ) {
    return null;
  }

  if (allDay && !startDate) return null;
  if (!allDay && !startAt) return null;

  if (startDate && endDate && endDate < startDate) return null;
  if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt)) return null;

  return {
    id,
    eventType,
    title,
    description: optionalString(raw.description),
    allDay,
    startAt: allDay ? null : startAt,
    endAt: allDay ? null : endAt,
    startDate: allDay ? startDate : null,
    endDate: allDay ? endDate : null,
    timezone,
    taskId: optionalUuid(raw.taskId),
    categoryId: optionalString(raw.categoryId),
    location: optionalString(raw.location),
    videoUrl: optionalString(raw.videoUrl),
    notes: optionalString(raw.notes),
    metadata: normalizeMetadata(raw.metadata),
    recurrenceRule: optionalString(raw.recurrenceRule),
    recurrenceParentId: optionalUuid(raw.recurrenceParentId),
    recurrenceExceptionDate,
    recurrenceStatus,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}
