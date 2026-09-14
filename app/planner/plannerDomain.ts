import type { CalendarEvent, CalendarEventType } from "../calendarEventStore/calendarEventTypes";
import type { Task } from "../taskStore/taskTypes";

export type CalendarTimeMode =
  | "date_only"
  | "single_time"
  | "time_range"
  | "all_day"
  | "multi_day"
  | "daypart";

export type CalendarDaypart = "morning" | "noon" | "afternoon" | "evening" | "night";

const CALENDAR_TIME_MODES = new Set<CalendarTimeMode>([
  "date_only",
  "single_time",
  "time_range",
  "all_day",
  "multi_day",
  "daypart",
]);
const CALENDAR_DAYPARTS = new Set<CalendarDaypart>([
  "morning",
  "noon",
  "afternoon",
  "evening",
  "night",
]);

export type PlannerMonthDay = {
  date: string;
  isCurrentMonth: boolean;
};

export type PlannerYearMonth = {
  id: string;
  anchorDate: string;
  label: string;
  days: PlannerMonthDay[];
};

export type PlannerDateItem =
  | { sourceType: "calendar_event"; event: CalendarEvent }
  | { sourceType: "task_deadline"; task: Task; date: string };

export type PlannerAllDaySpan = {
  item: PlannerDateItem;
  startIndex: number;
  span: number;
  startsBefore: boolean;
  endsAfter: boolean;
};

export function isCalendarTimeMode(value: unknown): value is CalendarTimeMode {
  return typeof value === "string" && CALENDAR_TIME_MODES.has(value as CalendarTimeMode);
}

export function isCalendarDaypart(value: unknown): value is CalendarDaypart {
  return typeof value === "string" && CALENDAR_DAYPARTS.has(value as CalendarDaypart);
}

export function plannerDaypartLabel(daypart: CalendarDaypart) {
  if (daypart === "noon") return "Noon";
  return daypart.slice(0, 1).toUpperCase() + daypart.slice(1);
}

export function plannerDaypartAnchorMinutes(daypart: CalendarDaypart) {
  if (daypart === "morning") return 9 * 60;
  if (daypart === "noon") return 12 * 60;
  if (daypart === "afternoon") return 15 * 60;
  if (daypart === "evening") return 18 * 60;
  return 21 * 60;
}

export function getCalendarEventDaypart(event: CalendarEvent): CalendarDaypart | null {
  const daypart = event.metadata?.daypart;
  return isCalendarDaypart(daypart) ? daypart : null;
}

export function getCalendarEventTimeMode(event: CalendarEvent): CalendarTimeMode {
  const explicitMode = event.metadata?.timeMode;
  if (isCalendarTimeMode(explicitMode)) return explicitMode;

  if (event.allDay && event.startDate && event.endDate) return "multi_day";
  if (event.allDay && event.startDate) return "date_only";
  if (!event.allDay && event.startAt && event.endAt) return "time_range";
  if (!event.allDay && event.startAt) return "single_time";

  return event.allDay ? "date_only" : "single_time";
}

export function withCalendarTimingMetadata(event: CalendarEvent): CalendarEvent {
  const timeMode = getCalendarEventTimeMode(event);
  const metadata: Record<string, unknown> = {
    ...(event.metadata ?? {}),
    timeMode,
  };

  if (timeMode !== "daypart") {
    delete metadata.daypart;
  }

  return {
    ...event,
    metadata,
  };
}

function isValidISODate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function addDaysISO(iso: string, offset: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(iso: string, offset: number) {
  const { year, month, day } = isoParts(iso);
  const endOfTargetMonth = new Date(Date.UTC(year, month - 1 + offset + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(year, month - 1 + offset, Math.min(day, endOfTargetMonth)));
  return d.toISOString().slice(0, 10);
}

function isoParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function startOfPlannerMonth(iso: string) {
  const { year, month } = isoParts(iso);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function endOfPlannerMonth(iso: string) {
  const { year, month } = isoParts(iso);
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

export function startOfPlannerWeek(iso: string) {
  const date = new Date(iso + "T00:00:00");
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDaysISO(iso, -mondayOffset);
}

export function plannerWeekDaysForAnchor(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  const start = startOfPlannerWeek(anchor);

  return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
}

export function plannerMonthDaysForAnchor(anchorDate: string): PlannerMonthDay[] {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  const monthStart = startOfPlannerMonth(anchor);
  const monthEnd = endOfPlannerMonth(anchor);
  const gridStart = startOfPlannerWeek(monthStart);
  const gridEnd = addDaysISO(startOfPlannerWeek(monthEnd), 6);
  const days: PlannerMonthDay[] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    days.push({
      date: cursor,
      isCurrentMonth: cursor.slice(0, 7) === monthStart.slice(0, 7),
    });
    cursor = addDaysISO(cursor, 1);
  }

  return days;
}

export function plannerMonthWeeksForDays(days: PlannerMonthDay[]) {
  const weeks: PlannerMonthDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

function plannerMonthForAnchor(anchorDate: string): PlannerYearMonth {
  const monthAnchor = startOfPlannerMonth(anchorDate);
  return {
    id: monthAnchor.slice(0, 7),
    anchorDate: monthAnchor,
    label: new Intl.DateTimeFormat("en", { month: "short" }).format(
      new Date(monthAnchor + "T00:00:00")
    ),
    days: plannerMonthDaysForAnchor(monthAnchor),
  };
}

export function plannerThreeMonthsForAnchor(anchorDate: string): PlannerYearMonth[] {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  const firstMonth = startOfPlannerMonth(anchor);
  return Array.from({ length: 3 }, (_, index) => plannerMonthForAnchor(addMonthsISO(firstMonth, index)));
}

export function plannerMonthsVisibleRange(months: PlannerYearMonth[]) {
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  return {
    start: firstMonth?.days[0]?.date ?? todayISO(),
    end: lastMonth?.days[lastMonth.days.length - 1]?.date ?? todayISO(),
  };
}

export function plannerYearMonthsForAnchor(anchorDate: string): PlannerYearMonth[] {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  const year = isoParts(anchor).year;

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const month = monthIndex + 1;
    const monthAnchor = `${year}-${String(month).padStart(2, "0")}-01`;
    return plannerMonthForAnchor(monthAnchor);
  });
}

export function formatPlannerMonthLabel(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(startOfPlannerMonth(anchor) + "T00:00:00")
  );
}

export function formatPlannerYearLabel(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  return String(isoParts(anchor).year);
}

export function formatPlannerThreeMonthLabel(months: PlannerYearMonth[]) {
  const first = months[0];
  const last = months[months.length - 1];
  if (!first || !last) return "";

  const firstDate = new Date(first.anchorDate + "T00:00:00");
  const lastDate = new Date(last.anchorDate + "T00:00:00");
  const firstMonth = new Intl.DateTimeFormat("en", { month: "short" }).format(firstDate);
  const lastMonth = new Intl.DateTimeFormat("en", { month: "short" }).format(lastDate);
  const firstYear = firstDate.getFullYear();
  const lastYear = lastDate.getFullYear();

  if (firstYear === lastYear) return `${firstMonth}-${lastMonth} ${lastYear}`;
  return `${firstMonth} ${firstYear}-${lastMonth} ${lastYear}`;
}

export function formatPlannerWeekRange(days: string[]) {
  if (!days.length) return "";

  const start = new Date(days[0] + "T00:00:00");
  const end = new Date(days[days.length - 1] + "T00:00:00");
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
  const compactFormatter = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${monthFormatter.format(end)}`;
  }

  return `${compactFormatter.format(start)} - ${compactFormatter.format(end)}`;
}

export function eventLocalDate(timestamp?: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function formatPlannerEventTime(timestamp?: string | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function calendarEventIntersectsWeek(event: CalendarEvent, weekStart: string, weekEnd: string) {
  if (event.allDay) {
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return Boolean(start && end && start <= weekEnd && end >= weekStart);
  }

  const start = eventLocalDate(event.startAt);
  const end = eventLocalDate(event.endAt) || start;
  return Boolean(start && end && start <= weekEnd && end >= weekStart);
}

export function calendarEventIntersectsDay(event: CalendarEvent, day: string) {
  if (event.allDay) {
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return Boolean(start && end && start <= day && end >= day);
  }

  const start = eventLocalDate(event.startAt);
  const end = eventLocalDate(event.endAt) || start;
  return Boolean(start && end && start <= day && end >= day);
}

export function plannerMonthEventPrefix(event: CalendarEvent, day: string) {
  if (event.allDay) return "";
  return eventLocalDate(event.startAt) === day ? formatPlannerEventTime(event.startAt) : "";
}

export function eventDateSpan(event: CalendarEvent) {
  if (event.allDay) {
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return start && end ? { start, end } : null;
  }

  const start = eventLocalDate(event.startAt);
  const end = eventLocalDate(event.endAt) || start;
  return start && end ? { start, end } : null;
}

export function plannerDateItemSortValue(item: PlannerDateItem) {
  if (item.sourceType === "task_deadline") return `0-${item.task.title}`;
  const event = item.event;
  const mode = getCalendarEventTimeMode(event);
  const daypart = getCalendarEventDaypart(event);
  if (mode === "daypart" && daypart) {
    return `2-${event.startDate ?? ""}-${String(plannerDaypartAnchorMinutes(daypart)).padStart(4, "0")}-${event.title}`;
  }
  if (!event.allDay && event.startAt) {
    const date = eventLocalDate(event.startAt) ?? "";
    const parsed = new Date(event.startAt);
    const minutes = Number.isFinite(parsed.getTime()) ? parsed.getHours() * 60 + parsed.getMinutes() : 0;
    return `2-${date}-${String(minutes).padStart(4, "0")}-${event.title}`;
  }
  const allDayRank = event.allDay ? 1 : 2;
  return `${allDayRank}-${event.startAt ?? event.startDate ?? ""}-${event.title}`;
}

export function plannerItemsForDate(
  date: string,
  calendarEventsForRender: CalendarEvent[],
  taskDeadlinesByDate: Record<string, Task[]>
) {
  const calendarItems: PlannerDateItem[] = calendarEventsForRender
    .filter((event) => calendarEventIntersectsDay(event, date))
    .map((event) => ({ sourceType: "calendar_event", event }));
  const deadlineItems: PlannerDateItem[] = (taskDeadlinesByDate[date] ?? []).map((task) => ({
    sourceType: "task_deadline",
    task,
    date,
  }));

  return [...deadlineItems, ...calendarItems].sort((a, b) =>
    plannerDateItemSortValue(a).localeCompare(plannerDateItemSortValue(b))
  );
}

export function plannerItemTitle(item: PlannerDateItem) {
  return item.sourceType === "task_deadline" ? item.task.title : item.event.title;
}

export function plannerItemPrefix(item: PlannerDateItem, date: string) {
  if (item.sourceType === "task_deadline") return "";
  return plannerMonthEventPrefix(item.event, date);
}

export function plannerItemTimingLabel(item: PlannerDateItem) {
  return "";
}

export function plannerYearItemEventType(item: PlannerDateItem): CalendarEventType {
  return item.sourceType === "task_deadline" ? "deadline" : item.event.eventType;
}

export function plannerItemDateSpan(item: PlannerDateItem) {
  if (item.sourceType === "task_deadline") return { start: item.date, end: item.date };
  return eventDateSpan(item.event);
}

export function plannerAllDaySpansForDays(days: string[], items: PlannerDateItem[]): PlannerAllDaySpan[] {
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];
  if (!rangeStart || !rangeEnd) return [];

  return items
    .map((item) => {
      const span = plannerItemDateSpan(item);
      if (!span || span.end < rangeStart || span.start > rangeEnd) return null;

      const start = span.start < rangeStart ? rangeStart : span.start;
      const end = span.end > rangeEnd ? rangeEnd : span.end;
      const startIndex = days.indexOf(start);
      const endIndex = days.indexOf(end);
      if (startIndex === -1 || endIndex === -1) return null;

      return {
        item,
        startIndex,
        span: endIndex - startIndex + 1,
        startsBefore: span.start < rangeStart,
        endsAfter: span.end > rangeEnd,
      };
    })
    .filter((span): span is PlannerAllDaySpan => Boolean(span))
    .sort((a, b) => a.startIndex - b.startIndex || b.span - a.span || plannerItemTitle(a.item).localeCompare(plannerItemTitle(b.item)));
}

export function plannerAllDaySpanKey(span: PlannerAllDaySpan, prefix: string) {
  const id = span.item.sourceType === "calendar_event" ? span.item.event.id : span.item.task.id;
  return `${prefix}-${id}-${span.startIndex}-${span.span}`;
}
