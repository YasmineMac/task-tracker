"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Circle,
  CircleCheck,
  Diamond,
  Clock,
  Clock3,
  CalendarDays,
  Flag,
  Gauge,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Mail,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Snowflake,
  UserRound,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";
import {
  categoryDisplayLabel,
  createCategory,
  fallbackCategories,
  loadCategories,
  type Category,
  updateCategory,
  updateCategoryArchived,
} from "./categoryStore";
import { getTaskStore, isDemoMode } from "./taskStore";
import { normalizeTask, uid } from "./taskStore/taskNormalization";
import {
  deleteTimeLog as deleteSupabaseTimeLog,
  loadTimeLogs,
  saveTimeLog as saveSupabaseTimeLog,
} from "./timeLogStore/supabaseTimeLogStore";
import {
  deleteCalendarEvent,
  loadCalendarEvents,
  saveCalendarEvent,
} from "./calendarEventStore/supabaseCalendarEventStore";
import {
  createCalendarEventId,
  type CalendarEvent,
  type CalendarEventType,
} from "./calendarEventStore/calendarEventTypes";
import {
  calculateTimeLogDurationHours,
  isClosedTimeLog,
  isOpenTimeLog,
  isTimeLogISODate,
  timeLogTimeToMinutes,
} from "./taskStore/taskTypes";
import type {
  ActivityType,
  BackupSnapshot,
  DeadlineMode,
  EffortLevel,
  Priority,
  Status,
  Task,
  TaskStore,
  TimeLog,
  VisionHorizon,
} from "./taskStore/taskTypes";

const TIME_LOGS_STORAGE_KEY = isDemoMode ? "task_tracker_demo_time_logs_v1" : "yasmine_time_logs_v1";
const TASKS_LOCAL_CACHE_KEY = isDemoMode ? "task_tracker_demo_tasks_cache_v1" : "yasmine_tasks_local_cache_v1";
const BACKUP_KEY_PREFIX = isDemoMode ? "task_tracker_demo_backup_" : "yasmine_backup_";
const ACTIVE_TAB_STORAGE_KEY = isDemoMode ? "task_tracker_demo_active_tab" : "yasmine_active_tab";
const SIDEBAR_COLLAPSED_STORAGE_KEY = isDemoMode
  ? "task_tracker_demo_sidebar_collapsed"
  : "yasmine_sidebar_collapsed";
const ATTENTION_CATEGORY_SCOPE_KEY = isDemoMode
  ? "task_tracker_demo_attention_category_scope_v1"
  : "yasmine_attention_category_scope_v1";
const SYNC_CODE = isDemoMode ? "DEMO-TASKS" : "YAS-TEST-001";

type ViewMode = "board" | "planner" | "list" | "logger";
type PlannerView = "week" | "month" | "year";
type PlannerEventModalMode = "create" | "edit";
type PlannerEventDraft = {
  id: string;
  eventType: CalendarEventType;
  title: string;
  allDay: boolean;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  taskId: string;
  description: string;
  who: string;
  location: string;
  videoUrl: string;
  origin: string;
  destination: string;
  notes: string;
  timezone: string;
  repeat: "none" | "weekly";
  recurrenceWeekday: number;
  recurrenceStartDate: string;
  recurrenceEndDate: string;
  recurrenceApplyScope: "this" | "future" | "all";
  recurrenceParentId: string | null;
  recurrenceExceptionDate: string | null;
};
type PlannerWeekInteraction = {
  kind: "move" | "resize";
  eventId: string;
  originalEvent: CalendarEvent;
  previewEvent: CalendarEvent;
  pointerStartX: number;
  pointerStartY: number;
  gridLeft: number;
  dayWidth: number;
  originalStartMinutes: number;
  originalEndMinutes: number;
  originalDurationMinutes: number;
  hasMoved: boolean;
};
type PlannerDateItem =
  | { sourceType: "calendar_event"; event: CalendarEvent }
  | { sourceType: "task_deadline"; task: Task; date: string };
type PlannerAllDaySpan = {
  item: PlannerDateItem;
  startIndex: number;
  span: number;
  startsBefore: boolean;
  endsAfter: boolean;
};
type PlannerWorkResolutionStatus = "logged" | "skipped";
type SmartImportRecurrence = "none" | "weekly";
type SmartImportProposal = {
  id: string;
  sourceText: string;
  include: boolean;
  savedEventId?: string;
  title: string;
  eventType: CalendarEventType;
  recurrence: SmartImportRecurrence;
  allDay: boolean;
  date: string;
  endDate: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
  origin: string;
  destination: string;
  notes: string;
  warnings: string[];
};
type LoggerValueMode = "hours" | "times";
type LoggerRangeMode = "week" | "month" | "year" | "custom";
type ListFilterMenu = "status" | "priority" | "difficulty" | "timeLeft" | "duration";
type AppNavItem = {
  id: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};
type AttentionWeights = {
  time: number;
  duration: number;
  difficulty: number;
};

const DEFAULT_ATTENTION_WEIGHTS: AttentionWeights = { time: 50, duration: 15, difficulty: 15 };
const FIXED_PRIORITY_WEIGHT = 20;
const COMPLETED_RECOVERY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const VISION_HORIZONS: { id: VisionHorizon; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "mid", label: "Mid" },
  { id: "long", label: "Long" },
];
const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: "correspondence", label: "Correspondence" },
  { id: "activity", label: "Activity" },
  { id: "uni_work", label: "Uni work" },
];
const EFFORT_LEVELS: { id: EffortLevel; label: string }[] = [
  { id: "quick", label: "Quick" },
  { id: "moderate", label: "Moderate" },
  { id: "extensive", label: "Extensive" },
];
const EFFORT_RUNWAY_FACTORS: Record<EffortLevel, number> = {
  quick: 0.7,
  moderate: 1.4,
  extensive: 2.8,
};
const CATEGORY_COLOURS = [
  { id: "slate", label: "Slate", swatch: "bg-slate-300" },
  { id: "sky", label: "Sky", swatch: "bg-sky-300" },
  { id: "violet", label: "Violet", swatch: "bg-violet-300" },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-300" },
  { id: "amber", label: "Amber", swatch: "bg-amber-300" },
  { id: "rose", label: "Rose", swatch: "bg-rose-300" },
];

const STATUSES: { id: Status; label: string }[] = [
  { id: "to_do", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "frozen", label: "Frozen" },
  { id: "completed", label: "Completed" },
];

const LIST_STATUS_OPTIONS: { id: Status; label: string }[] = [
  { id: "to_do", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "frozen", label: "Frozen" },
  { id: "completed", label: "Completed" },
];

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

const DIFFICULTY_FILTERS = ["1", "2", "3", "4", "5"];
const TIME_LEFT_MIN = 0;
const TIME_LEFT_MAX = 365;
const DURATION_MIN_HOURS = 5 / 60;
const DURATION_MAX_HOURS = 10;
const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 24;
const PLANNER_HOUR_HEIGHT = 56;
const PLANNER_SNAP_MINUTES = 15;
const PLANNER_EVENT_TYPES: { id: CalendarEventType; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "class", label: "Class" },
  { id: "meeting", label: "Meeting" },
  { id: "deadline", label: "Deadline" },
  { id: "milestone", label: "Milestone" },
  { id: "personal", label: "Personal" },
  { id: "travel", label: "Travel" },
];
const PLANNER_WEEKDAY_OPTIONS = [
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
  { id: 7, label: "Sunday" },
];
const APP_NAV_ITEMS: AppNavItem[] = [
  { id: "board", label: "Dashboard", icon: LayoutDashboard },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "list", label: "Tasks", icon: ListChecks },
  { id: "logger", label: "Logger", icon: Clock3 },
];

function statusLabel(id: Status) {
  return STATUSES.find((s) => s.id === id)?.label ?? id;
}

function priorityLabel(id: Priority) {
  return PRIORITIES.find((p) => p.id === id)?.label ?? id;
}

function statusPill(status?: string) {
  switch (status) {
    case "in_progress":
      return "border border-orange-100 bg-orange-50 text-orange-700";
    case "to_do":
      return "border border-slate-200 bg-slate-100 text-slate-700";
    case "frozen":
      return "border border-sky-100 bg-sky-50 text-sky-700";
    case "completed":
      return "border border-green-100 bg-green-50 text-green-700";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-600";
  }
}



function priorityRank(p: Priority | undefined) {
  if (p === "high") return 0;
  if (p === "normal") return 1;
  return 2;
}

function isCompleted(t: Task) {
  return t.status === "completed";
}

function applyTaskStatus(task: Task, status: Status, completedAt = new Date().toISOString()): Task {
  if (status === "completed") {
    return {
      ...task,
      status,
      completedAt: task.status === "completed" && task.completedAt ? task.completedAt : completedAt,
    };
  }

  return {
    ...task,
    status,
    completedAt: null,
  };
}

function isRecoverableCompleted(task: Task, nowMs: number) {
  if (task.status !== "completed") return false;
  if (!task.completedAt) return true;

  const completedMs = new Date(task.completedAt).getTime();
  if (!Number.isFinite(completedMs)) return true;

  return nowMs - completedMs < COMPLETED_RECOVERY_DAYS * DAY_MS;
}

function frozenTaskClass(task: Task) {
  return task.status === "frozen" ? "opacity-60" : "";
}

function frozenTitleClass(task: Task) {
  return task.status === "frozen" ? "italic text-slate-400" : "";
}

function openCount(list: Task[]) {
  return list.filter((t) => !isCompleted(t)).length;
}

function daysLeftFromISO(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);

  const due = new Date(Date.UTC(yyyy, mm - 1, dd));
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = due.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function timeLeftLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1d left";
  return `${days}d left`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function optionalFiniteNumber(raw: string) {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeAttentionWeights(raw: unknown): AttentionWeights {
  if (!raw || typeof raw !== "object") return DEFAULT_ATTENTION_WEIGHTS;
  const candidate = raw as Partial<Record<keyof AttentionWeights, unknown>>;
  return {
    time: Number.isFinite(Number(candidate.time)) ? Number(candidate.time) : DEFAULT_ATTENTION_WEIGHTS.time,
    duration: Number.isFinite(Number(candidate.duration)) ? Number(candidate.duration) : DEFAULT_ATTENTION_WEIGHTS.duration,
    difficulty: Number.isFinite(Number(candidate.difficulty)) ? Number(candidate.difficulty) : DEFAULT_ATTENTION_WEIGHTS.difficulty,
  };
}

function toggleFilterValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function taskMatchesTimeLeftFilter(task: Task, range: { min: number; max: number } | null) {
  if (!range) return true;
  if (!task.due) return false;

  const days = daysLeftFromISO(task.due);
  if (days === null) return false;

  const filterDays = Math.max(0, days);
  return filterDays >= range.min && filterDays <= range.max;
}

function taskMatchesDurationFilter(task: Task, range: { min: number; max: number } | null) {
  if (!range) return true;
  if (task.durationHrs == null || !Number.isFinite(task.durationHrs)) return false;
  return task.durationHrs >= range.min && task.durationHrs <= range.max;
}

function formatDurationFilterLabel(hours: number) {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }

  return Number.isInteger(hours) ? `${hours}h` : `${Number(hours.toFixed(2))}h`;
}

function formatHourInput(hours: number) {
  if (!Number.isFinite(hours)) return "";
  return String(hours);
}

function createTimeLogId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (
      Number(char) ^
      (Math.random() * 16) >> (Number(char) / 4)
    ).toString(16)
  );
}

function parseTimeLogHours(raw: string) {
  const hours = parseFloat(raw);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

function resolveTimeLogHours(raw: string, calculatedHours: number | null) {
  return calculatedHours !== null ? calculatedHours : parseTimeLogHours(raw);
}

function resolveClosedTimeLogHours(raw: string, calculatedHours: number | null, startTime: string, endTime: string) {
  if (startTime && endTime) return calculatedHours;
  return resolveTimeLogHours(raw, calculatedHours);
}

function todayISO() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return d.toISOString().slice(0, 10);
}

function isValidISODate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
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

function addDaysISO(iso: string, offset: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return d.toISOString().slice(0, 10);
}

function isoParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function addMonthsISO(iso: string, offset: number) {
  const { year, month, day } = isoParts(iso);
  const endOfTargetMonth = new Date(Date.UTC(year, month - 1 + offset + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(year, month - 1 + offset, Math.min(day, endOfTargetMonth)));
  return d.toISOString().slice(0, 10);
}

function addYearsISO(iso: string, offset: number) {
  const { year, month, day } = isoParts(iso);
  const endOfTargetMonth = new Date(Date.UTC(year + offset, month, 0)).getUTCDate();
  const d = new Date(Date.UTC(year + offset, month - 1, Math.min(day, endOfTargetMonth)));
  return d.toISOString().slice(0, 10);
}

function startOfLoggerWeek(iso: string) {
  const date = new Date(iso + "T00:00:00");
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDaysISO(iso, -mondayOffset);
}

function startOfPlannerWeek(iso: string) {
  return startOfLoggerWeek(iso);
}

function plannerWeekDaysForAnchor(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  const start = startOfPlannerWeek(anchor);

  return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
}

function plannerMonthDaysForAnchor(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  const monthStart = startOfLoggerMonth(anchor);
  const monthEnd = endOfLoggerMonth(anchor);
  const gridStart = startOfPlannerWeek(monthStart);
  const gridEnd = addDaysISO(startOfPlannerWeek(monthEnd), 6);
  const days: { date: string; isCurrentMonth: boolean }[] = [];
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

function plannerYearMonthsForAnchor(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  const year = isoParts(anchor).year;

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const month = monthIndex + 1;
    const monthAnchor = `${year}-${String(month).padStart(2, "0")}-01`;
    return {
      id: monthAnchor.slice(0, 7),
      anchorDate: monthAnchor,
      label: new Intl.DateTimeFormat("en", { month: "short" }).format(
        new Date(monthAnchor + "T00:00:00")
      ),
      days: plannerMonthDaysForAnchor(monthAnchor),
    };
  });
}

function formatPlannerMonthLabel(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(startOfLoggerMonth(anchor) + "T00:00:00")
  );
}

function formatPlannerYearLabel(anchorDate: string) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();
  return String(isoParts(anchor).year);
}

function formatPlannerWeekRange(days: string[]) {
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

function plannerHourLabels() {
  return Array.from({ length: PLANNER_END_HOUR - PLANNER_START_HOUR + 1 }, (_, index) => {
    const hour = PLANNER_START_HOUR + index;
    return `${String(hour).padStart(2, "0")}:00`;
  });
}

function localDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function eventLocalDate(timestamp?: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return localDateISO(date);
}

function formatPlannerEventTime(timestamp?: string | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function localMinutesFromTimestamp(timestamp?: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToTimeInput(minutes: number) {
  const clamped = clamp(Math.round(minutes), 0, 24 * 60);
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function isoFromLocalDateMinutes(date: string, minutes: number) {
  if (!isValidISODate(date)) return null;
  const { year, month, day } = isoParts(date);
  const parsed = new Date(year, month - 1, day, 0, minutes, 0, 0);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function zonedOffsetMs(utcMs: number, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const localAsUTC = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return localAsUTC - utcMs;
  } catch {
    return new Date().getTimezoneOffset() * -60000;
  }
}

function zonedDateTimeToUtcISO(date: string, time: string, timezone: string) {
  if (!isValidISODate(date) || timeToMinutes(time) === null) return null;
  const { year, month, day } = isoParts(date);
  const [hours, minutes] = time.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - zonedOffsetMs(utcMs, timezone);
  utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - zonedOffsetMs(utcMs, timezone);
  const parsed = new Date(utcMs);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function snapPlannerMinutes(minutes: number) {
  return Math.round(minutes / PLANNER_SNAP_MINUTES) * PLANNER_SNAP_MINUTES;
}

function timeInputFromTimestamp(timestamp?: string | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
}

type WeeklyRecurrenceRule = {
  freq: "weekly";
  weekday: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

function parseWeeklyRecurrenceRule(raw?: string | null): WeeklyRecurrenceRule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WeeklyRecurrenceRule>;
    if (
      parsed.freq !== "weekly" ||
      typeof parsed.weekday !== "number" ||
      !isValidISODate(parsed.startDate ?? "") ||
      !isValidISODate(parsed.endDate ?? "") ||
      typeof parsed.startTime !== "string" ||
      typeof parsed.endTime !== "string" ||
      timeToMinutes(parsed.startTime) === null ||
      timeToMinutes(parsed.endTime) === null ||
      typeof parsed.timezone !== "string"
    ) {
      return null;
    }
    return parsed as WeeklyRecurrenceRule;
  } catch {
    return null;
  }
}

function stringifyWeeklyRecurrenceRule(rule: WeeklyRecurrenceRule) {
  return JSON.stringify(rule);
}

function isoWeekday(iso: string) {
  const date = new Date(iso + "T00:00:00");
  return ((date.getDay() + 6) % 7) + 1;
}

function nextDateForIsoWeekday(startDate: string, weekday: number) {
  const current = isoWeekday(startDate);
  const offset = (weekday - current + 7) % 7;
  return addDaysISO(startDate, offset);
}

function defaultPlannerEventDraft(eventType: CalendarEventType, date: string): PlannerEventDraft {
  const resolvedDate = isValidISODate(date) ? date : todayISO();
  const allDay = eventType === "deadline" || eventType === "milestone";
  const timezone = browserTimezone();

  return {
    id: createCalendarEventId(),
    eventType,
    title: "",
    allDay,
    date: resolvedDate,
    endDate: resolvedDate,
    startTime: "09:00",
    endTime: eventType === "deadline" ? "" : "10:00",
    taskId: "",
    description: "",
    who: "",
    location: "",
    videoUrl: "",
    origin: "",
    destination: "",
    notes: "",
    timezone,
    repeat: "none",
    recurrenceWeekday: isoWeekday(resolvedDate),
    recurrenceStartDate: resolvedDate,
    recurrenceEndDate: resolvedDate,
    recurrenceApplyScope: "this",
    recurrenceParentId: null,
    recurrenceExceptionDate: null,
  };
}

function plannerDraftFromEvent(event: CalendarEvent): PlannerEventDraft {
  const metadata = event.metadata ?? {};
  const recurrenceRule = parseWeeklyRecurrenceRule(event.recurrenceRule);
  const parentId = parentIdForPlannerOccurrence(event);
  const occurrenceDate = occurrenceDateForPlannerEvent(event);
  const isVirtualOccurrence = isVirtualRecurringOccurrence(event);
  const startDate = event.allDay
    ? event.startDate ?? todayISO()
    : eventLocalDate(event.startAt) ?? todayISO();
  const endDate = event.allDay
    ? event.endDate ?? startDate
    : eventLocalDate(event.endAt) ?? startDate;

  return {
    id: isVirtualOccurrence ? createCalendarEventId() : event.id,
    eventType: event.eventType,
    title: event.title,
    allDay: event.allDay,
    date: startDate,
    endDate,
    startTime: timeInputFromTimestamp(event.startAt),
    endTime: timeInputFromTimestamp(event.endAt),
    taskId: event.taskId ?? "",
    description: event.description ?? "",
    who: typeof metadata.who === "string" ? metadata.who : "",
    location: event.location ?? "",
    videoUrl: event.videoUrl ?? "",
    origin: typeof metadata.origin === "string" ? metadata.origin : "",
    destination: typeof metadata.destination === "string" ? metadata.destination : "",
    notes: event.notes ?? "",
    timezone: event.timezone || browserTimezone(),
    repeat: recurrenceRule ? "weekly" : "none",
    recurrenceWeekday: recurrenceRule?.weekday ?? isoWeekday(startDate),
    recurrenceStartDate: recurrenceRule?.startDate ?? startDate,
    recurrenceEndDate: recurrenceRule?.endDate ?? endDate,
    recurrenceApplyScope: parentId ? "this" : "all",
    recurrenceParentId: parentId ?? null,
    recurrenceExceptionDate: occurrenceDate ?? null,
  };
}

function eventRequiresEndTime(eventType: CalendarEventType) {
  return eventType === "work" || eventType === "class" || eventType === "meeting" || eventType === "personal" || eventType === "travel";
}

function calendarEventFromDraft(draft: PlannerEventDraft): { event: CalendarEvent | null; error: string | null } {
  const title = draft.title.trim();
  if (!title) return { event: null, error: "Title is required." };
  if (!isValidISODate(draft.date)) return { event: null, error: "A valid date is required." };

  const allDay = draft.eventType === "milestone" ? true : draft.allDay;
  const endDate = isValidISODate(draft.endDate) ? draft.endDate : draft.date;
  const timezone = draft.timezone || browserTimezone();

  if (allDay) {
    if (endDate < draft.date) return { event: null, error: "End date cannot be before start date." };

    return {
      error: null,
      event: {
        id: draft.id,
        eventType: draft.eventType,
        title,
        description: draft.description.trim() || null,
        allDay: true,
        startAt: null,
        endAt: null,
        startDate: draft.date,
        endDate: endDate === draft.date ? null : endDate,
        timezone,
        taskId: draft.taskId || null,
        categoryId: null,
        location: draft.location.trim() || null,
        videoUrl: draft.videoUrl.trim() || null,
        notes: draft.notes.trim() || null,
        metadata: {
          who: draft.who.trim() || undefined,
          origin: draft.origin.trim() || undefined,
          destination: draft.destination.trim() || undefined,
        },
        recurrenceRule: null,
        recurrenceParentId: draft.recurrenceParentId,
        recurrenceExceptionDate: draft.recurrenceExceptionDate,
        recurrenceStatus: draft.recurrenceParentId ? "moved" : null,
      },
    };
  }

  if (!draft.startTime) return { event: null, error: "Start time is required." };
  if (eventRequiresEndTime(draft.eventType) && !draft.endTime) {
    return { event: null, error: "End time is required." };
  }

  const startAt = zonedDateTimeToUtcISO(draft.date, draft.startTime, timezone);
  const endAt = draft.endTime ? zonedDateTimeToUtcISO(endDate, draft.endTime, timezone) : null;
  if (!startAt) return { event: null, error: "Start time is invalid." };
  if (draft.endTime && !endAt) return { event: null, error: "End time is invalid." };
  if (endAt && Date.parse(endAt) <= Date.parse(startAt)) {
    return { event: null, error: "End time must be after start time." };
  }
  const weeklyRule =
    draft.eventType === "class" && draft.repeat === "weekly" && !draft.recurrenceParentId
      ? {
          freq: "weekly" as const,
          weekday: draft.recurrenceWeekday,
          startDate: draft.recurrenceStartDate,
          endDate: draft.recurrenceEndDate,
          startTime: draft.startTime,
          endTime: draft.endTime,
          timezone,
        }
      : null;

  if (weeklyRule) {
    if (
      weeklyRule.weekday < 1 ||
      weeklyRule.weekday > 7 ||
      !isValidISODate(weeklyRule.startDate) ||
      !isValidISODate(weeklyRule.endDate) ||
      weeklyRule.endDate < weeklyRule.startDate
    ) {
      return { event: null, error: "A valid weekly date range is required." };
    }
  }

  return {
    error: null,
    event: {
      id: draft.id,
      eventType: draft.eventType,
      title,
      description: draft.description.trim() || null,
      allDay: false,
      startAt,
      endAt,
      startDate: null,
      endDate: null,
      timezone,
      taskId: draft.taskId || null,
      categoryId: null,
      location: draft.location.trim() || null,
      videoUrl: draft.videoUrl.trim() || null,
      notes: draft.notes.trim() || null,
      metadata: {
        who: draft.who.trim() || undefined,
        origin: draft.origin.trim() || undefined,
        destination: draft.destination.trim() || undefined,
      },
      recurrenceRule: weeklyRule ? stringifyWeeklyRecurrenceRule(weeklyRule) : null,
      recurrenceParentId: draft.recurrenceParentId,
      recurrenceExceptionDate: draft.recurrenceExceptionDate,
      recurrenceStatus: draft.recurrenceParentId ? "moved" : null,
    },
  };
}

function plannerTimedEventSegment(event: CalendarEvent, day: string) {
  if (!event.startAt) return null;

  const start = new Date(event.startAt);
  if (!Number.isFinite(start.getTime())) return null;

  const fallbackEnd = new Date(start.getTime() + 60 * 60 * 1000);
  const parsedEnd = event.endAt ? new Date(event.endAt) : fallbackEnd;
  const end = Number.isFinite(parsedEnd.getTime()) && parsedEnd > start ? parsedEnd : fallbackEnd;
  const dayStart = new Date(day + "T00:00:00");
  const visibleStart = new Date(dayStart.getTime() + PLANNER_START_HOUR * 60 * 60 * 1000);
  const visibleEnd = new Date(dayStart.getTime() + PLANNER_END_HOUR * 60 * 60 * 1000);
  const segmentStart = new Date(Math.max(start.getTime(), visibleStart.getTime()));
  const segmentEnd = new Date(Math.min(end.getTime(), visibleEnd.getTime()));

  if (segmentEnd <= segmentStart) return null;

  const startMinutes = (segmentStart.getTime() - dayStart.getTime()) / 60000;
  const endMinutes = (segmentEnd.getTime() - dayStart.getTime()) / 60000;

  return {
    event,
    startMinutes,
    endMinutes,
    top: ((startMinutes - PLANNER_START_HOUR * 60) / 60) * PLANNER_HOUR_HEIGHT,
    height: Math.max(26, ((endMinutes - startMinutes) / 60) * PLANNER_HOUR_HEIGHT),
  };
}

function layoutPlannerTimedEvents(events: CalendarEvent[], day: string) {
  const segments = events
    .map((event) => plannerTimedEventSegment(event, day))
    .filter((segment): segment is NonNullable<ReturnType<typeof plannerTimedEventSegment>> =>
      Boolean(segment)
    )
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
  const columnEnds: number[] = [];
  const positioned = segments.map((segment) => {
    const columnIndex = columnEnds.findIndex((end) => end <= segment.startMinutes);
    const resolvedColumnIndex = columnIndex === -1 ? columnEnds.length : columnIndex;
    columnEnds[resolvedColumnIndex] = segment.endMinutes;
    return { ...segment, columnIndex: resolvedColumnIndex };
  });
  const columnCount = Math.max(1, columnEnds.length);

  return positioned.map((segment) => ({ ...segment, columnCount }));
}

function calendarEventIntersectsWeek(event: CalendarEvent, weekStart: string, weekEnd: string) {
  if (event.allDay) {
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return Boolean(start && end && start <= weekEnd && end >= weekStart);
  }

  const start = eventLocalDate(event.startAt);
  const end = eventLocalDate(event.endAt) || start;
  return Boolean(start && end && start <= weekEnd && end >= weekStart);
}

function calendarEventIntersectsDay(event: CalendarEvent, day: string) {
  if (event.allDay) {
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return Boolean(start && end && start <= day && end >= day);
  }

  const start = eventLocalDate(event.startAt);
  const end = eventLocalDate(event.endAt) || start;
  return Boolean(start && end && start <= day && end >= day);
}

function plannerMonthEventPrefix(event: CalendarEvent, day: string) {
  if (event.allDay) return "";
  return eventLocalDate(event.startAt) === day ? formatPlannerEventTime(event.startAt) : "";
}

function eventDateSpan(event: CalendarEvent) {
  if (event.allDay) {
    const start = event.startDate;
    const end = event.endDate || event.startDate;
    return start && end ? { start, end } : null;
  }

  const start = eventLocalDate(event.startAt);
  const end = eventLocalDate(event.endAt) || start;
  return start && end ? { start, end } : null;
}

function recurringOccurrenceMetadata(parent: CalendarEvent, occurrenceDate: string) {
  return {
    ...(parent.metadata ?? {}),
    virtualOccurrence: true,
    parentEventId: parent.id,
    occurrenceDate,
  };
}

function isVirtualRecurringOccurrence(event: CalendarEvent) {
  return event.metadata?.virtualOccurrence === true && typeof event.metadata.parentEventId === "string";
}

function parentIdForPlannerOccurrence(event: CalendarEvent) {
  return typeof event.metadata?.parentEventId === "string" ? event.metadata.parentEventId : event.recurrenceParentId;
}

function occurrenceDateForPlannerEvent(event: CalendarEvent) {
  return typeof event.metadata?.occurrenceDate === "string"
    ? event.metadata.occurrenceDate
    : event.recurrenceExceptionDate;
}

function exceptionEventForPlannerOccurrence(event: CalendarEvent) {
  const parentId = parentIdForPlannerOccurrence(event);
  const occurrenceDate = occurrenceDateForPlannerEvent(event);
  if (!parentId || !occurrenceDate) return event;

  const metadata = { ...(event.metadata ?? {}) };
  delete metadata.virtualOccurrence;
  delete metadata.parentEventId;
  delete metadata.occurrenceDate;

  return {
    ...event,
    id: isVirtualRecurringOccurrence(event) ? createCalendarEventId() : event.id,
    recurrenceRule: null,
    recurrenceParentId: parentId,
    recurrenceExceptionDate: occurrenceDate,
    recurrenceStatus: "moved",
    metadata,
  };
}

function expandRecurringPlannerEvents(events: CalendarEvent[], rangeStart: string, rangeEnd: string) {
  const exceptionsByParentAndDate = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    if (!event.recurrenceParentId || !event.recurrenceExceptionDate) return;
    const key = `${event.recurrenceParentId}:${event.recurrenceExceptionDate}`;
    exceptionsByParentAndDate.set(key, [...(exceptionsByParentAndDate.get(key) ?? []), event]);
  });

  const expanded: CalendarEvent[] = [];

  events.forEach((event) => {
    if (event.recurrenceParentId) {
      if (event.recurrenceStatus !== "cancelled") expanded.push(event);
      return;
    }

    const rule = parseWeeklyRecurrenceRule(event.recurrenceRule);
    if (!rule) {
      expanded.push(event);
      return;
    }

    const start = rule.startDate > rangeStart ? rule.startDate : rangeStart;
    const end = rule.endDate < rangeEnd ? rule.endDate : rangeEnd;
    if (start > end) return;

    let occurrenceDate = nextDateForIsoWeekday(start, rule.weekday);
    while (occurrenceDate <= end) {
      const exceptionKey = `${event.id}:${occurrenceDate}`;
      const exceptions = exceptionsByParentAndDate.get(exceptionKey) ?? [];
      const hasCancellation = exceptions.some((exception) => exception.recurrenceStatus === "cancelled");

      if (!hasCancellation && !exceptions.some((exception) => exception.recurrenceStatus === "moved")) {
        const startAt = zonedDateTimeToUtcISO(occurrenceDate, rule.startTime, rule.timezone);
        const endAt = zonedDateTimeToUtcISO(occurrenceDate, rule.endTime, rule.timezone);
        if (startAt && endAt) {
          expanded.push({
            ...event,
            id: `${event.id}::${occurrenceDate}`,
            startAt,
            endAt,
            startDate: null,
            endDate: null,
            recurrenceParentId: event.id,
            recurrenceExceptionDate: occurrenceDate,
            recurrenceStatus: "active",
            metadata: recurringOccurrenceMetadata(event, occurrenceDate),
          });
        }
      }

      occurrenceDate = addDaysISO(occurrenceDate, 7);
    }
  });

  return expanded;
}

const IMPORT_MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const IMPORT_WEEKDAYS: Record<string, number> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 7,
  sun: 7,
};

function smartImportContextYear(anchorDate: string) {
  return isoParts(isValidISODate(anchorDate) ? anchorDate : todayISO()).year;
}

function smartImportDate(year: number, monthName: string, dayText: string) {
  const month = IMPORT_MONTHS[monthName.toLowerCase()];
  const day = Number(dayText.replace(/(?:st|nd|rd|th)$/i, ""));
  if (!month || !Number.isFinite(day)) return "";
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : "";
}

function smartImportTimeToken(token: string, inheritedMeridiem?: "am" | "pm") {
  const match = token.trim().toLowerCase().match(/^(\d{1,2})(?:(?::|\.)(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = (match[3] as "am" | "pm" | undefined) ?? inheritedMeridiem;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function smartImportTimeRange(text: string) {
  const match = text.match(
    /\b(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)\b/i
  );
  if (!match) return { startTime: "", endTime: "" };

  const endMeridiem = match[2].toLowerCase().match(/(am|pm)/)?.[1] as "am" | "pm" | undefined;
  const startTime = smartImportTimeToken(match[1], endMeridiem);
  const endTime = smartImportTimeToken(match[2]);

  return { startTime: startTime ?? "", endTime: endTime ?? "" };
}

function smartImportSingleTime(text: string) {
  const match = text.match(/\b(?:at\s+)?(\d{1,2}(?:(?::|\.)\d{2})\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
  return match ? smartImportTimeToken(match[1]) ?? "" : "";
}

function inferSmartImportEventType(text: string): CalendarEventType {
  const lower = text.toLowerCase();
  if (/\b(class|studio|seminar|lecture)\b/.test(lower)) return "class";
  if (/\b(meeting|tutorial|supervision)\b/.test(lower)) return "meeting";
  if (/\b(deadline|submission|due)\b/.test(lower)) return "deadline";
  if (/\b(flight|train|travel)\b/.test(lower)) return "travel";
  if (/\b(dentist|doctor|appointment)\b/.test(lower)) return "personal";
  if (/\b(london|paris|madrid|zurich|barcelona|rome|berlin)\b/.test(lower) && /\b\d{1,2}\s*[-–]\s*\d{1,2}\s+[a-z]+/i.test(text)) {
    return "travel";
  }
  return "personal";
}

function smartImportTitle(text: string) {
  return text
    .replace(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b.*$/i, "")
    .replace(/\bbetween\s+.*$/i, "")
    .replace(/\bfrom\s+.*$/i, "")
    .replace(/\bat\s+\d{1,2}.*$/i, "")
    .replace(/\b\d{1,2}\s*[-–]\s*\d{1,2}\s+[a-z]+.*$/i, "")
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}.*$/i, "")
    .replace(/\b\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}.*$/i, "")
    .trim();
}

function smartImportOrdinalDateMatch(text: string) {
  return text.match(
    /\b(?:(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i
  );
}

function smartImportRoute(text: string) {
  const airportRoute = text.match(/\b([A-Z]{3})\s*(?:to|→|->|–|-)\s*([A-Z]{3})\b/);
  if (airportRoute) {
    return { origin: airportRoute[1], destination: airportRoute[2], confident: true };
  }

  const namedRoute = text.match(/\b([A-Z][A-Za-z]+)\s+to\s+([A-Z][A-Za-z]+)\b/);
  if (namedRoute) {
    return { origin: namedRoute[1], destination: namedRoute[2], confident: false };
  }

  return { origin: "", destination: "", confident: false };
}

function smartImportTravelTitle(text: string, origin: string, destination: string) {
  if (/\bflight\b/i.test(text) && origin && destination) return `Flight ${origin} → ${destination}`;
  if (/\btrain\b/i.test(text) && origin && destination) return `Train ${origin} → ${destination}`;
  if (origin && destination) return `${origin} → ${destination}`;
  return smartImportTitle(text);
}

function smartImportLocation(text: string) {
  const match = text.match(/\b(?:room|rm)\s+([a-z0-9 -]+)/i);
  if (match) return `Room ${match[1].trim().replace(/\s+(between|from|until|every)\b.*$/i, "")}`;
  const inMatch = text.match(/\bin\s+([^,]+?)(?=\s+(?:from|between|until|every|at)\b|$)/i);
  return inMatch ? inMatch[1].trim() : "";
}

function splitSmartImportInput(raw: string) {
  return raw
    .split(/\n+|;/)
    .flatMap((line) =>
      line.split(/\s+and\s+(?=[A-Z][^,\n]*(?:\bevery\b|\bclass\b|\bmeeting\b|\bdentist\b|\bdeadline\b|\bstudio\b|\bflight\b|\btrain\b|\btravel\b|\b[A-Z][a-z]+\s+\d{1,2}\b|\b[A-Z][a-z]+\s+\d{1,2}\s*[-–]\s*\d{1,2}\b))/)
    )
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSmartScheduleImport(raw: string, contextYear: number): SmartImportProposal[] {
  return splitSmartImportInput(raw).map((sourceText) => {
    const lower = sourceText.toLowerCase();
    const eventType = inferSmartImportEventType(sourceText);
    const weeklyMatch = lower.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/i);
    const recurrence: SmartImportRecurrence = weeklyMatch ? "weekly" : "none";
    const weekday = weeklyMatch ? IMPORT_WEEKDAYS[weeklyMatch[1].toLowerCase()] ?? 1 : 1;
    const betweenMatch = sourceText.match(
      /\b(?:between|from)\s+([a-z]+)\s+(\d{1,2})\s+(?:and|until|to)\s+([a-z]+)\s+(\d{1,2})/i
    );
    const dateRangeMatch = sourceText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\b/i);
    const ordinalDateMatch = smartImportOrdinalDateMatch(sourceText);
    const singleDateMatch = sourceText.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\b/i
    );
    const timeRange = smartImportTimeRange(sourceText);
    const singleTime = timeRange.startTime ? "" : smartImportSingleTime(sourceText);
    const hasSpecificTime = Boolean(timeRange.startTime || singleTime);
    const allDay =
      (eventType === "travel" && !hasSpecificTime) ||
      eventType === "milestone" ||
      (eventType === "deadline" && !hasSpecificTime);
    const route = smartImportRoute(sourceText);
    const warnings: string[] = [];
    let date = "";
    let endDate = "";

    if (betweenMatch) {
      date = smartImportDate(contextYear, betweenMatch[1], betweenMatch[2]);
      endDate = smartImportDate(contextYear, betweenMatch[3], betweenMatch[4]);
    } else if (dateRangeMatch) {
      date = smartImportDate(contextYear, dateRangeMatch[3], dateRangeMatch[1]);
      endDate = smartImportDate(contextYear, dateRangeMatch[3], dateRangeMatch[2]);
    } else if (ordinalDateMatch) {
      date = smartImportDate(contextYear, ordinalDateMatch[3], ordinalDateMatch[2]);
      endDate = date;
    } else if (singleDateMatch) {
      date = smartImportDate(contextYear, singleDateMatch[1], singleDateMatch[2]);
      endDate = date;
    }

    const statedWeekday = ordinalDateMatch?.[1]?.toLowerCase();
    if (statedWeekday && date) {
      const expectedWeekday = IMPORT_WEEKDAYS[statedWeekday];
      if (expectedWeekday && isoWeekday(date) !== expectedWeekday) {
        warnings.push("Weekday does not match parsed date");
      }
    }

    if (recurrence === "weekly" && !date) warnings.push("Date range missing");
    if (recurrence === "weekly" && date && !endDate) warnings.push("Series end missing");
    if (!date && recurrence === "none") warnings.push("Date missing");
    if (!allDay && !timeRange.startTime && !singleTime) warnings.push("Start time missing");
    if (!allDay && !timeRange.endTime) warnings.push("End time missing");
    if (timeRange.startTime && timeRange.endTime && timeRange.endTime <= timeRange.startTime) {
      warnings.push("End time needs review");
    }

    const title =
      eventType === "travel"
        ? smartImportTravelTitle(sourceText, route.origin, route.destination)
        : smartImportTitle(sourceText) || sourceText.split(/\s+/).slice(0, 4).join(" ");
    if (!title) warnings.push("Title missing");

    return {
      id: createCalendarEventId(),
      sourceText,
      include: warnings.length === 0,
      title,
      eventType,
      recurrence,
      allDay,
      date,
      endDate: endDate || date,
      weekday,
      startTime: timeRange.startTime || singleTime,
      endTime: timeRange.endTime,
      location: smartImportLocation(sourceText),
      origin: route.origin,
      destination: route.destination,
      notes: "",
      warnings,
    };
  });
}

function validateSmartImportProposal(proposal: SmartImportProposal) {
  const warnings: string[] = [];
  if (!proposal.title.trim()) warnings.push("Title missing");
  if (!isValidISODate(proposal.date)) warnings.push("Date missing");
  if (proposal.endDate && !isValidISODate(proposal.endDate)) warnings.push("End date invalid");
  if (proposal.endDate && proposal.date && proposal.endDate < proposal.date) warnings.push("End date before start date");
  if (proposal.recurrence === "weekly") {
    if (proposal.weekday < 1 || proposal.weekday > 7) warnings.push("Weekday missing");
    if (!isValidISODate(proposal.endDate)) warnings.push("Series end missing");
  }
  if (!proposal.allDay) {
    if (!proposal.startTime || timeToMinutes(proposal.startTime) === null) warnings.push("Start time missing");
    if (!proposal.endTime || timeToMinutes(proposal.endTime) === null) warnings.push("End time missing");
    if (proposal.startTime && proposal.endTime && proposal.endTime <= proposal.startTime) {
      warnings.push("End time must be after start time");
    }
  }
  return warnings;
}

function smartImportProposalToCalendarEvent(
  proposal: SmartImportProposal,
  timezone: string
): CalendarEvent | null {
  const warnings = validateSmartImportProposal(proposal);
  if (warnings.length) return null;

  const allDay = proposal.allDay;
  const startAt = allDay ? null : zonedDateTimeToUtcISO(proposal.date, proposal.startTime, timezone);
  const endAt = allDay ? null : zonedDateTimeToUtcISO(proposal.date, proposal.endTime, timezone);
  if (!allDay && (!startAt || !endAt)) return null;

  const recurrenceRule =
    proposal.recurrence === "weekly"
      ? stringifyWeeklyRecurrenceRule({
          freq: "weekly",
          weekday: proposal.weekday,
          startDate: proposal.date,
          endDate: proposal.endDate,
          startTime: proposal.startTime,
          endTime: proposal.endTime,
          timezone,
        })
      : null;

  return {
    id: proposal.savedEventId ?? createCalendarEventId(),
    eventType: proposal.eventType,
    title: proposal.title.trim(),
    description: null,
    allDay,
    startAt,
    endAt,
    startDate: allDay ? proposal.date : null,
    endDate: allDay && proposal.endDate !== proposal.date ? proposal.endDate : null,
    timezone,
    taskId: null,
    categoryId: null,
    location: proposal.location.trim() || null,
    videoUrl: null,
    notes: proposal.notes.trim() || null,
    metadata: {
      importedFrom: "smart_schedule_import",
      origin: proposal.origin.trim() || undefined,
      destination: proposal.destination.trim() || undefined,
    },
    recurrenceRule,
    recurrenceParentId: null,
    recurrenceExceptionDate: null,
    recurrenceStatus: null,
  };
}

function smartImportDuplicateWarning(proposal: SmartImportProposal, events: CalendarEvent[]) {
  const candidateTitle = proposal.title.trim().toLowerCase();
  if (!candidateTitle || !proposal.date) return false;

  return events.some((event) => {
    const eventTitle = event.title.trim().toLowerCase();
    const sameTitle = eventTitle === candidateTitle || eventTitle.includes(candidateTitle) || candidateTitle.includes(eventTitle);
    if (!sameTitle) return false;

    const rule = parseWeeklyRecurrenceRule(event.recurrenceRule);
    if (proposal.recurrence === "weekly" || rule) {
      return Boolean(
        proposal.recurrence === "weekly" &&
          rule &&
          rule.weekday === proposal.weekday &&
          rule.startTime === proposal.startTime &&
          rule.endTime === proposal.endTime
      );
    }

    const eventDate = event.allDay ? event.startDate : eventLocalDate(event.startAt);
    const eventTime = event.allDay ? "" : timeInputFromTimestamp(event.startAt);
    return eventDate === proposal.date && eventTime === proposal.startTime;
  });
}

function plannerYearMarkerTone(eventType: CalendarEventType) {
  if (eventType === "work") return "bg-[#2098D4] text-white";
  if (eventType === "class") return "bg-[#7045D8] text-white";
  if (eventType === "meeting") return "bg-[#FFC515] text-slate-900";
  if (eventType === "deadline") return "bg-[#F04A2D] text-white";
  if (eventType === "milestone") return "bg-[#FF8A1F] text-white";
  if (eventType === "travel") return "bg-[#43D4DC] text-slate-900";
  return "bg-[#43C995] text-slate-900";
}

function plannerYearPillTone(eventType: CalendarEventType) {
  if (eventType === "work") return "border-[#2098D4]/30 bg-[#2098D4]/12 text-[#1775A5]";
  if (eventType === "class") return "border-[#7045D8]/30 bg-[#7045D8]/12 text-[#5632B0]";
  if (eventType === "meeting") return "border-[#FFC515]/40 bg-[#FFC515]/18 text-[#9A7200]";
  if (eventType === "deadline") return "border-[#F04A2D]/35 bg-[#F04A2D]/14 text-[#B93822]";
  if (eventType === "milestone") return "border-[#FF8A1F]/35 bg-[#FF8A1F]/14 text-[#B85C0B]";
  if (eventType === "travel") return "border-[#43D4DC]/40 bg-[#43D4DC]/14 text-[#16858C]";
  return "border-[#43C995]/35 bg-[#43C995]/14 text-[#1F805B]";
}

function PlannerYearMarkerIcon({ eventType }: { eventType: CalendarEventType }) {
  if (eventType === "work") return <BriefcaseBusiness className="h-2.5 w-2.5" aria-hidden="true" />;
  if (eventType === "class") return <GraduationCap className="h-2.5 w-2.5" aria-hidden="true" />;
  if (eventType === "meeting") return <Users className="h-2.5 w-2.5" aria-hidden="true" />;
  if (eventType === "deadline") return <Flag className="h-2.5 w-2.5" aria-hidden="true" />;
  if (eventType === "milestone") return <Diamond className="h-2.5 w-2.5" aria-hidden="true" />;
  if (eventType === "travel") return <Plane className="h-2.5 w-2.5" aria-hidden="true" />;
  return <UserRound className="h-2.5 w-2.5" aria-hidden="true" />;
}

function plannerDeadlineTone(task: Task) {
  return task.status === "frozen"
    ? "border-[#F04A2D]/25 bg-[#F04A2D]/10 text-[#B93822]"
    : "border-[#F04A2D]/30 bg-[#F04A2D]/12 text-[#B93822]";
}

function plannerWorkResolutionStatus(event: CalendarEvent): PlannerWorkResolutionStatus | null {
  const status = event.metadata?.plannerResolutionStatus;
  return status === "logged" || status === "skipped" ? status : null;
}

function withPlannerWorkResolution(
  event: CalendarEvent,
  status: PlannerWorkResolutionStatus,
  loggedTimeLogId: string | null = null
): CalendarEvent {
  const metadata: Record<string, unknown> = {
    ...(event.metadata ?? {}),
    plannerResolutionStatus: status,
    resolvedAt: new Date().toISOString(),
  };
  if (loggedTimeLogId) {
    metadata.loggedTimeLogId = loggedTimeLogId;
  } else {
    delete metadata.loggedTimeLogId;
  }

  return {
    ...event,
    metadata,
  };
}

function isPastUnresolvedPlannerWorkEvent(event: CalendarEvent, nowMs: number | null) {
  if (event.eventType !== "work" || event.allDay || !event.startAt || !event.endAt || !nowMs) {
    return false;
  }

  if (plannerWorkResolutionStatus(event)) return false;

  const endMs = Date.parse(event.endAt);
  return Number.isFinite(endMs) && endMs < nowMs;
}

function plannedWorkTimeLogFromEvent(event: CalendarEvent): TimeLog | null {
  if (event.eventType !== "work" || !event.taskId || !event.startAt || !event.endAt) return null;

  const date = eventLocalDate(event.startAt);
  const startTime = timeInputFromTimestamp(event.startAt);
  const endTime = timeInputFromTimestamp(event.endAt);
  const startMs = Date.parse(event.startAt);
  const endMs = Date.parse(event.endAt);
  const hours = (endMs - startMs) / (60 * 60 * 1000);

  if (!date || !startTime || !endTime || !Number.isFinite(hours) || hours <= 0) return null;

  return {
    id: createTimeLogId(),
    taskId: event.taskId,
    date,
    startTime,
    endTime,
    hours,
    note: `Logged from planned work: ${event.title}`,
  };
}

function plannerDateItemSortValue(item: PlannerDateItem) {
  if (item.sourceType === "task_deadline") return `0-${item.task.title}`;
  const event = item.event;
  const allDayRank = event.allDay ? 1 : 2;
  return `${allDayRank}-${event.startAt ?? event.startDate ?? ""}-${event.title}`;
}

function plannerItemsForDate(
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

function plannerItemTitle(item: PlannerDateItem) {
  return item.sourceType === "task_deadline" ? item.task.title : item.event.title;
}

function plannerItemPrefix(item: PlannerDateItem, date: string) {
  if (item.sourceType === "task_deadline") return "";
  return plannerMonthEventPrefix(item.event, date);
}

function plannerYearItemEventType(item: PlannerDateItem): CalendarEventType {
  return item.sourceType === "task_deadline" ? "deadline" : item.event.eventType;
}

function plannerItemDateSpan(item: PlannerDateItem) {
  if (item.sourceType === "task_deadline") return { start: item.date, end: item.date };
  return eventDateSpan(item.event);
}

function plannerAllDaySpansForDays(days: string[], items: PlannerDateItem[]): PlannerAllDaySpan[] {
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

function plannerAllDaySpanKey(span: PlannerAllDaySpan, prefix: string) {
  const id = span.item.sourceType === "calendar_event" ? span.item.event.id : span.item.task.id;
  return `${prefix}-${id}-${span.startIndex}-${span.span}`;
}

function startOfLoggerMonth(iso: string) {
  const { year, month } = isoParts(iso);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function endOfLoggerMonth(iso: string) {
  const { year, month } = isoParts(iso);
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

function startOfLoggerYear(iso: string) {
  return `${iso.slice(0, 4)}-01-01`;
}

function endOfLoggerYear(iso: string) {
  return `${iso.slice(0, 4)}-12-31`;
}

function loggerDateRangeForMode(
  mode: LoggerRangeMode,
  anchorDate: string,
  customStartDate: string,
  customEndDate: string
) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();

  if (mode === "week") {
    const start = startOfLoggerWeek(anchor);
    return { start, end: addDaysISO(start, 6) };
  }

  if (mode === "month") {
    return { start: startOfLoggerMonth(anchor), end: endOfLoggerMonth(anchor) };
  }

  if (mode === "year") {
    return { start: startOfLoggerYear(anchor), end: endOfLoggerYear(anchor) };
  }

  const start = isValidISODate(customStartDate) ? customStartDate : anchor;
  const end = isValidISODate(customEndDate) ? customEndDate : start;
  return start <= end ? { start, end } : { start: end, end: start };
}

function loggerDaysForRange(range: { start: string; end: string }) {
  if (!isValidISODate(range.start) || !isValidISODate(range.end) || range.start > range.end) {
    return [];
  }

  const days: string[] = [];
  let cursor = range.start;

  while (cursor <= range.end) {
    days.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }

  return days;
}

function formatLoggerPeriod(
  mode: LoggerRangeMode,
  range: { start: string; end: string },
  anchorDate: string
) {
  const dateFormatter = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

  if (mode === "week") {
    const start = new Date(range.start + "T00:00:00");
    const end = new Date(range.end + "T00:00:00");
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return `${start.getDate()}-${end.getDate()} ${new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
      }).format(end)}`;
    }
    return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
  }

  if (mode === "month") {
    return monthFormatter.format(new Date(range.start + "T00:00:00"));
  }

  if (mode === "year") {
    return anchorDate.slice(0, 4);
  }

  return `${dateFormatter.format(new Date(range.start + "T00:00:00"))} - ${dateFormatter.format(
    new Date(range.end + "T00:00:00")
  )}`;
}

function timeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function durationHoursFromTimes(startTime: string, endTime: string) {
  return calculateTimeLogDurationHours("2000-01-01", startTime, "2000-01-01", endTime);
}

function formatDuration(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatLoggedTime(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "0m";
  return formatDuration(hours);
}

function formatLoggerDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

function formatLoggerWeekday(iso: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(iso + "T00:00:00"));
}

function formatOpenSessionStarted(log: TimeLog) {
  const weekday = formatLoggerWeekday(log.date);
  return `Started ${weekday} ${log.startTime ?? ""}`.trim();
}

function loggerCellTone(hours: number) {
  if (hours <= 0) return "bg-transparent text-transparent";
  if (hours < 1) return "bg-violet-50/70 text-violet-700";
  if (hours < 2) return "bg-violet-100/80 text-violet-800";
  if (hours < 4) return "bg-violet-200/80 text-violet-900";
  return "bg-violet-300/80 text-violet-950";
}

function loggerCountCellTone(count: number) {
  if (count <= 0) return "bg-transparent text-transparent";
  if (count === 1) return "bg-violet-50/70 text-violet-700";
  if (count === 2) return "bg-violet-100/80 text-violet-800";
  if (count <= 4) return "bg-violet-200/80 text-violet-900";
  return "bg-violet-300/80 text-violet-950";
}

function formatGridHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
}

function calendarCellTone(hours: number) {
  if (hours <= 0) return "border border-slate-100 bg-white";
  if (hours < 1) return "bg-violet-50";
  if (hours < 2) return "bg-violet-100";
  if (hours < 4) return "bg-violet-200";
  if (hours < 6) return "bg-violet-300";
  return "bg-violet-400";
}

function courseBarClass(courseId?: string) {
  switch (courseId) {
    case "robotics_studio":
    case "studio_work":
      return "bg-emerald-500";
    case "computational_design":
    case "design_research":
      return "bg-violet-500";
    case "thesis":
      return "bg-sky-500";
    case "the_yas_project":
    case "practice":
      return "bg-cyan-500";
    case "project_vernacular":
    case "field_notes":
      return "bg-lime-500";
    case "project_bloomberg":
    case "client_project":
      return "bg-amber-500";
    default:
      return "bg-slate-400";
  }
}

function normalizeTimeLogs(value: unknown): TimeLog[] {
  if (!Array.isArray(value)) return [];

  const logs: TimeLog[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Partial<TimeLog>;
    const taskId = String(raw.taskId ?? "");
    const date = typeof raw.date === "string" ? raw.date : "";
    const startTime = timeLogTimeToMinutes(raw.startTime) !== null ? raw.startTime : undefined;
    const endDate = typeof raw.endDate === "string" && isTimeLogISODate(raw.endDate) ? raw.endDate : null;
    const endTime = timeLogTimeToMinutes(raw.endTime) !== null ? raw.endTime : undefined;
    const hours = raw.hours === null ? null : Number(raw.hours ?? 0);

    if (!taskId || taskId.startsWith("logger-") || !isTimeLogISODate(date)) {
      continue;
    }

    const next: TimeLog = {
      id: String(raw.id ?? uid()),
      taskId,
      date,
      startTime,
      endDate,
      endTime,
      hours,
      note: typeof raw.note === "string" ? raw.note : "",
    };

    const hasAnyTime = Boolean(next.startTime || next.endTime);
    const isValidTimedClosedLog =
      isClosedTimeLog(next) &&
      (!hasAnyTime ||
        (Boolean(next.startTime) &&
          Boolean(next.endTime) &&
          calculateTimeLogDurationHours(next.date, next.startTime ?? "", endDate ?? next.date, next.endTime ?? "") !== null));

    if (isValidTimedClosedLog || isOpenTimeLog(next)) {
      logs.push(next);
    }
  }

  return logs;
}

function backupStorageKey(date: Date) {
  return `${BACKUP_KEY_PREFIX}${date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "")}`;
}

function getLocalBackupKeys() {
  if (typeof window === "undefined") return [];
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(BACKUP_KEY_PREFIX))
    .sort()
    .reverse();
}

function createLocalBackup(tasks: Task[], timeLogs: TimeLog[] = []) {
  if (typeof window === "undefined") return null;

  const createdAt = new Date().toISOString();
  const snapshot: BackupSnapshot = { createdAt, tasks, timeLogs };
  const key = backupStorageKey(new Date(createdAt));
  localStorage.setItem(key, JSON.stringify(snapshot));

  const keys = getLocalBackupKeys();
  for (const oldKey of keys.slice(20)) {
    localStorage.removeItem(oldKey);
  }

  return { key, snapshot };
}

function loadLocalTaskCache() {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(TASKS_LOCAL_CACHE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((task) => normalizeTask(task));
  } catch (error) {
    console.warn("Failed to load local task cache:", error);
    return [];
  }
}

function saveLocalTaskCache(tasks: Task[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TASKS_LOCAL_CACHE_KEY, JSON.stringify(tasks));
}

function getLatestLocalBackupLabel() {
  if (typeof window === "undefined") return { label: "Never", count: 0 };
  const keys = getLocalBackupKeys();
  if (!keys.length) return { label: "Never", count: 0 };

  const raw = localStorage.getItem(keys[0]);
  if (!raw) return { label: "Unknown", count: keys.length };

  try {
    const parsed = JSON.parse(raw) as Partial<BackupSnapshot>;
    return {
      label: parsed.createdAt ? new Date(parsed.createdAt).toLocaleString() : "Unknown",
      count: keys.length,
    };
  } catch {
    return { label: "Unknown", count: keys.length };
  }
}

function modeToStoredTab(mode: ViewMode) {
  return mode === "board" ? "dashboard" : mode;
}

function storedTabToMode(value: string | null): ViewMode {
  if (value === "planner" || value === "list" || value === "logger") return value;
  return "board";
}

function modeLabel(mode: ViewMode) {
  return APP_NAV_ITEMS.find((item) => item.id === mode)?.label ?? "Dashboard";
}

function modeSubtitle(mode: ViewMode) {
  if (mode === "board") return "What needs attention, then everything by category.";
  if (mode === "planner") return "Calendar structure and scheduled blocks.";
  if (mode === "logger") return "Actual time spent and working cadence.";
  return "Search, filter and maintain task details.";
}

function daysUntil(dueISO?: string | null) {
  if (!dueISO) return null;
  const today = new Date();
  const due = new Date(dueISO + "T00:00:00");
  const ms = due.getTime() - new Date(today.toDateString()).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function urgencyScore(
  t: {
  due?: string | null;
  deadlineMode?: DeadlineMode;
  visionHorizon?: VisionHorizon | null;
  durationHrs?: number | null;
  difficulty?: number | null;
  priority?: Priority;
  mode?: "practice" | "task";
  lastPracticedAt?: number | string;
  },
  weights: AttentionWeights = DEFAULT_ATTENTION_WEIGHTS
) {
  const d = daysUntil(t.due);
  const dur = t.durationHrs ?? 0;
  const diff = t.difficulty ?? 1;
  // adjust difficulty

if (t.mode === "practice") {
  const last =
    typeof t.lastPracticedAt === "string"
      ? daysUntil(t.lastPracticedAt)
      : 30;

  return clamp(last * 3, 0, 60);
}


  // adjust priority
  const priorityScore =
  t.priority === "high" ? 100 : t.priority === "normal" ? 50 : 10;

  // time pressure: 0..70
  const visionPressure =
    t.deadlineMode === "vision"
      ? t.visionHorizon === "short"
        ? 30
        : t.visionHorizon === "mid"
          ? 15
          : t.visionHorizon === "long"
            ? 7
            : 0
      : 0;
  const timePressure =
    d === null
      ? visionPressure
      : d <= 3
      ? 80
      : d >= 14
      ? 5
      : clamp((14 - d) * 7, 5, 80);

  // workload: 0..20 (cap at 6h)
  const workload = clamp((dur / 6) * 20, 0, 20);

  // difficulty: 0..10
  const difficultyScore = clamp(((diff - 1) / 4) * 10, 0, 10);

  const totalWeight =
  weights.time + FIXED_PRIORITY_WEIGHT + weights.duration + weights.difficulty || 1;

const weightedScore =
  (timePressure * weights.time +
    priorityScore * FIXED_PRIORITY_WEIGHT +
    workload * weights.duration +
    difficultyScore * weights.difficulty) /
  totalWeight;

return clamp(weightedScore, 0, 100);
}

function daysBetweenISODates(startISO: string, endISO: string) {
  if (!isValidISODate(startISO) || !isValidISODate(endISO)) return null;
  const start = new Date(startISO + "T00:00:00").getTime();
  const end = new Date(endISO + "T00:00:00").getTime();
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function resolveAttentionEffort(task: Task) {
  const explicitEffortLevel = task.effortLevel ?? null;
  const legacyDurationHrs =
    task.durationHrs == null || !Number.isFinite(task.durationHrs) ? null : task.durationHrs;
  const legacyEffortLevel = explicitEffortLevel ? null : inferredEffortLevel(legacyDurationHrs);
  const resolvedEffortLevel = explicitEffortLevel ?? legacyEffortLevel;
  const effortSource = explicitEffortLevel ? "explicit" : legacyEffortLevel ? "legacy-duration" : "none";
  const effortFactor = resolvedEffortLevel ? EFFORT_RUNWAY_FACTORS[resolvedEffortLevel] : 0;

  return {
    explicitEffortLevel,
    resolvedEffortLevel,
    effortSource,
    legacyDurationHrs,
    effortFactor,
  };
}

function cadenceStatsForTask(task: Task, timeLogs: TimeLog[]) {
  const today = todayISO();
  const createdAtDate = Number.isFinite(task.createdAt) ? new Date(task.createdAt) : null;
  const taskCreatedDate = createdAtDate
    ? new Date(Date.UTC(
        createdAtDate.getFullYear(),
        createdAtDate.getMonth(),
        createdAtDate.getDate()
      )).toISOString().slice(0, 10)
    : null;
  const daysSinceTaskCreated = taskCreatedDate ? daysBetweenISODates(taskCreatedDate, today) : null;
  const taskLogs = timeLogs.filter((log) => log.taskId === task.id && isValidISODate(log.date) && isClosedTimeLog(log));
  const lastWorkedDate = taskLogs.reduce<string | null>(
    (latest, log) => (!latest || log.date > latest ? log.date : latest),
    null
  );
  const daysSinceLastWorked = lastWorkedDate ? daysBetweenISODates(lastWorkedDate, today) : null;

  function hoursSince(days: number) {
    const start = addDaysISO(today, -(days - 1));
    return taskLogs
      .filter((log) => log.date >= start && log.date <= today)
      .reduce((sum, log) => sum + (log.hours ?? 0), 0);
  }

  const hoursLast7Days = hoursSince(7);
  const hoursLast14Days = hoursSince(14);
  const hoursLast30Days = hoursSince(30);
  const hasFixedDeadline = Boolean(task.due);
  const horizonCadenceDays =
    task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 5
        : task.visionHorizon === "mid"
          ? 10
          : task.visionHorizon === "long"
            ? 18
            : 21
      : hasFixedDeadline
        ? 21
        : 21;
  const priorityCadenceMultiplier =
    task.priority === "high" ? 0.65 : task.priority === "low" ? 1.45 : 1;
  const expectedCadenceDays = horizonCadenceDays * priorityCadenceMultiplier;
  const expectedHours14 =
    (task.priority === "high" ? 6 : task.priority === "low" ? 1.5 : 3) +
    (task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 2
        : task.visionHorizon === "mid"
          ? 1
          : task.visionHorizon === "long"
            ? 0.5
            : 0
      : 0);
  const recentCoverage = clamp(hoursLast14Days / expectedHours14, 0, 1);
  const recentHoursMultiplier = 1 - recentCoverage * 0.65;
  const neverWorkedInitialPressure =
    (task.priority === "high" ? 12 : task.priority === "normal" ? 7 : 3) +
    (task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 5
        : task.visionHorizon === "mid"
          ? 3
          : task.visionHorizon === "long"
            ? 1
            : 0
      : 0);
  const neverWorkedMaturityMax = task.priority === "high" ? 16 : task.priority === "normal" ? 12 : 6;
  const neverWorkedMaturityPressure =
    !lastWorkedDate && !hasFixedDeadline && daysSinceTaskCreated !== null
      ? neverWorkedMaturityMax * (1 - Math.exp(-daysSinceTaskCreated / 28))
      : 0;
  const neverWorkedBasePressure = neverWorkedInitialPressure + neverWorkedMaturityPressure;
  const neglectPressure = lastWorkedDate
    ? 100 * (1 - Math.exp(-(daysSinceLastWorked ?? 0) / (expectedCadenceDays * 1.4)))
    : clamp(neverWorkedBasePressure, 0, 35);
  const fixedDeadlineDamping = hasFixedDeadline ? 0.45 : 1;
  const priorityCap = task.priority === "low" ? 45 : task.priority === "normal" ? 75 : 90;
  const cadencePressureBeforeActivity = clamp(
    neglectPressure * recentHoursMultiplier * fixedDeadlineDamping,
    0,
    priorityCap
  );
  const activityCadenceMultiplier =
    task.activityType === "correspondence"
      ? task.priority === "high" || task.visionHorizon === "short"
        ? 0.65
        : 0.35
      : task.activityType === "activity"
        ? 1
        : task.activityType === "uni_work"
          ? 0.9
          : 1;
  const cadencePressure = clamp(
    cadencePressureBeforeActivity * activityCadenceMultiplier,
    0,
    priorityCap
  );

  return {
    taskCreatedDate,
    daysSinceTaskCreated,
    lastWorkedDate,
    daysSinceLastWorked,
    hoursLast7Days,
    hoursLast14Days,
    hoursLast30Days,
    hasEverBeenWorked: taskLogs.length > 0,
    neverWorkedMaturityPressure,
    neverWorkedBasePressure: lastWorkedDate ? 0 : clamp(neverWorkedBasePressure, 0, 35),
    activityCadenceMultiplier,
    cadencePressureBeforeActivity,
    cadencePressure,
  };
}

function attentionScoreV2(task: Task, timeLogs: TimeLog[] = []) {
  const days = daysUntil(task.due);
  const hasFixedDeadline = days !== null;
  const effectiveDays = days === null ? null : Math.max(0, days);
  const deadlinePressure = hasFixedDeadline
    ? effectiveDays === 0
      ? 100
      : 100 / (1 + Math.pow(effectiveDays / 24, 1.65))
    : 0;
  const deadlineContribution = deadlinePressure * 0.5;
  const intrinsicImportance =
    task.priority === "high" ? 24 : task.priority === "normal" ? 16 : 6;
  const effort = resolveAttentionEffort(task);
  const startPressure =
    hasFixedDeadline && effort.effortFactor > 0
      ? clamp(
          (effort.effortFactor / (Math.pow(Math.max(effectiveDays ?? 0, 0.5), 0.85) + effort.effortFactor)) * 100,
          0,
          100
        )
      : 0;
  const startContribution = startPressure * 0.3;
  const horizonPressure = hasFixedDeadline
    ? 0
    : task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 12
        : task.visionHorizon === "mid"
          ? 7
          : task.visionHorizon === "long"
            ? 3
            : 0
      : 0;
  const contextModifier = 0;
  const cadence = cadenceStatsForTask(task, timeLogs);
  const cadenceContribution = cadence.cadencePressure * 0.22;
  const rawScore = clamp(
    deadlineContribution +
      intrinsicImportance +
      startContribution +
      horizonPressure +
      contextModifier +
      cadenceContribution,
    0,
    100
  );

  return {
    currentDaysUntilDeadline: days,
    deadlinePressure,
    deadlineContribution,
    intrinsicImportance,
    ...effort,
    startPressure,
    startContribution,
    horizonPressure,
    contextModifier,
    ...cadence,
    cadenceContribution,
    rawScore,
    displayedScore: Math.round(rawScore),
  };
}

type AttentionV2Result = ReturnType<typeof attentionScoreV2>;

function deadlineAttentionReason(days: number | null) {
  if (days === null) return null;
  if (days < 0) return "Deadline overdue";
  if (days <= 1) return "Deadline imminent";
  if (days <= 14) return "Deadline approaching";
  if (days <= 60) return "Deadline pressure building";
  return "Deadline still distant";
}

function horizonAttentionReason(task: Task) {
  if (task.deadlineMode !== "vision") return null;
  if (task.visionHorizon === "short") return "Short-term focus";
  if (task.visionHorizon === "mid") return "Mid-term focus";
  if (task.visionHorizon === "long") return "Long-term background goal";
  return null;
}

function getAttentionReasons(task: Task, v2: AttentionV2Result) {
  const candidates: { text: string; weight: number }[] = [];
  const deadlineReason = deadlineAttentionReason(v2.currentDaysUntilDeadline);

  if (task.priority === "high") {
    candidates.push({ text: "High priority", weight: 95 });
  }

  if (deadlineReason && v2.deadlineContribution > 0) {
    const deadlineWeight =
      v2.currentDaysUntilDeadline !== null && v2.currentDaysUntilDeadline <= 14
        ? 90
        : v2.currentDaysUntilDeadline !== null && v2.currentDaysUntilDeadline <= 60
          ? 82
          : 45;
    candidates.push({ text: deadlineReason, weight: deadlineWeight });
  }

  if (v2.startContribution >= 2.5 && v2.resolvedEffortLevel === "extensive") {
    candidates.push({ text: "Extensive work needs runway", weight: 78 });
  } else if (v2.startContribution >= 2) {
    candidates.push({ text: "Larger task needs an earlier start", weight: 70 });
  }

  if (v2.cadenceContribution >= 8 && v2.daysSinceLastWorked !== null) {
    candidates.push({ text: `Not worked on for ${v2.daysSinceLastWorked} days`, weight: 88 });
  } else if (v2.cadenceContribution >= 5 && v2.daysSinceLastWorked !== null) {
    candidates.push({ text: "Attention overdue", weight: 74 });
  } else if (v2.cadenceContribution >= 3 && v2.daysSinceLastWorked !== null) {
    candidates.push({ text: "Consistency slipping", weight: 58 });
  }

  if (!v2.hasEverBeenWorked && v2.neverWorkedBasePressure >= 12) {
    candidates.push({ text: "Not started yet", weight: 50 });
  }

  const horizonReason = horizonAttentionReason(task);
  if (horizonReason && v2.horizonPressure > 0) {
    const horizonWeight =
      task.visionHorizon === "short" ? 76 : task.visionHorizon === "mid" ? 62 : 46;
    candidates.push({ text: horizonReason, weight: horizonWeight });
  }

  if (v2.hoursLast7Days >= 3) {
    candidates.push({ text: "Well covered recently", weight: 35 });
  } else if (v2.hoursLast14Days >= 3 && v2.cadenceContribution < 5) {
    candidates.push({ text: "Worked on recently", weight: 32 });
  }

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .map((candidate) => candidate.text)
    .filter((reason, index, reasons) => reasons.indexOf(reason) === index)
    .slice(0, 2);
}

function urgencyColour(score: number) {
  if (score >= 85) return "bg-rose-500";
  if (score >= 70) return "bg-orange-400";
  if (score >= 55) return "bg-amber-300";
  if (score >= 35) return "bg-lime-300";
  return "bg-emerald-100";
}

function visualAttentionLevel(score: number) {
  if (score >= 85) return "highest";
  if (score >= 70) return "high";
  if (score >= 55) return "elevated";
  if (score >= 35) return "medium";
  return "low";
}

function visualAttentionScores(rawScores: number[]) {
  if (rawScores.length === 0) return [];

  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);
  const range = max - min;
  const rangeStrength = clamp((range - 1) / 12, 0, 1);
  const relativeWeight = 0.45 * rangeStrength;
  const absoluteWeight = 1 - relativeWeight;

  return rawScores.map((rawScore) => {
    const absoluteScore = clamp((rawScore / 50) * 100, 0, 100);
    const relativePosition = range > 0 ? clamp((rawScore - min) / range, 0, 1) : 0.5;
    const relativeScore = relativePosition * 100;
    const visualScore = clamp(absoluteScore * absoluteWeight + relativeScore * relativeWeight, 18, 100);

    return {
      relativePosition,
      visualAttentionScore: visualScore,
      visualLevel: visualAttentionLevel(visualScore),
    };
  });
}



/* ----------------------------- UI bits ----------------------------- */

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" }) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none";
  const cls =
    tone === "red"
      ? `${base} border-red-200 bg-red-50 text-red-700`
      : `${base} border-slate-200 bg-white text-slate-600`;
  return <span className={cls}>{children}</span>;
}

function compactDeadlineLabel(task: Task) {
  if (task.due) {
    const days = daysLeftFromISO(task.due);
    if (days === null) return null;
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    return `${days}d`;
  }

  if (task.deadlineMode === "vision" && task.visionHorizon) {
    return VISION_HORIZONS.find((option) => option.id === task.visionHorizon)?.label ?? null;
  }

  return null;
}

function activityTypeLabel(activityType?: ActivityType) {
  return ACTIVITY_TYPES.find((option) => option.id === activityType)?.label ?? null;
}

function deadlinePillTone(task: Task) {
  if (task.due) {
    const days = daysLeftFromISO(task.due);
    if (days === null) return "bg-rose-50/50 text-rose-500";
    if (days <= 1) return "bg-rose-100/80 text-rose-700";
    if (days <= 3) return "bg-rose-100/70 text-rose-600";
    if (days <= 7) return "bg-rose-50 text-rose-600";
    if (days <= 14) return "bg-rose-50/80 text-rose-500";
    return "bg-rose-50/50 text-rose-400";
  }

  return "bg-rose-50/50 text-rose-500";
}

function activityPillTone(activityType: ActivityType) {
  if (activityType === "correspondence") return "bg-indigo-50/70 text-indigo-500";
  if (activityType === "uni_work") return "bg-emerald-50/70 text-emerald-600";
  return "bg-orange-50/70 text-rose-500";
}

function ActivityTypeIcon({ activityType }: { activityType: ActivityType }) {
  if (activityType === "correspondence") return <Mail className="h-3.5 w-3.5" aria-hidden="true" />;
  if (activityType === "uni_work") return <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Circle className="h-3.5 w-3.5" aria-hidden="true" />;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "in_progress") return <LoaderCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "frozen") return <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "completed") return <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Circle className="h-3.5 w-3.5" aria-hidden="true" />;
}

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === "high") return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
  if (priority === "low") return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5" aria-hidden="true" />;
}

function EffortIcon({ effortLevel }: { effortLevel: EffortLevel }) {
  if (effortLevel === "quick") return <Zap className="h-3.5 w-3.5" aria-hidden="true" />;
  if (effortLevel === "extensive") return <Layers className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Gauge className="h-3.5 w-3.5" aria-hidden="true" />;
}

function plannerEventTone(eventType: CalendarEventType) {
  if (eventType === "work") return "border-[#2098D4]/25 bg-[#2098D4]/10 text-[#1775A5]";
  if (eventType === "class") return "border-[#7045D8]/25 bg-[#7045D8]/10 text-[#5632B0]";
  if (eventType === "meeting") return "border-[#FFC515]/35 bg-[#FFC515]/14 text-[#9A7200]";
  if (eventType === "deadline") return "border-[#F04A2D]/30 bg-[#F04A2D]/12 text-[#B93822]";
  if (eventType === "milestone") return "border-[#FF8A1F]/30 bg-[#FF8A1F]/12 text-[#B85C0B]";
  if (eventType === "travel") return "border-[#43D4DC]/35 bg-[#43D4DC]/12 text-[#16858C]";
  return "border-[#43C995]/30 bg-[#43C995]/12 text-[#1F805B]";
}

function PlannerEventTypeIcon({ eventType }: { eventType: CalendarEventType }) {
  if (eventType === "work") return <BriefcaseBusiness className="h-3 w-3" aria-hidden="true" />;
  if (eventType === "class") return <GraduationCap className="h-3 w-3" aria-hidden="true" />;
  if (eventType === "meeting") return <Users className="h-3 w-3" aria-hidden="true" />;
  if (eventType === "deadline") return <Flag className="h-3 w-3" aria-hidden="true" />;
  if (eventType === "milestone") return <Diamond className="h-3 w-3" aria-hidden="true" />;
  if (eventType === "travel") return <Plane className="h-3 w-3" aria-hidden="true" />;
  return <UserRound className="h-3 w-3" aria-hidden="true" />;
}

function TaskMetaPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium leading-none ${className}`}>
      {children}
    </span>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {children}
    </div>
  );
}

function DeadlineField({
  due,
  deadlineMode,
  visionHorizon,
  onDateChange,
  onVisionChange,
}: {
  due?: string | null;
  deadlineMode?: DeadlineMode;
  visionHorizon?: VisionHorizon | null;
  onDateChange: (due: string) => void;
  onVisionChange: (horizon: VisionHorizon) => void;
}) {
  return (
    <Field label="Deadline">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1.4fr] sm:items-center">
        <input
          type="date"
          value={deadlineMode === "date" ? due ?? "" : ""}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        />
        <div className="hidden text-xs text-slate-300 sm:block">or</div>
        <div className="grid grid-cols-3 gap-2">
          {VISION_HORIZONS.map((option) => {
            const selected = deadlineMode === "vision" && visionHorizon === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onVisionChange(option.id)}
                className={`h-10 rounded-full border px-3 text-xs font-medium transition-colors ${
                  selected
                    ? "border-slate-200 bg-slate-100 text-slate-800"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </Field>
  );
}

function ActivityTypeField({
  value,
  onChange,
}: {
  value?: ActivityType;
  onChange: (value: ActivityType | undefined) => void;
}) {
  return (
    <Field label="Activity type">
      <div className="grid gap-2 sm:grid-cols-3">
        {ACTIVITY_TYPES.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(selected ? undefined : option.id)}
              className={`h-10 rounded-full border px-3 text-xs font-medium transition-colors ${
                selected
                  ? "border-slate-200 bg-slate-100 text-slate-800"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <ActivityTypeIcon activityType={option.id} />
                <span>{option.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function inferredEffortLevel(durationHrs?: number | null): EffortLevel | null {
  if (durationHrs == null || !Number.isFinite(durationHrs)) return null;
  if (durationHrs <= 1) return "quick";
  if (durationHrs <= 4) return "moderate";
  return "extensive";
}

function taskDisplayEffortLevel(task: Task): EffortLevel | null {
  return task.effortLevel ?? inferredEffortLevel(task.durationHrs);
}

function effortLabel(value?: EffortLevel | null) {
  return EFFORT_LEVELS.find((option) => option.id === value)?.label ?? "—";
}

function effortRank(value?: EffortLevel | null) {
  if (value === "quick") return 0;
  if (value === "moderate") return 1;
  if (value === "extensive") return 2;
  return 999999;
}

function EffortLevelField({
  value,
  suggestedValue,
  onChange,
}: {
  value?: EffortLevel | null;
  suggestedValue?: EffortLevel | null;
  onChange: (value: EffortLevel) => void;
}) {
  const displayedValue = value ?? suggestedValue ?? null;

  return (
    <Field label="Effort">
      <IconSelectBox<EffortLevel>
        value={displayedValue}
        onChange={onChange}
        options={EFFORT_LEVELS}
        renderIcon={(effortLevel) => <EffortIcon effortLevel={effortLevel} />}
      />
    </Field>
  );
}

function IconSelectBox<T extends string>({
  value,
  onChange,
  options,
  renderIcon,
}: {
  value?: T | null;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  renderIcon: (value: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.id === value) ?? null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 outline-none transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-slate-200"
      >
        {selected ? <span className="shrink-0 text-slate-400">{renderIcon(selected.id)}</span> : null}
        <span className="min-w-0 truncate">{selected?.label ?? "—"}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-[1000] mt-1 w-full min-w-[132px] overflow-hidden rounded-[16px] border border-slate-200 bg-white py-1 text-sm shadow-xl ring-1 ring-slate-900/5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 ${
                option.id === value ? "text-slate-900" : "text-slate-600"
              }`}
            >
              <span className="shrink-0 text-slate-400">{renderIcon(option.id)}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SelectBox<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ----------------------------- Main ----------------------------- */

export default function MinimalTaskTracker() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [timeLogsLoaded, setTimeLogsLoaded] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const taskStoreRef = useRef<TaskStore | null>(null);
  const hasLoadedFromStore = useRef(false);
  const remoteLoadTrustedForDeleteRef = useRef(false);
  const allowNextEmptySaveRef = useRef(false);
  const allowNextDestructiveSaveRef = useRef(false);
  const deletedTaskIdsRef = useRef<string[]>([]);
  const skipNextTaskSaveRef = useRef(false);
  const skipNextTimeLogSaveRef = useRef(false);
  const timeLogsRef = useRef(timeLogs);
  const [mode, setMode] = useState<ViewMode>("board");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [plannerView, setPlannerView] = useState<PlannerView>("week");
  const [plannerAnchorDate, setPlannerAnchorDate] = useState<string>("");
  const [plannerMobileSelectedDate, setPlannerMobileSelectedDate] = useState<string>("");
  const [plannerEventModalOpen, setPlannerEventModalOpen] = useState(false);
  const [plannerEventModalMode, setPlannerEventModalMode] = useState<PlannerEventModalMode>("create");
  const [plannerEventDraft, setPlannerEventDraft] = useState<PlannerEventDraft | null>(null);
  const [plannerEventSaving, setPlannerEventSaving] = useState(false);
  const [plannerEventError, setPlannerEventError] = useState<string | null>(null);
  const [plannerInteraction, setPlannerInteraction] = useState<PlannerWeekInteraction | null>(null);
  const [plannerWorkActionSavingId, setPlannerWorkActionSavingId] = useState<string | null>(null);
  const [plannerLogSourceEventId, setPlannerLogSourceEventId] = useState<string | null>(null);
  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [smartImportRaw, setSmartImportRaw] = useState("");
  const [smartImportProposals, setSmartImportProposals] = useState<SmartImportProposal[]>([]);
  const [smartImportSaving, setSmartImportSaving] = useState(false);
  const [smartImportMessage, setSmartImportMessage] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState({ label: "—", count: 0 });
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [attentionCategoryMenuOpen, setAttentionCategoryMenuOpen] = useState(false);
  const [attentionCategoryExcludedIds, setAttentionCategoryExcludedIds] = useState<string[]>([]);
  const [expandedDashboardCategoryIds, setExpandedDashboardCategoryIds] = useState<string[]>([]);

const [weights, setWeights] = useState(() => {
  if (typeof window === "undefined") {
    return DEFAULT_ATTENTION_WEIGHTS;
  }

  const saved = localStorage.getItem("attentionWeights");

  return saved
    ? normalizeAttentionWeights(JSON.parse(saved))
    : DEFAULT_ATTENTION_WEIGHTS;
});

useEffect(() => {
  localStorage.setItem("attentionWeights", JSON.stringify(weights));
}, [weights]);

  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryEmoji, setCategoryEmoji] = useState("");
  const [categoryColour, setCategoryColour] = useState<string>("slate");
  const [categorySaving, setCategorySaving] = useState(false);

  // New task modal state
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCourseId, setNewCourseId] = useState<string>(fallbackCategories[0]?.id ?? "");
  const [newStatus, setNewStatus] = useState<Status>("to_do");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [newDue, setNewDue] = useState<string>("");
  const [newDeadlineMode, setNewDeadlineMode] = useState<DeadlineMode | undefined>(undefined);
  const [newVisionHorizon, setNewVisionHorizon] = useState<VisionHorizon | null>(null);
  const [newActivityType, setNewActivityType] = useState<ActivityType | undefined>(undefined);
  const [newEffortLevel, setNewEffortLevel] = useState<EffortLevel>("moderate");
  const [newDifficulty, setNewDifficulty] = useState<string>("3");
  const [newNotes, setNewNotes] = useState<string>("");

  // Time log modal state
  const [logOpen, setLogOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logTaskId, setLogTaskId] = useState<string>("");
  const [logDate, setLogDate] = useState<string>("");
  const [logStartTime, setLogStartTime] = useState<string>("");
  const [logEndDate, setLogEndDate] = useState<string>("");
  const [logEndTime, setLogEndTime] = useState<string>("");
  const [logHoursInput, setLogHoursInput] = useState<string>("");
  const [logNote, setLogNote] = useState<string>("");
  const [logSaving, setLogSaving] = useState(false);
  const [loggerTaskFilter, setLoggerTaskFilter] = useState<string>("all");
  const [loggerValueMode, setLoggerValueMode] = useState<LoggerValueMode>("hours");
  const [loggerRangeMode, setLoggerRangeMode] = useState<LoggerRangeMode>("month");
  const [loggerAnchorDate, setLoggerAnchorDate] = useState<string>("");
  const [loggerMobileSelectedDate, setLoggerMobileSelectedDate] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [clientToday, setClientToday] = useState<string>("");
  const [clientNowMs, setClientNowMs] = useState<number>(0);
  const loggerGridScrollRef = useRef<HTMLDivElement | null>(null);
  const plannerWeekScrollRef = useRef<HTMLDivElement | null>(null);
  const suppressPlannerEventClickRef = useRef(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Task | null>(null);

  // List sorting
  const [listSortKey, setListSortKey] = useState<
    "title" | "course" | "status" | "priority" | "due" | "timeLeft" | "effort" | "duration" | "difficulty"
  >("due");
  const [listSortDir, setListSortDir] = useState<"asc" | "desc">("asc");
  const [openStatusTaskId, setOpenStatusTaskId] = useState<string | null>(null);
  const [openListFilter, setOpenListFilter] = useState<ListFilterMenu | null>(null);
  const [mobileTaskFiltersOpen, setMobileTaskFiltersOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Status[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<Priority[]>([]);
  const [difficultyFilters, setDifficultyFilters] = useState<string[]>([]);
  const [timeLeftFilter, setTimeLeftFilter] = useState<{ min: number; max: number } | null>(null);
  const [durationFilter, setDurationFilter] = useState<{ min: number; max: number } | null>(null);

  // Attention score toggles
  const [scoreUseTime, setScoreUseTime] = useState(true);
  const [scoreUsePriority, setScoreUsePriority] = useState(true);
  const [scoreUseDuration, setScoreUseDuration] = useState(true);
  const [scoreUseDifficulty, setScoreUseDifficulty] = useState(true);

  const searchRef = useRef<HTMLInputElement | null>(null);

useEffect(() => {
  queueMicrotask(() => {
    setHasMounted(true);

    const today = todayISO();
    setClientToday(today);
    setClientNowMs(Date.now());
    setPlannerAnchorDate(today);
    setLoggerAnchorDate(today);
    setCustomStartDate(today);
    setCustomEndDate(today);
    setLogDate(today);
    setLogEndDate(today);
    setMode(storedTabToMode(localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)));
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    setSidebarPreferenceLoaded(true);
    setBackupStatus(getLatestLocalBackupLabel());

    const savedAttentionCategoryScope = localStorage.getItem(ATTENTION_CATEGORY_SCOPE_KEY);
    if (savedAttentionCategoryScope) {
      try {
        const parsed = JSON.parse(savedAttentionCategoryScope);
        if (Array.isArray(parsed)) {
          setAttentionCategoryExcludedIds(parsed.filter((item): item is string => typeof item === "string"));
        }
      } catch (error) {
        console.warn("Could not load Attention Score category scope:", error);
      }
    }

    void (async () => {
      const remoteLogs = await loadTimeLogs(SYNC_CODE);

      if (remoteLogs.ok) {
        timeLogsRef.current = remoteLogs.logs;
        skipNextTimeLogSaveRef.current = true;
        setTimeLogs(remoteLogs.logs);
        localStorage.setItem(TIME_LOGS_STORAGE_KEY, JSON.stringify(remoteLogs.logs));
        setTimeLogsLoaded(true);
        return;
      }

      console.warn("Supabase time log load failed. Falling back to local Logger cache.");
      const savedLogs = localStorage.getItem(TIME_LOGS_STORAGE_KEY);
      if (savedLogs) {
        try {
          const restoredLogs = normalizeTimeLogs(JSON.parse(savedLogs));
          timeLogsRef.current = restoredLogs;
          skipNextTimeLogSaveRef.current = true;
          setTimeLogs(restoredLogs);
        } catch (error) {
          console.error("Error loading local cached time logs:", error);
        }
      }
      setTimeLogsLoaded(true);
    })();

    void (async () => {
      const remoteEvents = await loadCalendarEvents(SYNC_CODE);

      if (remoteEvents.ok) {
        setCalendarEvents(remoteEvents.events);
        return;
      }

      console.warn("Supabase calendar event load failed. Preserving current Planner event state.");
    })();
  });
}, []);

useEffect(() => {
  if (!hasMounted) return;
  localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, modeToStoredTab(mode));
}, [hasMounted, mode]);

useEffect(() => {
  if (!hasMounted || !sidebarPreferenceLoaded) return;
  localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? "true" : "false");
}, [hasMounted, sidebarCollapsed, sidebarPreferenceLoaded]);

useEffect(() => {
  if (!hasMounted) return;
  localStorage.setItem(ATTENTION_CATEGORY_SCOPE_KEY, JSON.stringify(attentionCategoryExcludedIds));
}, [attentionCategoryExcludedIds, hasMounted]);

useEffect(() => {
  if (mode !== "list") setOpenStatusTaskId(null);
}, [mode]);

useEffect(() => {
  if (!openStatusTaskId) return;

  function closeStatusDropdown() {
    setOpenStatusTaskId(null);
  }

  document.addEventListener("click", closeStatusDropdown);
  return () => document.removeEventListener("click", closeStatusDropdown);
}, [openStatusTaskId]);

useEffect(() => {
  if (mode !== "list") setOpenListFilter(null);
  if (mode !== "list") setMobileTaskFiltersOpen(false);
}, [mode]);

useEffect(() => {
  if (!openListFilter) return;

  function closeListFilter() {
    setOpenListFilter(null);
  }

  document.addEventListener("click", closeListFilter);
  return () => document.removeEventListener("click", closeListFilter);
}, [openListFilter]);

useEffect(() => {
  if (!attentionCategoryMenuOpen) return;

  function closeAttentionCategoryMenu() {
    setAttentionCategoryMenuOpen(false);
  }

  document.addEventListener("click", closeAttentionCategoryMenu);
  return () => document.removeEventListener("click", closeAttentionCategoryMenu);
}, [attentionCategoryMenuOpen]);

useEffect(() => {
  let cancelled = false;

  async function fetchCategories() {
    const loaded = await loadCategories(SYNC_CODE);
    if (cancelled) return;

    if (!loaded.ok || loaded.categories.length === 0) {
      console.warn("Using app/courses.ts category fallback.");
      return;
    }

    setCategories(loaded.categories);
  }

  void fetchCategories();

  return () => {
    cancelled = true;
  };
}, []);

useEffect(() => {
  let cancelled = false;

  async function fetchTasks() {
    const store = await getTaskStore();
    if (cancelled) return;

    taskStoreRef.current = store;
    const cachedTasks = loadLocalTaskCache();
    const loaded = await store.loadTasks(SYNC_CODE);
    if (cancelled) return;

    if (!loaded.ok) {
      console.warn("Task load failed. Keeping local task state/cache.");
      if (cachedTasks.length > 0) {
        setTasks(cachedTasks);
        hasLoadedFromStore.current = true;
      }
      setTasksLoaded(true);
      return;
    }

    remoteLoadTrustedForDeleteRef.current = loaded.tasks.length > 0;
    if (!isDemoMode && loaded.tasks.length === 0) {
      console.warn("Remote task load returned empty. Local cached tasks were not overwritten.");
      if (cachedTasks.length > 0) {
        setTasks(cachedTasks);
        hasLoadedFromStore.current = true;
        setTasksLoaded(true);
        return;
      }
    }

    skipNextTaskSaveRef.current = true;
    setTasks(loaded.tasks);
    saveLocalTaskCache(loaded.tasks);
    hasLoadedFromStore.current = true;
    setTasksLoaded(true);
  }

  fetchTasks();

  return () => {
    cancelled = true;
  };
}, []);

function refreshBackupStatus() {
  setBackupStatus(getLatestLocalBackupLabel());
}

useEffect(() => {
  if (!tasksLoaded) return;
  if (skipNextTaskSaveRef.current) {
    skipNextTaskSaveRef.current = false;
    return;
  }

  const allowEmptyOverwrite = allowNextEmptySaveRef.current;
  const allowDestructiveSave = allowNextDestructiveSaveRef.current;
  allowNextEmptySaveRef.current = false;
  allowNextDestructiveSaveRef.current = false;

  async function persistTasks() {
    saveLocalTaskCache(tasks);
    const deletedTaskIds = deletedTaskIdsRef.current;

    const store = taskStoreRef.current ?? (await getTaskStore());
    taskStoreRef.current = store;

    console.info("persistTasks triggered", {
      taskCount: tasks.length,
      deletedTaskIds,
      syncCode: SYNC_CODE,
      sampleTask: tasks[0]
        ? {
            id: tasks[0].id,
            title: tasks[0].title,
            courseId: tasks[0].courseId,
            status: tasks[0].status,
            priority: tasks[0].priority,
          }
        : null,
    });

    const saved = await store.saveTasks(tasks, {
      syncCode: SYNC_CODE,
      timeLogs: timeLogsRef.current,
      allowEmptyOverwrite,
      allowDeleteAll: remoteLoadTrustedForDeleteRef.current || allowEmptyOverwrite || allowDestructiveSave,
      deletedTaskIds,
      onLocalBackup: (backupTasks, backupTimeLogs) => {
        createLocalBackup(backupTasks, backupTimeLogs);
        refreshBackupStatus();
      },
    });

    console.info("persistTasks saveTasks returned", { saved });

    if (saved && deletedTaskIds.length > 0) {
      deletedTaskIdsRef.current = deletedTaskIdsRef.current.filter((id) => !deletedTaskIds.includes(id));
    }

    if (!saved) {
      console.warn("Task save failed. Local task cache was kept, but Supabase was not updated.", {
        taskCount: tasks.length,
        deletedTaskIds,
      });
    }
  }

  void persistTasks();
}, [tasks, tasksLoaded]);

useEffect(() => {
  timeLogsRef.current = timeLogs;
  if (!timeLogsLoaded) return;
  if (skipNextTimeLogSaveRef.current) {
    skipNextTimeLogSaveRef.current = false;
    return;
  }
  localStorage.setItem(TIME_LOGS_STORAGE_KEY, JSON.stringify(timeLogs));
}, [timeLogs, timeLogsLoaded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const isTyping =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);

      if (isTyping) return;

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }

      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setNewOpen(true);
      }

      if (e.key === "Escape") {
        setNewOpen(false);
        setEditOpen(false);
        setLogOpen(false);
        setCategoryModalOpen(false);
        setEditingLogId(null);
        resetCategoryDraft();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeCategories = useMemo(() => {
    const active = categories.filter((category) => !category.archived);
    return categories.length > 0 ? active : fallbackCategories.filter((category) => !category.archived);
  }, [categories]);

  const archivedCategories = useMemo(() => {
    return categories.filter((category) => category.archived);
  }, [categories]);

  const firstCategoryId = activeCategories[0]?.id ?? fallbackCategories[0]?.id ?? "";

  const attentionIncludedCategoryIds = useMemo(() => {
    return activeCategories
      .map((category) => category.id)
      .filter((id) => !attentionCategoryExcludedIds.includes(id));
  }, [activeCategories, attentionCategoryExcludedIds]);

  const attentionIncludedCategoryIdSet = useMemo(() => {
    return new Set(attentionIncludedCategoryIds);
  }, [attentionIncludedCategoryIds]);

  function courseLabel(id: string) {
    const category =
      categories.find((item) => item.id === id) ??
      fallbackCategories.find((item) => item.id === id);
    return category ? categoryDisplayLabel(category) : id;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (t.status === "completed") return false;
        if (courseFilter !== "all" && t.courseId !== courseFilter) return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;

        const ad = a.due || "9999-12-31";
        const bd = b.due || "9999-12-31";
        if (ad !== bd) return ad.localeCompare(bd);

        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [tasks, query, courseFilter]);

  const completedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (!isRecoverableCompleted(t, clientNowMs)) return false;
        if (courseFilter !== "all" && t.courseId !== courseFilter) return false;
        if (statusFilters.length > 0 && !statusFilters.includes("completed")) return false;
        if (priorityFilters.length > 0 && !priorityFilters.includes(t.priority)) return false;
        if (difficultyFilters.length > 0 && !difficultyFilters.includes(String(t.difficulty ?? ""))) return false;
        if (!taskMatchesTimeLeftFilter(t, timeLeftFilter)) return false;
        if (!taskMatchesDurationFilter(t, durationFilter)) return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const ad = a.completedAt ?? "";
        const bd = b.completedAt ?? "";
        if (ad !== bd) return bd.localeCompare(ad);
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [clientNowMs, courseFilter, difficultyFilters, durationFilter, priorityFilters, query, statusFilters, tasks, timeLeftFilter]);

  const listRows = useMemo(() => {
    const rows = filtered.filter((task) => {
      if (statusFilters.length > 0 && !statusFilters.includes(task.status)) return false;
      if (priorityFilters.length > 0 && !priorityFilters.includes(task.priority)) return false;
      if (difficultyFilters.length > 0 && !difficultyFilters.includes(String(task.difficulty ?? ""))) return false;
      if (!taskMatchesTimeLeftFilter(task, timeLeftFilter)) return false;
      if (!taskMatchesDurationFilter(task, durationFilter)) return false;
      return true;
    });
    const dir = listSortDir === "asc" ? 1 : -1;

    function get(t: Task): string | number {
      switch (listSortKey) {
        case "title":
          return (t.title ?? "").toLowerCase();
        case "course":
          return courseLabel(t.courseId).toLowerCase();
        case "status":
          return statusLabel(t.status).toLowerCase();
        case "priority":
          return priorityRank(t.priority);
        case "due":
          return t.due ?? "9999-12-31";
        case "timeLeft": {
          const d = t.due ? daysLeftFromISO(t.due) : null;
          return d === null ? 999999 : d;
        }
        case "effort":
          return effortRank(taskDisplayEffortLevel(t));
        case "duration":
          return t.durationHrs == null ? 999999 : Number(t.durationHrs);
        case "difficulty":
          return t.difficulty == null ? 999999 : Number(t.difficulty);
        default:
          return 0;
      }
    }

    rows.sort((a, b) => {
      const av = get(a);
      const bv = get(b);

      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });

    return rows;
  }, [difficultyFilters, durationFilter, filtered, listSortKey, listSortDir, priorityFilters, statusFilters, timeLeftFilter]);

  const activeTaskFilterCount =
    (courseFilter === "all" ? 0 : 1) +
    statusFilters.length +
    priorityFilters.length +
    difficultyFilters.length +
    (timeLeftFilter ? 1 : 0) +
    (durationFilter ? 1 : 0);

  const closedTimeLogs = useMemo(() => timeLogs.filter(isClosedTimeLog), [timeLogs]);

  const byCourse = useMemo(() => {
    const map: Record<string, Task[]> = Object.fromEntries(activeCategories.map((c) => [c.id, []]));
    for (const t of filtered.filter((task) => task.status !== "completed")) {
      const key = t.courseId || firstCategoryId;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const aDays = a.due ? daysLeftFromISO(a.due) : null;
        const bDays = b.due ? daysLeftFromISO(b.due) : null;

        const aBucket = aDays === null ? 3 : aDays < 0 ? 0 : aDays <= 2 ? 1 : 2;
        const bBucket = bDays === null ? 3 : bDays < 0 ? 0 : bDays <= 2 ? 1 : 2;

        if (aBucket !== bBucket) return aBucket - bBucket;

        const ad = a.due || "9999-12-31";
        const bd = b.due || "9999-12-31";
        if (ad !== bd) return ad.localeCompare(bd);

        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;

        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
    }

    return map;
  }, [activeCategories, filtered, firstCategoryId]);

  const scoredTasks = useMemo(() => {
    if (attentionIncludedCategoryIds.length === 0) return [];

    const scored = filtered
      .filter((task) => task.status !== "frozen")
      .filter((task) => attentionIncludedCategoryIdSet.has(task.courseId))
      .map((task) => {
        const v2 = attentionScoreV2(task, closedTimeLogs);
        return {
          task,
          total: v2.rawScore,
          reasons: getAttentionReasons(task, v2),
        };
      });

    scored.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const ad = a.task.due || "9999-12-31";
      const bd = b.task.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      const pr = priorityRank(a.task.priority) - priorityRank(b.task.priority);
      if (pr !== 0) return pr;
      return (b.task.createdAt ?? 0) - (a.task.createdAt ?? 0);
    });

    const visualScores = visualAttentionScores(scored.map((item) => item.total));
    return scored.map((item, index) => ({
      ...item,
      ...visualScores[index],
    }));
  }, [attentionIncludedCategoryIdSet, attentionIncludedCategoryIds.length, closedTimeLogs, filtered]);

  useEffect(() => {
    const target = window as typeof window & {
      yasmineCompareAttentionV2?: () => Array<Record<string, string | number | null>>;
    };

    target.yasmineCompareAttentionV2 = () => {
      const rows = scoredTasks
        .map(({ task, total, relativePosition, visualAttentionScore, visualLevel }) => {
          const v2 = attentionScoreV2(task, closedTimeLogs);
          const reasons = getAttentionReasons(task, v2);
          return {
            task: task.title,
            category: courseLabel(task.courseId),
            status: task.status,
            priority: task.priority,
            deadline: task.due ?? task.visionHorizon ?? "none",
            activityType: task.activityType ?? "none",
            currentScore: Math.round(total),
            v2RawScore: Number(v2.rawScore.toFixed(2)),
            v2DisplayedScore: v2.displayedScore,
            relativePosition: Number(relativePosition.toFixed(3)),
            visualAttentionScore: Number(visualAttentionScore.toFixed(2)),
            visualLevel,
            deadlinePressure: Number(v2.deadlinePressure.toFixed(2)),
            deadlineContribution: Number(v2.deadlineContribution.toFixed(2)),
            intrinsicImportance: v2.intrinsicImportance,
            explicitEffortLevel: v2.explicitEffortLevel ?? "none",
            resolvedEffortLevel: v2.resolvedEffortLevel ?? "none",
            effortSource: v2.effortSource,
            legacyDurationHrs: v2.legacyDurationHrs,
            effortFactor: Number(v2.effortFactor.toFixed(2)),
            startPressure: Number(v2.startPressure.toFixed(2)),
            startContribution: Number(v2.startContribution.toFixed(2)),
            horizonPressure: v2.horizonPressure,
            contextModifier: v2.contextModifier,
            taskCreatedDate: v2.taskCreatedDate ?? "unknown",
            daysSinceTaskCreated: v2.daysSinceTaskCreated,
            lastWorkedDate: v2.lastWorkedDate ?? "never",
            daysSinceLastWorked: v2.daysSinceLastWorked,
            hoursLast7Days: Number(v2.hoursLast7Days.toFixed(2)),
            hoursLast14Days: Number(v2.hoursLast14Days.toFixed(2)),
            hoursLast30Days: Number(v2.hoursLast30Days.toFixed(2)),
            hasEverBeenWorked: v2.hasEverBeenWorked ? "yes" : "no",
            neverWorkedMaturityPressure: Number(v2.neverWorkedMaturityPressure.toFixed(2)),
            neverWorkedBasePressure: Number(v2.neverWorkedBasePressure.toFixed(2)),
            activityCadenceMultiplier: Number(v2.activityCadenceMultiplier.toFixed(2)),
            cadencePressureBeforeActivity: Number(v2.cadencePressureBeforeActivity.toFixed(2)),
            cadencePressure: Number(v2.cadencePressure.toFixed(2)),
            cadenceContribution: Number(v2.cadenceContribution.toFixed(2)),
            reasons: reasons.join(" · "),
          };
        })
        .sort((a, b) => Number(b.v2RawScore) - Number(a.v2RawScore));

      console.table(rows);
      return rows;
    };

    return () => {
      delete target.yasmineCompareAttentionV2;
    };
  }, [closedTimeLogs, courseLabel, scoredTasks]);

  const plannerAnchor = isValidISODate(plannerAnchorDate)
    ? plannerAnchorDate
    : isValidISODate(clientToday)
      ? clientToday
      : "2026-08-23";
  const plannerWeekDays = useMemo(() => plannerWeekDaysForAnchor(plannerAnchor), [plannerAnchor]);
  const plannerWeekLabel = useMemo(() => formatPlannerWeekRange(plannerWeekDays), [plannerWeekDays]);
  const plannerMonthDays = useMemo(() => plannerMonthDaysForAnchor(plannerAnchor), [plannerAnchor]);
  const plannerMonthLabel = useMemo(() => formatPlannerMonthLabel(plannerAnchor), [plannerAnchor]);
  const plannerYearMonths = useMemo(() => plannerYearMonthsForAnchor(plannerAnchor), [plannerAnchor]);
  const plannerYearLabel = useMemo(() => formatPlannerYearLabel(plannerAnchor), [plannerAnchor]);
  const plannerHours = useMemo(() => plannerHourLabels(), []);
  const plannerWeekStart = plannerWeekDays[0] ?? plannerAnchor;
  const plannerWeekEnd = plannerWeekDays[6] ?? plannerAnchor;
  const plannerVisibleRange = useMemo(() => {
    if (plannerView === "week") return { start: plannerWeekStart, end: plannerWeekEnd };
    if (plannerView === "month") {
      return {
        start: plannerMonthDays[0]?.date ?? plannerAnchor,
        end: plannerMonthDays[plannerMonthDays.length - 1]?.date ?? plannerAnchor,
      };
    }
    return { start: `${plannerYearLabel}-01-01`, end: `${plannerYearLabel}-12-31` };
  }, [plannerAnchor, plannerMonthDays, plannerView, plannerWeekEnd, plannerWeekStart, plannerYearLabel]);
  const plannerCalendarBaseEventsForRender = useMemo(() => {
    if (!plannerInteraction) return calendarEvents;
    const hasRealEvent = calendarEvents.some((event) => event.id === plannerInteraction.eventId);
    const mapped = calendarEvents.map((event) =>
      event.id === plannerInteraction.eventId ? plannerInteraction.previewEvent : event
    );
    return hasRealEvent ? mapped : [...mapped, plannerInteraction.previewEvent];
  }, [calendarEvents, plannerInteraction]);
  const plannerCalendarEventsForRender = useMemo(() => {
    return expandRecurringPlannerEvents(
      plannerCalendarBaseEventsForRender,
      plannerVisibleRange.start,
      plannerVisibleRange.end
    );
  }, [plannerCalendarBaseEventsForRender, plannerVisibleRange]);
  const plannerTaskDeadlinesByDate = useMemo(() => {
    return tasks.reduce<Record<string, Task[]>>((groups, task) => {
      const hasFixedDate =
        task.deadlineMode === "date" || (!task.deadlineMode && Boolean(task.due));
      if (
        task.status === "completed" ||
        !hasFixedDate ||
        !task.due ||
        !isValidISODate(task.due)
      ) {
        return groups;
      }

      groups[task.due] = [...(groups[task.due] ?? []), task];
      return groups;
    }, {});
  }, [tasks]);
  const plannerWeekEvents = useMemo(() => {
    return plannerCalendarEventsForRender.filter((event) => calendarEventIntersectsWeek(event, plannerWeekStart, plannerWeekEnd));
  }, [plannerCalendarEventsForRender, plannerWeekEnd, plannerWeekStart]);
  const plannerTaskDeadlinesInWeekByDate = useMemo(() => {
    return plannerWeekDays.reduce<Record<string, Task[]>>((groups, day) => {
      groups[day] = plannerTaskDeadlinesByDate[day] ?? [];
      return groups;
    }, {});
  }, [plannerTaskDeadlinesByDate, plannerWeekDays]);
  const plannerWeekAllDaySpans = useMemo(() => {
    const items: PlannerDateItem[] = [
      ...plannerWeekEvents
        .filter((event) => event.allDay && event.startDate)
        .map((event) => ({ sourceType: "calendar_event" as const, event })),
      ...plannerWeekDays.flatMap((day) =>
        (plannerTaskDeadlinesInWeekByDate[day] ?? []).map((task) => ({
          sourceType: "task_deadline" as const,
          task,
          date: day,
        }))
      ),
    ];
    return plannerAllDaySpansForDays(plannerWeekDays, items);
  }, [plannerTaskDeadlinesInWeekByDate, plannerWeekDays, plannerWeekEvents]);
  const plannerTimedLayoutsByDate = useMemo(() => {
    return plannerWeekDays.reduce<
      Record<string, Array<ReturnType<typeof layoutPlannerTimedEvents>[number]>>
    >((groups, day) => {
      const dayEvents = plannerWeekEvents.filter((event) => {
        if (event.allDay || !event.startAt) return false;
        const startDate = eventLocalDate(event.startAt);
        const endDate = eventLocalDate(event.endAt) || startDate;
        return Boolean(startDate && endDate && startDate <= day && endDate >= day);
      });
      groups[day] = layoutPlannerTimedEvents(dayEvents, day);
      return groups;
    }, {});
  }, [plannerWeekDays, plannerWeekEvents]);
  const plannerMobileWeekDate = plannerWeekDays.includes(plannerMobileSelectedDate)
    ? plannerMobileSelectedDate
    : plannerWeekDays.includes(clientToday)
      ? clientToday
      : plannerWeekDays[0] ?? plannerAnchor;
  const plannerMobileWeekItems = useMemo(() => {
    return plannerItemsForDate(
      plannerMobileWeekDate,
      plannerCalendarEventsForRender,
      plannerTaskDeadlinesByDate
    );
  }, [plannerCalendarEventsForRender, plannerMobileWeekDate, plannerTaskDeadlinesByDate]);
  const plannerMobileAllDayItems = useMemo(() => {
    return plannerMobileWeekItems.filter((item) => {
      if (item.sourceType === "task_deadline") return true;
      return item.event.allDay || !item.event.startAt;
    });
  }, [plannerMobileWeekItems]);
  const plannerMobileTimedLayouts = plannerTimedLayoutsByDate[plannerMobileWeekDate] ?? [];
  const plannerMonthEventsByDate = useMemo(() => {
    return plannerMonthDays.reduce<Record<string, PlannerDateItem[]>>((groups, day) => {
      groups[day.date] = plannerItemsForDate(
        day.date,
        plannerCalendarEventsForRender,
        plannerTaskDeadlinesByDate
      );
      return groups;
    }, {});
  }, [plannerCalendarEventsForRender, plannerMonthDays, plannerTaskDeadlinesByDate]);
  const plannerMonthWeeks = useMemo(() => {
    const weeks: Array<typeof plannerMonthDays> = [];
    for (let index = 0; index < plannerMonthDays.length; index += 7) {
      weeks.push(plannerMonthDays.slice(index, index + 7));
    }
    return weeks;
  }, [plannerMonthDays]);
  const plannerMonthAllDaySpansByWeek = useMemo(() => {
    return plannerMonthWeeks.map((week) => {
      const days = week.map((day) => day.date);
      const weekStart = days[0];
      const weekEnd = days[days.length - 1];
      const items: PlannerDateItem[] = plannerCalendarEventsForRender
        .filter((event) => {
          if (!event.allDay || !event.startDate || !weekStart || !weekEnd) return false;
          const endDate = event.endDate || event.startDate;
          return event.startDate <= weekEnd && endDate >= weekStart;
        })
        .map((event) => ({ sourceType: "calendar_event" as const, event }));

      return plannerAllDaySpansForDays(days, items);
    });
  }, [plannerCalendarEventsForRender, plannerMonthWeeks]);
  const plannerYearEventsByDate = useMemo(() => {
    const yearStart = `${plannerYearLabel}-01-01`;
    const yearEnd = `${plannerYearLabel}-12-31`;
    const groups: Record<string, PlannerDateItem[]> = {};

    plannerCalendarEventsForRender.forEach((event) => {
      const span = eventDateSpan(event);
      if (!span || span.end < yearStart || span.start > yearEnd) return;

      let cursor = span.start < yearStart ? yearStart : span.start;
      const end = span.end > yearEnd ? yearEnd : span.end;

      while (cursor <= end) {
        groups[cursor] = [...(groups[cursor] ?? []), { sourceType: "calendar_event", event }];
        cursor = addDaysISO(cursor, 1);
      }
    });

    Object.entries(plannerTaskDeadlinesByDate).forEach(([date, deadlineTasks]) => {
      if (date < yearStart || date > yearEnd) return;
      groups[date] = [
        ...(groups[date] ?? []),
        ...deadlineTasks.map((task) => ({ sourceType: "task_deadline" as const, task, date })),
      ];
    });

    return groups;
  }, [plannerCalendarEventsForRender, plannerTaskDeadlinesByDate, plannerYearLabel]);
  const plannerTaskOptions = useMemo(() => {
    const options = tasks
      .filter((task) => task.status !== "completed")
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    const selectedTask = plannerEventDraft?.taskId
      ? tasks.find((task) => task.id === plannerEventDraft.taskId)
      : null;

    if (selectedTask && !options.some((task) => task.id === selectedTask.id)) {
      return [selectedTask, ...options];
    }

    return options;
  }, [plannerEventDraft?.taskId, tasks]);
  const plannerIsCurrentWeek = Boolean(clientToday && plannerWeekDays.includes(clientToday));
  const currentTimeTop =
    plannerIsCurrentWeek && clientNowMs
      ? (() => {
          const now = new Date(clientNowMs);
          const minutes = now.getHours() * 60 + now.getMinutes();
          const startMinutes = PLANNER_START_HOUR * 60;
          const endMinutes = PLANNER_END_HOUR * 60;
          if (minutes < startMinutes || minutes > endMinutes) return null;
          return ((minutes - startMinutes) / 60) * PLANNER_HOUR_HEIGHT;
        })()
      : null;

  useEffect(() => {
    if (mode !== "planner" || plannerView !== "week") return;

    plannerWeekScrollRef.current?.scrollTo({
      top: Math.max(0, (9 - PLANNER_START_HOUR) * PLANNER_HOUR_HEIGHT),
    });
  }, [mode, plannerView, plannerWeekDays[0]]);

  useEffect(() => {
    if (!plannerInteraction) return;

    function updatePreview(clientX: number, clientY: number) {
      setPlannerInteraction((current) => {
        if (!current) return current;

        const deltaX = clientX - current.pointerStartX;
        const deltaY = clientY - current.pointerStartY;
        const hasMoved = current.hasMoved || Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4;
        const visibleStartMinutes = PLANNER_START_HOUR * 60;
        const visibleEndMinutes = PLANNER_END_HOUR * 60;
        const originalStartDate = eventLocalDate(current.originalEvent.startAt) ?? plannerWeekDays[0];
        let nextStartDate = originalStartDate;
        let nextStartMinutes = current.originalStartMinutes;
        let nextEndMinutes = current.originalEndMinutes;

        if (current.kind === "move") {
          const rawDayIndex = Math.floor((clientX - current.gridLeft - 64) / current.dayWidth);
          const dayIndex = clamp(rawDayIndex, 0, plannerWeekDays.length - 1);
          nextStartDate = plannerWeekDays[dayIndex] ?? originalStartDate;
          nextStartMinutes = snapPlannerMinutes(
            current.originalStartMinutes + (deltaY / PLANNER_HOUR_HEIGHT) * 60
          );
          nextStartMinutes = clamp(
            nextStartMinutes,
            visibleStartMinutes,
            visibleEndMinutes - current.originalDurationMinutes
          );
          nextEndMinutes = nextStartMinutes + current.originalDurationMinutes;
        } else {
          nextStartDate = originalStartDate;
          nextEndMinutes = snapPlannerMinutes(
            current.originalEndMinutes + (deltaY / PLANNER_HOUR_HEIGHT) * 60
          );
          nextEndMinutes = clamp(
            nextEndMinutes,
            current.originalStartMinutes + PLANNER_SNAP_MINUTES,
            visibleEndMinutes
          );
        }

        const startAt =
          current.kind === "move"
            ? isoFromLocalDateMinutes(nextStartDate, nextStartMinutes)
            : current.originalEvent.startAt;
        const endAt = isoFromLocalDateMinutes(nextStartDate, nextEndMinutes);

        if (!startAt || !endAt) return { ...current, hasMoved };

        return {
          ...current,
          hasMoved,
          previewEvent: {
            ...current.previewEvent,
            startAt,
            endAt,
          },
        };
      });
    }

    function onPointerMove(event: PointerEvent) {
      updatePreview(event.clientX, event.clientY);
    }

    function onPointerUp() {
      setPlannerInteraction((current) => {
        if (!current) return current;

        if (!current.hasMoved) {
          return null;
        }

        suppressPlannerEventClickRef.current = true;
        setTimeout(() => {
          suppressPlannerEventClickRef.current = false;
        }, 0);

        void (async () => {
          const eventToSave = exceptionEventForPlannerOccurrence(current.previewEvent);
          const saved = await saveCalendarEvent(eventToSave, SYNC_CODE);

          if (!saved) {
            console.warn("Failed to save moved/resized calendar event. Reverting preview.", {
              id: current.eventId,
            });
            return;
          }

          setCalendarEvents((prev) => {
            const exists = prev.some((event) => event.id === eventToSave.id);
            return exists
              ? prev.map((event) => (event.id === eventToSave.id ? eventToSave : event))
              : [...prev, eventToSave];
          });
        })();

        return null;
      });
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [plannerInteraction, plannerWeekDays]);

  const loggerDateRange = useMemo(() => {
    return loggerDateRangeForMode(
      loggerRangeMode,
      loggerAnchorDate,
      customStartDate,
      customEndDate
    );
  }, [customEndDate, customStartDate, loggerAnchorDate, loggerRangeMode]);

  const loggerPeriodLabel = useMemo(() => {
    return formatLoggerPeriod(loggerRangeMode, loggerDateRange, loggerAnchorDate || todayISO());
  }, [loggerAnchorDate, loggerDateRange, loggerRangeMode]);

  const loggerDays = useMemo(() => {
    if (loggerRangeMode === "year") return [];
    return loggerDaysForRange(loggerDateRange);
  }, [loggerDateRange, loggerRangeMode]);
  const loggerMobileDate = loggerDays.includes(loggerMobileSelectedDate)
    ? loggerMobileSelectedDate
    : loggerDays.includes(clientToday)
      ? clientToday
      : loggerDays[0] ?? loggerDateRange.start;
  const useCompactLoggerGrid =
    loggerRangeMode === "month" || (loggerRangeMode === "custom" && loggerDays.length > 7);

  useEffect(() => {
    if (loggerRangeMode === "month" || loggerRangeMode === "custom") {
      loggerGridScrollRef.current?.scrollTo({ left: 0 });
    }
  }, [loggerDateRange.end, loggerDateRange.start, loggerRangeMode]);

  const logsInRange = useMemo(() => {
    return closedTimeLogs.filter((log) => log.date >= loggerDateRange.start && log.date <= loggerDateRange.end);
  }, [closedTimeLogs, loggerDateRange]);

  const openTimeLogs = useMemo(() => {
    return timeLogs
      .filter(isOpenTimeLog)
      .slice()
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.startTime ?? "").localeCompare(a.startTime ?? "");
      });
  }, [timeLogs]);

  const calculatedLogHours = useMemo(() => {
    return calculateTimeLogDurationHours(logDate, logStartTime, logEndDate || logDate, logEndTime);
  }, [logDate, logEndDate, logEndTime, logStartTime]);
  const isCalculatedLogDuration = calculatedLogHours !== null;
  const displayedLogHoursInput = isCalculatedLogDuration
    ? formatHourInput(calculatedLogHours)
    : logHoursInput;

  useEffect(() => {
    if (calculatedLogHours !== null) {
      setLogHoursInput(formatHourInput(calculatedLogHours));
    }
  }, [calculatedLogHours]);

  const loggerTasks = useMemo(() => {
    const taskIdsWithLogs = new Set(closedTimeLogs.map((log) => log.taskId));

    return filtered
      .filter((task) => loggerTaskFilter === "all" || task.id === loggerTaskFilter)
      .filter((task) => taskIdsWithLogs.has(task.id))
      .slice()
      .sort((a, b) => {
        const aHours = closedTimeLogs
            .filter((log) => log.taskId === a.id)
            .reduce((sum, log) => sum + (log.hours ?? 0), 0);
        const bHours = closedTimeLogs
            .filter((log) => log.taskId === b.id)
            .reduce((sum, log) => sum + (log.hours ?? 0), 0);

        if (bHours !== aHours) return bHours - aHours;
        return a.title.localeCompare(b.title);
      });
  }, [closedTimeLogs, filtered, loggerTaskFilter]);

  const taskNameById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task.title]));
  }, [tasks]);

  const taskById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task]));
  }, [tasks]);

  const logTaskOptions = useMemo(() => {
    const options = tasks
      .filter((task) => task.status !== "completed")
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    const selectedTask = logTaskId ? tasks.find((task) => task.id === logTaskId) : null;

    if (selectedTask && !options.some((task) => task.id === selectedTask.id)) {
      return [selectedTask, ...options];
    }

    return options;
  }, [logTaskId, tasks]);

  const logsByTaskDate = useMemo(() => {
    const map: Record<string, TimeLog[]> = {};
    for (const log of closedTimeLogs) {
      const key = `${log.taskId}:${log.date}`;
      map[key] = [...(map[key] ?? []), log];
    }
    return map;
  }, [closedTimeLogs]);

  const openLogsByTaskDate = useMemo(() => {
    const map: Record<string, TimeLog[]> = {};
    for (const log of openTimeLogs) {
      const key = `${log.taskId}:${log.date}`;
      map[key] = [...(map[key] ?? []), log];
    }
    return map;
  }, [openTimeLogs]);

  const editingTimeLog = useMemo(() => {
    return editingLogId ? timeLogs.find((log) => log.id === editingLogId) ?? null : null;
  }, [editingLogId, timeLogs]);
  const logModalTitle = editingTimeLog && isOpenTimeLog(editingTimeLog)
    ? "Add end time"
    : editingLogId
      ? "Edit time log"
      : "Log time";

  const loggerRows = useMemo(() => {
    const visibleDates = new Set(loggerDays);
    return loggerTasks.map((task) => {
      const logs = closedTimeLogs.filter((log) => log.taskId === task.id && visibleDates.has(log.date));
      return {
        task,
        total: logs.reduce((sum, log) => sum + (log.hours ?? 0), 0),
      };
    });
  }, [closedTimeLogs, loggerDays, loggerTasks]);

  const loggerRangeSummary = useMemo(() => {
    const totalHours = logsInRange.reduce((sum, log) => sum + (log.hours ?? 0), 0);
    const activeDates = new Set(logsInRange.map((log) => log.date));
    const averageHoursPerActiveDay = activeDates.size ? totalHours / activeDates.size : 0;
    const taskTotals = new Map<string, number>();
    const categoryTotals = new Map<string, number>();

    for (const log of logsInRange) {
      const taskKey = log.taskId || "archived";
      taskTotals.set(taskKey, (taskTotals.get(taskKey) ?? 0) + (log.hours ?? 0));

      const task = log.taskId ? taskById[log.taskId] : null;
      const categoryKey = task?.courseId ?? "archived";
      categoryTotals.set(categoryKey, (categoryTotals.get(categoryKey) ?? 0) + (log.hours ?? 0));
    }

    const mostWorkedTaskEntry = Array.from(taskTotals.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
    const mostWorkedCategoryEntry = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
    const mostWorkedTask = mostWorkedTaskEntry
      ? {
          id: mostWorkedTaskEntry[0],
          title: taskById[mostWorkedTaskEntry[0]]?.title ?? "Archived task",
          hours: mostWorkedTaskEntry[1],
        }
      : null;
    const mostWorkedCategory = mostWorkedCategoryEntry
      ? {
          id: mostWorkedCategoryEntry[0],
          label: mostWorkedCategoryEntry[0] === "archived" ? "Archived category" : courseLabel(mostWorkedCategoryEntry[0]),
          hours: mostWorkedCategoryEntry[1],
        }
      : null;

    return {
      totalHours,
      activeDayCount: activeDates.size,
      averageHoursPerActiveDay,
      mostWorkedTask,
      mostWorkedCategory,
    };
  }, [courseLabel, logsInRange, taskById]);

  const workCalendar = useMemo(() => {
    const totals = new Map<string, number>();
    for (const log of logsInRange) {
      totals.set(log.date, (totals.get(log.date) ?? 0) + (log.hours ?? 0));
    }

    const rawStart = loggerDateRange.start;
    const end = loggerDateRange.end;
    const days = loggerDaysForRange(loggerDateRange).map((date) => ({
      date,
      hours: totals.get(date) ?? 0,
    }));
    const compact = loggerRangeMode === "year" || days.length > 62;
    const alignStart = compact || loggerRangeMode === "month"
      ? addDaysISO(rawStart, -new Date(rawStart + "T00:00:00").getDay())
      : rawStart;
    const weeks: { weekStart: string; days: { date: string; hours: number }[] }[] = [];
    let cursor = alignStart;

    while (cursor <= end || weeks.length === 0) {
      const weekDays = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDaysISO(cursor, dayIndex);
        return {
          date,
          hours: date >= rawStart && date <= end ? totals.get(date) ?? 0 : 0,
        };
      });

      weeks.push({ weekStart: cursor, days: weekDays });
      cursor = addDaysISO(cursor, 7);
    }

    return { rawStart, end, days, weeks, compact };
  }, [loggerDateRange, loggerRangeMode, logsInRange]);

  const topWorkedTasks = useMemo(() => {
    const totals = new Map<string, number>();
    for (const log of logsInRange) {
      const taskKey = log.taskId || "archived";
      totals.set(taskKey, (totals.get(taskKey) ?? 0) + (log.hours ?? 0));
    }

    const rows = Array.from(totals.entries())
      .map(([taskId, hours]) => {
        const task = taskById[taskId];
        return {
          taskId,
          title: task?.title ?? "Archived task",
          category: task ? courseLabel(task.courseId) : "Archived task",
          courseId: task?.courseId,
          hours,
        };
      })
      .filter((row) => row.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10);

    return {
      rows,
      maxHours: rows[0]?.hours ?? 0,
  };
}, [logsInRange, taskById]);

  function openNewTaskForCourse(courseId: string) {
    setNewCourseId(courseId);
    setNewOpen(true);
  }

  function resetCategoryDraft() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryEmoji("");
    setCategoryColour("slate");
    setCategorySaving(false);
  }

  function openAddCategory() {
    resetCategoryDraft();
    setCategoryModalOpen(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryName(category.label);
    setCategoryEmoji(category.emoji);
    setCategoryColour(category.colour ?? "slate");
    setCategoryModalOpen(true);
  }

  function makeCategoryId(label: string) {
    const slug =
      label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "category";
    return `${slug}_${uid().slice(0, 8)}`;
  }

  async function submitCategory() {
    const label = categoryName.trim();
    if (!label || categorySaving) return;

    const emoji = categoryEmoji.trim();
    const colour = CATEGORY_COLOURS.some((option) => option.id === categoryColour)
      ? categoryColour
      : "slate";

    setCategorySaving(true);

    if (editingCategory) {
      const saved = await updateCategory(SYNC_CODE, editingCategory.id, {
        label,
        emoji,
        colour,
      });

      if (!saved.ok || !saved.category) {
        setCategorySaving(false);
        window.alert("Category update failed. Existing categories were not changed.");
        return;
      }

      setCategories((prev) =>
        prev.map((category) => (category.id === editingCategory.id ? saved.category as Category : category))
      );
      setCategoryModalOpen(false);
      resetCategoryDraft();
      return;
    }

    const sortOrder =
      categories.reduce((max, category) => Math.max(max, category.sortOrder), -1) + 1;
    const saved = await createCategory(SYNC_CODE, {
      id: makeCategoryId(label),
      label,
      emoji,
      colour,
      sortOrder,
    });

    if (!saved.ok || !saved.category) {
      setCategorySaving(false);
      window.alert("Category creation failed. Existing categories were not changed.");
      return;
    }

    setCategories((prev) =>
      [...prev, saved.category as Category].sort((a, b) => a.sortOrder - b.sortOrder)
    );
    setCategoryModalOpen(false);
    resetCategoryDraft();
  }

  async function archiveCategory(category: Category) {
    if (categorySaving) return;

    const assignedCount = tasks.filter((task) => task.courseId === category.id).length;
    if (assignedCount > 0) {
      const confirmed = window.confirm(
        `This category still has ${assignedCount} tasks. Archiving will hide it from normal use but will not remove those tasks.`
      );
      if (!confirmed) return;
    }

    setCategorySaving(true);
    const saved = await updateCategoryArchived(SYNC_CODE, category.id, true);

    if (!saved.ok || !saved.category) {
      setCategorySaving(false);
      window.alert("Category archive failed. Existing categories and tasks were not changed.");
      return;
    }

    setCategories((prev) =>
      prev.map((item) => (item.id === category.id ? saved.category as Category : item))
    );
    if (courseFilter === category.id) setCourseFilter("all");
    setCategoryModalOpen(false);
    resetCategoryDraft();
  }

  async function restoreCategory(category: Category) {
    const saved = await updateCategoryArchived(SYNC_CODE, category.id, false);

    if (!saved.ok || !saved.category) {
      window.alert("Category restore failed. Existing categories and tasks were not changed.");
      return;
    }

    setCategories((prev) =>
      prev.map((item) => (item.id === category.id ? saved.category as Category : item))
    );
  }

  function submitNewTask() {
    const title = newTitle.trim();
    if (!title) return;

    const diff = optionalFiniteNumber(newDifficulty);
    const deadlineMode = newDue ? "date" : newVisionHorizon ? "vision" : undefined;

    const t: Task = {
      id: uid(),
      title,
      courseId: newCourseId || firstCategoryId,
      status: newStatus,
      priority: newPriority,
      due: deadlineMode === "date" ? newDue : deadlineMode === "vision" ? null : undefined,
      deadlineMode,
      visionHorizon: deadlineMode === "vision" ? newVisionHorizon : null,
      activityType: newActivityType,
      effortLevel: newEffortLevel,
      notes: newNotes.trim() || undefined,
      durationHrs: null,
      difficulty: diff,
      completedAt: newStatus === "completed" ? new Date().toISOString() : null,
      createdAt: Date.now(),
    };

    setTasks((prev) => [t, ...prev]);

    // reset
    setNewTitle("");
    setNewStatus("to_do");
    setNewPriority("normal");
    setNewDue("");
    setNewDeadlineMode(undefined);
    setNewVisionHorizon(null);
    setNewActivityType(undefined);
    setNewEffortLevel("moderate");
    setNewDifficulty("3");
    setNewNotes("");
    setNewCourseId(firstCategoryId);

    setNewOpen(false);
  }

  function deleteTask(id: string) {
    createLocalBackup(tasks, timeLogsRef.current);
    refreshBackupStatus();
    deletedTaskIdsRef.current = Array.from(new Set([...deletedTaskIdsRef.current, id]));
    allowNextDestructiveSaveRef.current = true;
    allowNextEmptySaveRef.current = true;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTaskStatus(id: string, status: Status) {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? applyTaskStatus(task, status) : task))
    );
    setOpenStatusTaskId(null);
  }

  function completeTask(id: string) {
    updateTaskStatus(id, "completed");
  }

  function restoreTask(id: string) {
    updateTaskStatus(id, "to_do");
  }

  function movePlannerWeek(direction: -1 | 1) {
    setPlannerAnchorDate(addDaysISO(plannerAnchor, direction * 7));
  }

  function movePlannerMonth(direction: -1 | 1) {
    setPlannerAnchorDate(addMonthsISO(plannerAnchor, direction));
  }

  function movePlannerYear(direction: -1 | 1) {
    setPlannerAnchorDate(addYearsISO(plannerAnchor, direction));
  }

  function returnPlannerToToday() {
    const today = todayISO();
    setClientToday(today);
    setClientNowMs(Date.now());
    setPlannerAnchorDate(today);
  }

  function openPlannerEventTypeChooser() {
    setPlannerEventModalMode("create");
    setPlannerEventDraft(null);
    setPlannerEventError(null);
    setPlannerEventModalOpen(true);
  }

  function openSmartImport() {
    setSmartImportOpen(true);
    setSmartImportMessage(null);
  }

  function closeSmartImport() {
    if (smartImportSaving) return;
    setSmartImportOpen(false);
    setSmartImportMessage(null);
  }

  function parseSmartImportInput() {
    const contextYear = smartImportContextYear(plannerAnchor);
    const proposals = parseSmartScheduleImport(smartImportRaw, contextYear);
    setSmartImportProposals(proposals);
    setSmartImportMessage(
      proposals.length
        ? `Parsed ${proposals.length} proposed event${proposals.length === 1 ? "" : "s"} using ${contextYear} where a year was not written.`
        : "No schedule items were found."
    );
  }

  function resetSmartImport() {
    if (smartImportSaving) return;
    setSmartImportRaw("");
    setSmartImportProposals([]);
    setSmartImportMessage(null);
  }

  function updateSmartImportProposal(id: string, patch: Partial<SmartImportProposal>) {
    setSmartImportProposals((prev) =>
      prev.map((proposal) => {
        if (proposal.id !== id) return proposal;
        const next = { ...proposal, ...patch };
        return {
          ...next,
          warnings: validateSmartImportProposal(next),
        };
      })
    );
  }

  async function confirmSmartImport() {
    if (smartImportSaving) return;

    const selected = smartImportProposals.filter((proposal) => proposal.include && !proposal.savedEventId);
    const invalid = selected.filter((proposal) => validateSmartImportProposal(proposal).length > 0);
    if (invalid.length) {
      setSmartImportMessage("Some selected events still need missing fields before they can be added.");
      return;
    }

    if (!selected.length) {
      setSmartImportMessage("No unsaved selected events to add.");
      return;
    }

    setSmartImportSaving(true);
    let savedCount = 0;
    const failedIds: string[] = [];
    const timezone = browserTimezone();

    for (const proposal of selected) {
      const event = smartImportProposalToCalendarEvent(proposal, timezone);
      if (!event) {
        failedIds.push(proposal.id);
        continue;
      }

      const saved = await saveCalendarEvent(event, SYNC_CODE);
      if (!saved) {
        failedIds.push(proposal.id);
        continue;
      }

      savedCount += 1;
      setCalendarEvents((prev) => [...prev, event]);
      setSmartImportProposals((prev) =>
        prev.map((item) =>
          item.id === proposal.id
            ? { ...item, savedEventId: event.id, include: false }
            : item
        )
      );
    }

    setSmartImportSaving(false);
    setSmartImportMessage(
      failedIds.length
        ? `Added ${savedCount}. ${failedIds.length} item${failedIds.length === 1 ? "" : "s"} failed and can be retried.`
        : `Added ${savedCount} event${savedCount === 1 ? "" : "s"}.`
    );
  }

  function startPlannerEventCreate(eventType: CalendarEventType) {
    setPlannerEventModalMode("create");
    setPlannerEventDraft(defaultPlannerEventDraft(eventType, clientToday || plannerWeekDays[0] || todayISO()));
    setPlannerEventError(null);
  }

  function openPlannerEventEdit(event: CalendarEvent) {
    const parentId = parentIdForPlannerOccurrence(event);
    const parentEvent = parentId ? calendarEvents.find((item) => item.id === parentId) : null;
    const parentRule = parseWeeklyRecurrenceRule(parentEvent?.recurrenceRule);
    const draft = plannerDraftFromEvent(event);

    setPlannerEventModalMode("edit");
    setPlannerEventDraft(
      parentRule
        ? {
            ...draft,
            repeat: "weekly",
            recurrenceWeekday: parentRule.weekday,
            recurrenceStartDate: parentRule.startDate,
            recurrenceEndDate: parentRule.endDate,
          }
        : draft
    );
    setPlannerEventError(null);
    setPlannerEventModalOpen(true);
  }

  function closePlannerEventModal() {
    if (plannerEventSaving) return;
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
    setPlannerEventError(null);
  }

  async function submitPlannerEvent() {
    if (!plannerEventDraft || plannerEventSaving) return;

    const { event, error } = calendarEventFromDraft(plannerEventDraft);
    if (!event || error) {
      setPlannerEventError(error ?? "Could not save this event.");
      return;
    }

    setPlannerEventSaving(true);
    setPlannerEventError(null);

    const parentEvent = plannerEventDraft.recurrenceParentId
      ? calendarEvents.find((item) => item.id === plannerEventDraft.recurrenceParentId)
      : null;
    const parentRule = parseWeeklyRecurrenceRule(parentEvent?.recurrenceRule);

    if (plannerEventDraft.recurrenceParentId && plannerEventDraft.recurrenceApplyScope === "all" && parentEvent) {
      const nextRule = parentRule
        ? stringifyWeeklyRecurrenceRule({
            ...parentRule,
            weekday: plannerEventDraft.recurrenceWeekday,
            startDate: plannerEventDraft.recurrenceStartDate,
            endDate: plannerEventDraft.recurrenceEndDate,
            startTime: plannerEventDraft.startTime,
            endTime: plannerEventDraft.endTime,
            timezone: plannerEventDraft.timezone || parentRule.timezone,
          })
        : parentEvent.recurrenceRule;
      const eventToSave: CalendarEvent = {
        ...event,
        id: parentEvent.id,
        recurrenceParentId: null,
        recurrenceExceptionDate: null,
        recurrenceStatus: null,
        recurrenceRule: nextRule,
      };
      const saved = await saveCalendarEvent(eventToSave, SYNC_CODE);
      setPlannerEventSaving(false);

      if (!saved) {
        setPlannerEventError("Could not save series. Please check the console for details.");
        return;
      }

      setCalendarEvents((prev) => prev.map((item) => (item.id === eventToSave.id ? eventToSave : item)));
      setPlannerEventModalOpen(false);
      setPlannerEventDraft(null);
      return;
    }

    if (
      plannerEventDraft.recurrenceParentId &&
      plannerEventDraft.recurrenceApplyScope === "future" &&
      parentEvent &&
      parentRule &&
      plannerEventDraft.recurrenceExceptionDate
    ) {
      const oldEndDate = addDaysISO(plannerEventDraft.recurrenceExceptionDate, -1);
      if (oldEndDate < parentRule.startDate) {
        setPlannerEventSaving(false);
        setPlannerEventError("Cannot split before the series start.");
        return;
      }

      const oldParent: CalendarEvent = {
        ...parentEvent,
        recurrenceRule: stringifyWeeklyRecurrenceRule({ ...parentRule, endDate: oldEndDate }),
      };
      const newParent: CalendarEvent = {
        ...event,
        id: createCalendarEventId(),
        recurrenceParentId: null,
        recurrenceExceptionDate: null,
        recurrenceStatus: null,
        recurrenceRule: stringifyWeeklyRecurrenceRule({
          ...parentRule,
          startDate: plannerEventDraft.recurrenceExceptionDate,
          endDate: parentRule.endDate,
          weekday: plannerEventDraft.recurrenceWeekday,
          startTime: plannerEventDraft.startTime,
          endTime: plannerEventDraft.endTime,
          timezone: plannerEventDraft.timezone || parentRule.timezone,
        }),
      };

      const savedNew = await saveCalendarEvent(newParent, SYNC_CODE);
      const savedOld = savedNew ? await saveCalendarEvent(oldParent, SYNC_CODE) : false;
      setPlannerEventSaving(false);

      if (!savedNew || !savedOld) {
        if (savedNew) {
          await deleteCalendarEvent(newParent.id, SYNC_CODE);
        }
        setPlannerEventError("Could not split this series safely. Please try again.");
        return;
      }

      setCalendarEvents((prev) => [
        ...prev.map((item) => (item.id === oldParent.id ? oldParent : item)),
        newParent,
      ]);
      setPlannerEventModalOpen(false);
      setPlannerEventDraft(null);
      return;
    }

    const eventToSave = plannerEventDraft.recurrenceParentId
      ? exceptionEventForPlannerOccurrence(event)
      : event;
    const saved = await saveCalendarEvent(eventToSave, SYNC_CODE);
    setPlannerEventSaving(false);

    if (!saved) {
      setPlannerEventError("Could not save event. Please check the console for details.");
      return;
    }

    setCalendarEvents((prev) => {
      const exists = prev.some((item) => item.id === eventToSave.id);
      return exists
        ? prev.map((item) => (item.id === eventToSave.id ? eventToSave : item))
        : [...prev, eventToSave];
    });
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
  }

  async function removePlannerEvent() {
    if (!plannerEventDraft || plannerEventModalMode !== "edit" || plannerEventSaving) return;

    setPlannerEventSaving(true);
    setPlannerEventError(null);

    const deleted = await deleteCalendarEvent(plannerEventDraft.id, SYNC_CODE);
    setPlannerEventSaving(false);

    if (!deleted) {
      setPlannerEventError("Could not delete event. Please check the console for details.");
      return;
    }

    setCalendarEvents((prev) => prev.filter((event) => event.id !== plannerEventDraft.id));
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
  }

  async function cancelPlannerRecurringOccurrence() {
    if (
      !plannerEventDraft ||
      plannerEventModalMode !== "edit" ||
      !plannerEventDraft.recurrenceParentId ||
      !plannerEventDraft.recurrenceExceptionDate ||
      plannerEventSaving
    ) {
      return;
    }

    const { event, error } = calendarEventFromDraft(plannerEventDraft);
    if (!event || error) {
      setPlannerEventError(error ?? "Could not cancel this occurrence.");
      return;
    }

    const cancellation: CalendarEvent = {
      ...event,
      id: calendarEvents.some((item) => item.id === plannerEventDraft.id)
        ? plannerEventDraft.id
        : createCalendarEventId(),
      recurrenceRule: null,
      recurrenceParentId: plannerEventDraft.recurrenceParentId,
      recurrenceExceptionDate: plannerEventDraft.recurrenceExceptionDate,
      recurrenceStatus: "cancelled",
      metadata: {},
    };

    setPlannerEventSaving(true);
    setPlannerEventError(null);
    const saved = await saveCalendarEvent(cancellation, SYNC_CODE);
    setPlannerEventSaving(false);

    if (!saved) {
      setPlannerEventError("Could not cancel occurrence. Please check the console for details.");
      return;
    }

    setCalendarEvents((prev) => {
      const exists = prev.some((item) => item.id === cancellation.id);
      return exists
        ? prev.map((item) => (item.id === cancellation.id ? cancellation : item))
        : [...prev, cancellation];
    });
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
  }

  function beginPlannerEventInteraction(
    event: React.PointerEvent<HTMLDivElement>,
    calendarEvent: CalendarEvent,
    kind: "move" | "resize"
  ) {
    if (event.button !== 0 || calendarEvent.allDay || !calendarEvent.startAt || !calendarEvent.endAt) return;

    const startMinutes = localMinutesFromTimestamp(calendarEvent.startAt);
    const endMinutes = localMinutesFromTimestamp(calendarEvent.endAt);
    const startDate = eventLocalDate(calendarEvent.startAt);
    const endDate = eventLocalDate(calendarEvent.endAt);
    const grid = event.currentTarget.closest("[data-planner-week-grid='true']");

    if (
      startMinutes === null ||
      endMinutes === null ||
      !startDate ||
      !endDate ||
      startDate !== endDate ||
      !grid
    ) {
      return;
    }

    const duration = endMinutes - startMinutes;
    const visibleDuration = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 60;
    if (duration < PLANNER_SNAP_MINUTES || duration > visibleDuration) return;

    const gridRect = grid.getBoundingClientRect();
    const dayWidth = (gridRect.width - 64) / 7;
    if (!Number.isFinite(dayWidth) || dayWidth <= 0) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    setPlannerInteraction({
      kind,
      eventId: calendarEvent.id,
      originalEvent: calendarEvent,
      previewEvent: calendarEvent,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      gridLeft: gridRect.left,
      dayWidth,
      originalStartMinutes: startMinutes,
      originalEndMinutes: endMinutes,
      originalDurationMinutes: duration,
      hasMoved: false,
    });
  }

  function openEdit(t: Task) {
    setDraft(t);
    setEditOpen(true);
  }

  function saveEdit(next: Task) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === next.id
          ? applyTaskStatus(
              { ...next, completedAt: next.completedAt ?? t.completedAt ?? null },
              next.status
            )
          : t
      )
    );
    setEditOpen(false);
    setDraft(null);
  }

  function openLogTime(taskId?: string, date = clientToday || todayISO(), log?: TimeLog) {
    const selectedTaskId = taskId ?? loggerTasks[0]?.id ?? logTaskOptions[0]?.id ?? "";
    const existing = log ?? null;
    const existingHoursInput = existing && isClosedTimeLog(existing) ? formatHourInput(existing.hours) : "";
    const startDate = existing?.date ?? date;

    setPlannerLogSourceEventId(null);
    setEditingLogId(existing?.id ?? null);
    setLogTaskId(existing?.taskId ?? selectedTaskId);
    setLogDate(startDate);
    setLogStartTime(existing?.startTime ?? "");
    setLogEndDate(existing?.endDate ?? startDate);
    setLogEndTime(existing?.endTime ?? "");
    setLogHoursInput(existingHoursInput);
    setLogNote(existing?.note ?? "");
    setLogOpen(true);
  }

  async function savePlannerWorkResolution(
    event: CalendarEvent,
    status: PlannerWorkResolutionStatus,
    loggedTimeLogId: string | null = null
  ) {
    const resolvedEvent = withPlannerWorkResolution(event, status, loggedTimeLogId);
    const saved = await saveCalendarEvent(resolvedEvent, SYNC_CODE);

    if (!saved) {
      console.warn("Failed to save Planner work resolution", {
        eventId: event.id,
        status,
        loggedTimeLogId,
      });
      return false;
    }

    setCalendarEvents((prev) =>
      prev.map((item) => (item.id === resolvedEvent.id ? resolvedEvent : item))
    );
    return true;
  }

  async function logPlannerWorkAsPlanned(event: CalendarEvent) {
    if (plannerWorkActionSavingId || plannerWorkResolutionStatus(event)) return;
    const log = plannedWorkTimeLogFromEvent(event);

    if (!log || !event.taskId || !taskById[event.taskId]) {
      console.warn("Cannot log planned work without a linked task and valid planned time", { eventId: event.id });
      return;
    }

    setPlannerWorkActionSavingId(event.id);
    const savedLog = await saveSupabaseTimeLog(SYNC_CODE, log);

    if (!savedLog) {
      console.warn("Failed to save TimeLog from planned work", { eventId: event.id, logId: log.id });
      setPlannerWorkActionSavingId(null);
      return;
    }

    const savedResolution = await savePlannerWorkResolution(event, "logged", log.id);

    if (!savedResolution) {
      await deleteSupabaseTimeLog(SYNC_CODE, log.id);
      setPlannerWorkActionSavingId(null);
      return;
    }

    setTimeLogs((prev) => [log, ...prev]);
    setPlannerWorkActionSavingId(null);
  }

  function adjustPlannerWorkLog(event: CalendarEvent) {
    if (plannerWorkResolutionStatus(event)) return;
    const log = plannedWorkTimeLogFromEvent(event);

    if (!log || !event.taskId || !taskById[event.taskId]) {
      openPlannerEventEdit(event);
      return;
    }

    setPlannerLogSourceEventId(event.id);
    setEditingLogId(null);
    setLogTaskId(log.taskId);
    setLogDate(log.date);
    setLogStartTime(log.startTime ?? "");
    setLogEndDate(log.endDate ?? log.date);
    setLogEndTime(log.endTime ?? "");
    setLogHoursInput(formatHourInput(log.hours ?? 0));
    setLogNote(log.note);
    setLogOpen(true);
  }

  async function skipPlannerWorkEvent(event: CalendarEvent) {
    if (plannerWorkActionSavingId || plannerWorkResolutionStatus(event)) return;

    setPlannerWorkActionSavingId(event.id);
    await savePlannerWorkResolution(event, "skipped");
    setPlannerWorkActionSavingId(null);
  }

  function setLoggerAnchor(nextAnchor: string) {
    setLoggerAnchorDate(nextAnchor);
  }

  function moveLoggerSelectedRange(direction: -1 | 1) {
    if (loggerRangeMode === "custom") return;

    const anchor = isValidISODate(loggerAnchorDate)
      ? loggerAnchorDate
      : isValidISODate(clientToday)
        ? clientToday
        : todayISO();
    const nextAnchor =
      loggerRangeMode === "week"
        ? addDaysISO(anchor, direction * 7)
        : loggerRangeMode === "month"
          ? addMonthsISO(anchor, direction)
          : addYearsISO(anchor, direction);

    setLoggerAnchor(nextAnchor);
  }

  function returnLoggerRangeToToday() {
    const today = todayISO();
    setClientToday(today);
    setLoggerAnchor(today);
  }

  async function persistTimeLogDraft(next: TimeLog, existing: TimeLog | null, sourcePlannerEvent: CalendarEvent | null) {
    const saved = await saveSupabaseTimeLog(SYNC_CODE, next);

    if (!saved) {
      console.warn("Unexpected Supabase time log save failure:", {
        operation: existing ? "edit" : "create",
        id: next.id,
      });
      if (sourcePlannerEvent) return false;
    }

    if (sourcePlannerEvent) {
      const savedResolution = await savePlannerWorkResolution(sourcePlannerEvent, "logged", next.id);
      if (!savedResolution) {
        await deleteSupabaseTimeLog(SYNC_CODE, next.id);
        return false;
      }
    }

    setTimeLogs((prev) => {
      if (!existing) return [next, ...prev];
      return prev.map((entry) => (entry.id === existing.id ? next : entry));
    });

    setEditingLogId(null);
    setPlannerLogSourceEventId(null);
    setLogOpen(false);
    return true;
  }

  async function submitTimeLog() {
    if (logSaving) return;
    const closingOpenSession = editingTimeLog ? isOpenTimeLog(editingTimeLog) : false;
    const hours = closingOpenSession
      ? calculatedLogHours
      : resolveClosedTimeLogHours(logHoursInput, calculatedLogHours, logStartTime, logEndTime);
    if (!logTaskId || hours === null) return;

    const date = logDate || clientToday || todayISO();
    const existing = editingTimeLog;
    const next: TimeLog = {
      id: existing?.id ?? createTimeLogId(),
      taskId: logTaskId,
      date,
      startTime: logStartTime || undefined,
      endDate: logEndTime ? logEndDate || date : null,
      endTime: logEndTime || undefined,
      hours,
      note: logNote.trim(),
    };

    const sourcePlannerEvent = plannerLogSourceEventId
      ? calendarEvents.find((event) => event.id === plannerLogSourceEventId)
      : null;
    setLogSaving(true);
    try {
      await persistTimeLogDraft(next, existing, sourcePlannerEvent);
    } finally {
      setLogSaving(false);
    }
  }

  async function startOpenTimeLog() {
    if (logSaving) return;
    const date = logDate || clientToday || todayISO();
    if (!logTaskId || !isTimeLogISODate(date) || timeLogTimeToMinutes(logStartTime) === null) return;

    const existing = editingTimeLog;
    const next: TimeLog = {
      id: existing?.id ?? createTimeLogId(),
      taskId: logTaskId,
      date,
      startTime: logStartTime,
      endDate: null,
      endTime: undefined,
      hours: null,
      note: logNote.trim(),
    };

    if (!isOpenTimeLog(next)) return;

    setLogSaving(true);
    try {
      await persistTimeLogDraft(next, existing, null);
    } finally {
      setLogSaving(false);
    }
  }

  function deleteTimeLog(id: string) {
    setTimeLogs((prev) => prev.filter((log) => log.id !== id));
    void deleteSupabaseTimeLog(SYNC_CODE, id).catch((error) => {
      console.warn("Unexpected Supabase time log delete failure:", {
        operation: "delete",
        id,
        error,
      });
    });
    if (editingLogId === id) {
      setEditingLogId(null);
      setLogOpen(false);
    }
  }

  function exportBackup() {
    const createdAt = new Date().toISOString();
    const backup = {
      createdAt,
      tasks,
      timeLogs,
      attentionWeights: weights,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${isDemoMode ? "demo" : "yasmine"}-task-backup-${createdAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      console.warn("Import backup failed: invalid JSON", error);
      window.alert("That backup file could not be read as JSON.");
      return;
    }

    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { tasks?: unknown }).tasks)) {
      console.warn("Import backup failed: backup does not contain a tasks array");
      window.alert("That backup is missing a tasks array.");
      return;
    }

    const incoming = parsed as {
      tasks: Array<Record<string, unknown>>;
      timeLogs?: unknown;
      attentionWeights?: unknown;
    };
    const nextTasks = incoming.tasks.map((task) => normalizeTask(task));
    const nextTimeLogs = normalizeTimeLogs(incoming.timeLogs);
    const confirmed = window.confirm(
      `Restore ${nextTasks.length} tasks from this backup? Current tasks and logs will be backed up first.`
    );

    if (!confirmed) return;

    createLocalBackup(tasks, timeLogsRef.current);
    refreshBackupStatus();

    if (incoming.attentionWeights && typeof incoming.attentionWeights === "object") {
      const restoredWeights = normalizeAttentionWeights(incoming.attentionWeights);
      setWeights(restoredWeights);
      localStorage.setItem("attentionWeights", JSON.stringify(restoredWeights));
    }

    timeLogsRef.current = nextTimeLogs;
    setTimeLogs(nextTimeLogs);
    localStorage.setItem(TIME_LOGS_STORAGE_KEY, JSON.stringify(nextTimeLogs));

    allowNextEmptySaveRef.current = true;
    allowNextDestructiveSaveRef.current = true;
    remoteLoadTrustedForDeleteRef.current = true;
    saveLocalTaskCache(nextTasks);
    setTasks(nextTasks);
  }

  function renderListFilterMenu<T extends string>({
    id,
    label,
    count,
    options,
    selected,
    onToggle,
  }: {
    id: ListFilterMenu;
    label: string;
    count: number;
    options: { id: T; label: string }[];
    selected: T[];
    onToggle: (value: T) => void;
  }) {
    const isOpen = openListFilter === id;

    return (
      <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`h-9 rounded-xl border px-3 text-sm ${
            count
              ? "border-slate-300 bg-slate-50 text-slate-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenStatusTaskId(null);
            setOpenListFilter((open) => (open === id ? null : id));
          }}
        >
          {label}
          {count ? <span className="text-slate-400"> · {count}</span> : null}
        </button>
        {isOpen ? (
          <div className="absolute left-0 top-full z-[1000] mt-1 min-w-[148px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-xl ring-1 ring-slate-900/5">
            {options.map((option) => {
              const active = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`block w-full whitespace-nowrap bg-white px-3 py-2 text-left ${
                    active ? "font-medium text-slate-900" : "text-slate-600"
                  } hover:bg-slate-50`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(option.id);
                  }}
                >
                  {active ? "✓ " : ""}
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function renderRangeFilterMenu({
    id,
    buttonLabel,
    title,
    range,
    defaultRange,
    minValue,
    maxValue,
    formatValue,
    setRange,
    resetLabel,
    step = 1,
  }: {
    id: Extract<ListFilterMenu, "timeLeft" | "duration">;
    buttonLabel: string;
    title: string;
    range: { min: number; max: number } | null;
    defaultRange: { min: number; max: number };
    minValue: number;
    maxValue: number;
    formatValue: (value: number) => string;
    setRange: React.Dispatch<React.SetStateAction<{ min: number; max: number } | null>>;
    resetLabel: string;
    step?: number;
  }) {
    const isOpen = openListFilter === id;
    const currentRange = range ?? defaultRange;
    const minPercent = ((currentRange.min - minValue) / (maxValue - minValue)) * 100;
    const maxPercent = ((currentRange.max - minValue) / (maxValue - minValue)) * 100;

    function snap(value: number) {
      return Number((Math.round(value / step) * step).toFixed(4));
    }

    function setMin(value: number) {
      const rawMin = snap(clamp(value, minValue, maxValue));
      setRange((current) => {
        const max = current?.max ?? maxValue;
        return { min: Math.min(rawMin, max), max };
      });
    }

    function setMax(value: number) {
      const rawMax = snap(clamp(value, minValue, maxValue));
      setRange((current) => {
        const min = current?.min ?? minValue;
        return { min, max: Math.max(rawMax, min) };
      });
    }

    function valueFromPointer(clientX: number, track: HTMLDivElement) {
      const rect = track.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      return snap(minValue + percent * (maxValue - minValue));
    }

    function beginMinDrag(e: React.PointerEvent<HTMLDivElement>) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMin(valueFromPointer(e.clientX, track));
    }

    function beginMaxDrag(e: React.PointerEvent<HTMLDivElement>) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMax(valueFromPointer(e.clientX, track));
    }

    function dragMin(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMin(valueFromPointer(e.clientX, track));
    }

    function dragMax(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMax(valueFromPointer(e.clientX, track));
    }

    return (
      <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`h-9 rounded-xl border px-3 text-sm ${
            range
              ? "border-slate-300 bg-slate-50 text-slate-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenStatusTaskId(null);
            setOpenListFilter((open) => (open === id ? null : id));
          }}
        >
          {buttonLabel}
        </button>
        {isOpen ? (
          <div className="absolute left-0 top-full z-[1000] mt-1 w-[230px] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl ring-1 ring-slate-900/5">
            <div className="font-medium text-slate-700">{title}</div>

            <div className="mt-4">
              <div className="mb-2 flex justify-between tabular-nums text-slate-500">
                <span>{formatValue(currentRange.min)}</span>
                <span>{formatValue(currentRange.max)}</span>
              </div>
              <div className="relative h-7">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
                <div
                  className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-slate-900"
                  style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
                />
                <div
                  className="absolute top-1/2 z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border border-slate-900 bg-slate-900 shadow-sm active:cursor-grabbing"
                  style={{ left: `${minPercent}%` }}
                  onPointerDown={beginMinDrag}
                  onPointerMove={dragMin}
                />
                <div
                  className="absolute top-1/2 z-40 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border border-slate-900 bg-slate-900 shadow-sm active:cursor-grabbing"
                  style={{ left: `${maxPercent}%` }}
                  onPointerDown={beginMaxDrag}
                  onPointerMove={dragMax}
                />
                <input
                  type="range"
                  aria-label={`${title} minimum`}
                  min={minValue}
                  max={maxValue}
                  step={step}
                  value={currentRange.min}
                  onChange={(e) => setMin(Number(e.target.value))}
                  className="sr-only"
                />
                <input
                  type="range"
                  aria-label={`${title} maximum`}
                  min={minValue}
                  max={maxValue}
                  step={step}
                  value={currentRange.max}
                  onChange={(e) => setMax(Number(e.target.value))}
                  className="sr-only"
                />
              </div>
            </div>

            <button
              type="button"
              className="mt-2 rounded-full px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                setRange(null);
              }}
            >
              {resetLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderTimeLeftFilterMenu() {
    const range = timeLeftFilter ?? { min: TIME_LEFT_MIN, max: TIME_LEFT_MAX };
    return renderRangeFilterMenu({
      id: "timeLeft",
      buttonLabel: timeLeftFilter ? `Time left · ${range.min}-${range.max}d` : "Time left",
      title: "Time left",
      range: timeLeftFilter,
      defaultRange: { min: TIME_LEFT_MIN, max: TIME_LEFT_MAX },
      minValue: TIME_LEFT_MIN,
      maxValue: TIME_LEFT_MAX,
      formatValue: (value) => `${value}d`,
      setRange: setTimeLeftFilter,
      resetLabel: "Reset time left",
      step: 1,
    });
  }

  function renderDurationFilterMenu() {
    const range = durationFilter ?? { min: DURATION_MIN_HOURS, max: DURATION_MAX_HOURS };
    return renderRangeFilterMenu({
      id: "duration",
      buttonLabel: durationFilter
        ? `Duration · ${formatDurationFilterLabel(range.min)}-${formatDurationFilterLabel(range.max)}`
        : "Duration",
      title: "Duration",
      range: durationFilter,
      defaultRange: { min: DURATION_MIN_HOURS, max: DURATION_MAX_HOURS },
      minValue: DURATION_MIN_HOURS,
      maxValue: DURATION_MAX_HOURS,
      formatValue: formatDurationFilterLabel,
      setRange: setDurationFilter,
      resetLabel: "Reset duration",
      step: 1 / 12,
    });
  }

  const pageTitle = modeLabel(mode);
  const pageSubtitle = modeSubtitle(mode);

  return (
    <div className="min-h-screen w-full bg-[#f7f8f8] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200/80 bg-white/85 py-5 backdrop-blur transition-[width] duration-200 md:flex md:flex-col ${
          sidebarCollapsed ? "w-16 px-2" : "w-60 px-4"
        }`}
      >
        <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3 px-2"}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-2 gap-0.5">
              <span className="h-2 w-2 rounded-sm bg-slate-900" />
              <span className="h-2 w-2 rounded-sm bg-slate-300" />
              <span className="h-2 w-2 rounded-sm bg-slate-300" />
              <span className="h-2 w-2 rounded-sm bg-slate-900" />
            </div>
          </div>
          {!sidebarCollapsed ? (
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-slate-900">
              {isDemoMode ? "Tracker Playground" : "Yasmine's Tracker"}
            </div>
            <div className="text-[11px] text-slate-400">Personal operating system</div>
          </div>
          ) : null}
        </div>

        <nav className="mt-8 grid gap-1">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`group relative flex h-9 items-center rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
                } ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
                {sidebarCollapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          className={`mt-auto flex h-9 items-center rounded-xl text-sm text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-800 ${
            sidebarCollapsed ? "justify-center px-0" : "gap-2 px-3"
          }`}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
          {!sidebarCollapsed ? <span>Collapse</span> : null}
        </button>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] transition-colors ${
                  active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className={`min-h-screen pb-24 transition-[margin] duration-200 md:pb-8 ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"}`}>
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="border-b border-slate-200/70 pb-4">
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                {isDemoMode ? "Task Tracker Playground" : "Yasmine's Tracker"}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">{pageTitle}</h1>
              <p className="max-w-xl text-sm text-slate-500">{pageSubtitle}</p>
            </div>
        </div>

        {/* Main */}
        {mode === "list" ? (
          <>
            <div className="mt-5 hidden items-center justify-end gap-2 rounded-[18px] border border-slate-200/70 bg-white p-2 md:flex md:flex-wrap">
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 lg:w-[180px]"
              >
                <option value="all">Category</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryDisplayLabel(c)}
                  </option>
                ))}
              </select>

              {renderListFilterMenu<Status>({
                id: "status",
                label: "Status",
                count: statusFilters.length,
                options: LIST_STATUS_OPTIONS,
                selected: statusFilters,
                onToggle: (value) => setStatusFilters((prev) => toggleFilterValue(prev, value)),
              })}

              {renderListFilterMenu<Priority>({
                id: "priority",
                label: "Priority",
                count: priorityFilters.length,
                options: PRIORITIES,
                selected: priorityFilters,
                onToggle: (value) => setPriorityFilters((prev) => toggleFilterValue(prev, value)),
              })}

              {renderListFilterMenu<string>({
                id: "difficulty",
                label: "Difficulty",
                count: difficultyFilters.length,
                options: DIFFICULTY_FILTERS.map((value) => ({ id: value, label: value })),
                selected: difficultyFilters,
                onToggle: (value) => setDifficultyFilters((prev) => toggleFilterValue(prev, value)),
              })}

              {renderTimeLeftFilterMenu()}
              {renderDurationFilterMenu()}

              <div className="relative">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search (press /)"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 lg:w-[260px]"
                />
              </div>

              <button
                onClick={() => setNewOpen(true)}
                className="h-9 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                New
              </button>
            </div>

            <div className="mt-5 md:hidden">
              <div className="flex items-center gap-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks"
                  className="h-10 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMobileTaskFiltersOpen((open) => !open);
                    setOpenListFilter(null);
                  }}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Filters
                  {activeTaskFilterCount ? <span className="text-slate-400"> · {activeTaskFilterCount}</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setNewOpen(true)}
                  className="h-10 rounded-2xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  New
                </button>
              </div>

              {mobileTaskFiltersOpen ? (
                <div className="mt-2 rounded-[18px] border border-slate-200 bg-white p-3 shadow-lg ring-1 ring-slate-900/5">
                  <div className="grid gap-2">
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="all">Category</option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {categoryDisplayLabel(c)}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      {renderListFilterMenu<Status>({
                        id: "status",
                        label: "Status",
                        count: statusFilters.length,
                        options: LIST_STATUS_OPTIONS,
                        selected: statusFilters,
                        onToggle: (value) => setStatusFilters((prev) => toggleFilterValue(prev, value)),
                      })}

                      {renderListFilterMenu<Priority>({
                        id: "priority",
                        label: "Priority",
                        count: priorityFilters.length,
                        options: PRIORITIES,
                        selected: priorityFilters,
                        onToggle: (value) => setPriorityFilters((prev) => toggleFilterValue(prev, value)),
                      })}

                      {renderListFilterMenu<string>({
                        id: "difficulty",
                        label: "Difficulty",
                        count: difficultyFilters.length,
                        options: DIFFICULTY_FILTERS.map((value) => ({ id: value, label: value })),
                        selected: difficultyFilters,
                        onToggle: (value) => setDifficultyFilters((prev) => toggleFilterValue(prev, value)),
                      })}

                      {renderTimeLeftFilterMenu()}
                      {renderDurationFilterMenu()}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 divide-y divide-slate-100 rounded-[18px] border border-slate-200/70 bg-white">
                {listRows.length ? (
                  listRows.map((t) => {
                    const days = t.due ? daysLeftFromISO(t.due) : null;
                    const deadlineLabel = days === null ? null : timeLeftLabel(days);
                    const effort = taskDisplayEffortLevel(t);
                    const showPriority = t.priority === "high" || t.priority === "low";
                    const statusMenuOpen = openStatusTaskId === t.id;

                    return (
                      <div
                        key={`mobile-task-${t.id}`}
                        className={`relative cursor-pointer bg-white px-3 py-3 hover:bg-slate-50/70 ${t.status === "frozen" ? "text-slate-400" : ""}`}
                        onClick={() => openEdit(t)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openEdit(t);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm font-medium ${frozenTitleClass(t)}`}>{t.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span className="truncate">{courseLabel(t.courseId)}</span>
                              <span className="text-slate-300">·</span>
                              <button
                                type="button"
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPill(t.status)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenListFilter(null);
                                  setOpenStatusTaskId((id) => (id === t.id ? null : t.id));
                                }}
                              >
                                {statusLabel(t.status)}
                              </button>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              {deadlineLabel ? (
                                <span className={days !== null && days <= 2 ? "text-rose-600" : ""}>{deadlineLabel}</span>
                              ) : null}
                              {effort ? <span>{effortLabel(effort)}</span> : null}
                              {showPriority ? <span>{priorityLabel(t.priority)}</span> : null}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              completeTask(t.id);
                            }}
                            aria-label="Mark completed"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        {statusMenuOpen ? (
                          <div
                            className="absolute left-3 top-14 z-[1000] min-w-[136px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-xl ring-1 ring-slate-900/5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {LIST_STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className="block w-full whitespace-nowrap bg-white px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTaskStatus(t.id, option.id);
                                }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-slate-400">No tasks match these filters.</div>
                )}
              </div>
            </div>

            <div className="mt-5 hidden overflow-x-auto overflow-y-visible rounded-[18px] border border-slate-200/70 bg-white md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-xs text-slate-500">
                  <tr>
                    {([
                      ["title", "Title"],
                      ["course", "Category"],
                      ["status", "Status"],
                      ["priority", "Priority"],
                      ["due", "Due"],
                      ["timeLeft", "Time left"],
                      ["effort", "Effort"],
                      ["difficulty", "Difficulty"],
                    ] as Array<[typeof listSortKey, string]>).map(([key, label]) => (
                      <th key={key} className="px-3 py-2 text-left font-medium">
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => {
                            if (listSortKey === key) setListSortDir((d) => (d === "asc" ? "desc" : "asc"));
                            else {
                              setListSortKey(key);
                              setListSortDir("asc");
                            }
                          }}
                        >
                          {label} {listSortKey === key ? (listSortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {listRows.map((t) => {
                    const days = t.due ? daysLeftFromISO(t.due) : null;
                    const statusMenuOpen = openStatusTaskId === t.id;
                    return (
                      <tr
                        key={t.id}
                        className={`relative cursor-pointer border-t border-slate-100/80 hover:bg-slate-50/70 ${
                          statusMenuOpen ? "z-50" : "z-0"
                        }`}
                        onClick={() => openEdit(t)}
                      >
                        <td className={`max-w-[420px] truncate px-3 py-2.5 font-medium text-slate-900 ${frozenTitleClass(t)}`}>{t.title}</td>
                        <td className={`px-3 py-2.5 ${t.status === "frozen" ? "text-slate-400" : "text-slate-500"}`}>{courseLabel(t.courseId)}</td>
                        <td
                          className={`relative px-3 py-2.5 ${statusMenuOpen ? "z-[120]" : "z-0"}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="relative z-[130] inline-flex">
                            <button
                              type="button"
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPill(t.status)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenListFilter(null);
                                setOpenStatusTaskId((id) => (id === t.id ? null : t.id));
                              }}
                            >
                              {statusLabel(t.status)}
                            </button>
                            {statusMenuOpen ? (
                              <div
                                className="absolute left-0 top-full z-[999] mt-1 min-w-[136px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-xl ring-1 ring-slate-900/5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {LIST_STATUS_OPTIONS.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className="block w-full whitespace-nowrap bg-white px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTaskStatus(t.id, option.id);
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{priorityLabel(t.priority)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-500">{t.due ?? "—"}</td>
                        <td className={`px-3 py-2.5 tabular-nums ${days !== null && days <= 2 ? "text-red-600" : "text-slate-500"}`}>
                          {days === null ? "—" : timeLeftLabel(days)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{effortLabel(taskDisplayEffortLevel(t))}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-500">{t.difficulty == null ? "—" : t.difficulty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!listRows.length ? (
                <div className="border-t border-slate-100 px-3 py-8 text-center text-sm text-slate-400">
                  No tasks match these filters.
                </div>
              ) : null}
            </div>

            {completedRows.length ? (
              <section className="mt-5 rounded-[18px] border border-slate-200/70 bg-white p-4">
                <div className="text-sm font-semibold text-slate-700">Completed</div>
                <div className="mt-1 text-xs text-slate-400">
                  Recoverable for {COMPLETED_RECOVERY_DAYS} days, then hidden from this list.
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  {completedRows.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 py-2 opacity-70">
                      <button
                        type="button"
                        onClick={() => openEdit(task)}
                        className="min-w-0 text-left"
                      >
                        <div className="truncate text-sm font-medium text-slate-600">{task.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>{courseLabel(task.courseId)}</span>
                          <span>{task.completedAt ? `Completed ${task.completedAt.slice(0, 10)}` : "Completed date unknown"}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreTask(task.id)}
                        className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : mode === "planner" ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                  {([
                    { id: "week", label: "Week" },
                    { id: "month", label: "Month" },
                    { id: "year", label: "Year" },
                  ] as Array<{ id: PlannerView; label: string }>).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPlannerView(option.id)}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        plannerView === option.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSmartImport}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Quick Add
                </button>

                <button
                  type="button"
                  onClick={openPlannerEventTypeChooser}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-700 hover:bg-slate-50"
                  aria-label="Add calendar event"
                >
                  +
                </button>
              </div>
            </div>

            {plannerView === "week" ? (
              <div className="pt-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-medium text-slate-500">{plannerWeekLabel}</div>
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => movePlannerWeek(-1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Previous week"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      onClick={returnPlannerToToday}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlannerWeek(1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Next week"
                    >
                      &gt;
                    </button>
                  </div>
                </div>

                <div className="md:hidden">
                  <div className="grid grid-cols-7 gap-1">
                    {plannerWeekDays.map((day) => {
                      const date = new Date(day + "T00:00:00");
                      const isToday = day === clientToday;
                      const isSelected = day === plannerMobileWeekDate;

                      return (
                        <button
                          key={`mobile-week-${day}`}
                          type="button"
                          onClick={() => setPlannerMobileSelectedDate(day)}
                          className={`rounded-2xl border px-1 py-2 text-center transition-colors ${
                            isSelected
                              ? "border-slate-900 bg-white text-slate-950"
                              : "border-slate-200/80 bg-white/70 text-slate-500 hover:bg-white"
                          }`}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-[0.1em]">
                            {new Intl.DateTimeFormat("en", { weekday: "short" }).format(date)}
                          </div>
                          <div
                            className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                              isToday ? "bg-slate-900 text-white" : ""
                            }`}
                          >
                            {date.getDate()}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 rounded-[18px] border border-slate-200/70 bg-white p-3">
                    {!plannerMobileAllDayItems.length && !plannerMobileTimedLayouts.length ? (
                      <div className="py-1 text-xs text-slate-400">No events</div>
                    ) : (
                      <>
                        {plannerMobileAllDayItems.length ? (
                          <div className="mb-3 space-y-1.5">
                            {plannerMobileAllDayItems.map((item) => (
                              <button
                                key={`mobile-all-day-${plannerMobileWeekDate}-${item.sourceType === "calendar_event" ? item.event.id : item.task.id}`}
                                type="button"
                                onClick={() =>
                                  item.sourceType === "calendar_event"
                                    ? openPlannerEventEdit(item.event)
                                    : openEdit(item.task)
                                }
                                className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-xs font-medium ${
                                  item.sourceType === "calendar_event"
                                    ? plannerEventTone(item.event.eventType)
                                    : plannerDeadlineTone(item.task)
                                }`}
                              >
                                {item.sourceType === "calendar_event" ? (
                                  <PlannerEventTypeIcon eventType={item.event.eventType} />
                                ) : (
                                  <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                                )}
                                <span className="truncate">{plannerItemTitle(item)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          {plannerMobileTimedLayouts.map((layout) => {
                            const timeRange = `${formatPlannerEventTime(layout.event.startAt)}${
                              layout.event.endAt ? `-${formatPlannerEventTime(layout.event.endAt)}` : ""
                            }`;
                            return (
                              <button
                                key={`mobile-timed-${plannerMobileWeekDate}-${layout.event.id}`}
                                type="button"
                                onClick={() => openPlannerEventEdit(layout.event)}
                                className={`flex w-full min-w-0 items-start gap-2 rounded-2xl border px-3 py-2 text-left text-xs ${plannerEventTone(
                                  layout.event.eventType
                                )}`}
                              >
                                <PlannerEventTypeIcon eventType={layout.event.eventType} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{layout.event.title}</span>
                                  {timeRange ? <span className="mt-0.5 block text-[11px] opacity-70">{timeRange}</span> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="hidden md:block md:overflow-x-auto">
                  <div className="min-w-[860px] overflow-hidden rounded-[18px] border border-slate-200/70 bg-white">
                    <div className="grid grid-cols-[64px_repeat(7,minmax(96px,1fr))] border-b border-slate-100/80 bg-white">
                      <div className="border-r border-slate-100/80" />
                      {plannerWeekDays.map((day) => {
                        const date = new Date(day + "T00:00:00");
                        const isToday = day === clientToday;

                        return (
                          <div
                            key={day}
                            className={`border-r border-slate-100/80 px-2 py-3 text-center last:border-r-0 ${
                              isToday ? "bg-slate-50" : ""
                            }`}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {new Intl.DateTimeFormat("en", { weekday: "short" }).format(date)}
                            </div>
                            <div
                              className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                                isToday ? "bg-slate-900 text-white" : "text-slate-700"
                              }`}
                            >
                              {date.getDate()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-[64px_1fr] border-b border-slate-100/80 bg-slate-50/30">
                      <div className="border-r border-slate-100/80 px-3 py-3 text-xs font-medium text-slate-400">
                        All day
                      </div>
                      <div
                        className="relative grid grid-cols-7"
                        style={{ minHeight: Math.max(48, 14 + plannerWeekAllDaySpans.length * 26) }}
                      >
                        {plannerWeekDays.map((day) => (
                          <div
                            key={`all-day-bg-${day}`}
                            className={`border-r border-slate-100/80 px-2 py-2 text-center text-sm text-slate-300 last:border-r-0 ${
                              day === clientToday ? "bg-slate-100/50" : ""
                            }`}
                          >
                            {!plannerWeekAllDaySpans.length ? "·" : null}
                          </div>
                        ))}
                        {plannerWeekAllDaySpans.length ? (
                          <div
                            className="absolute inset-x-0 top-1.5 grid grid-cols-7 gap-y-1 px-1.5"
                            style={{
                              gridTemplateRows: `repeat(${plannerWeekAllDaySpans.length}, 22px)`,
                            }}
                          >
                            {plannerWeekAllDaySpans.map((span, index) => (
                              <button
                                key={plannerAllDaySpanKey(span, "week")}
                                type="button"
                                onClick={() =>
                                  span.item.sourceType === "calendar_event"
                                    ? openPlannerEventEdit(span.item.event)
                                    : openEdit(span.item.task)
                                }
                                className={`flex min-w-0 items-center gap-1 border px-2 py-1 text-left text-[11px] font-medium ${
                                  span.startsBefore ? "rounded-l-sm" : "rounded-l-lg"
                                } ${span.endsAfter ? "rounded-r-sm" : "rounded-r-lg"} ${
                                  span.item.sourceType === "calendar_event"
                                    ? plannerEventTone(span.item.event.eventType)
                                    : plannerDeadlineTone(span.item.task)
                                }`}
                                style={{
                                  gridColumn: `${span.startIndex + 1} / span ${span.span}`,
                                  gridRow: index + 1,
                                }}
                                title={plannerItemTitle(span.item)}
                              >
                                {span.item.sourceType === "calendar_event" ? (
                                  <PlannerEventTypeIcon eventType={span.item.event.eventType} />
                                ) : (
                                  <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                                )}
                                <span className="truncate">{plannerItemTitle(span.item)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div ref={plannerWeekScrollRef} className="max-h-[620px] overflow-y-auto">
                      <div
                        data-planner-week-grid="true"
                        className="relative grid grid-cols-[64px_repeat(7,minmax(96px,1fr))]"
                        style={{ height: (PLANNER_END_HOUR - PLANNER_START_HOUR) * PLANNER_HOUR_HEIGHT }}
                      >
                        <div className="relative border-r border-slate-100/80 bg-white">
                          {plannerHours.slice(0, -1).map((hour, index) => (
                            <div
                              key={hour}
                              className="absolute right-3 -translate-y-2 text-[10px] tabular-nums text-slate-400"
                              style={{ top: index * PLANNER_HOUR_HEIGHT }}
                            >
                              {hour}
                            </div>
                          ))}
                        </div>

                        {plannerWeekDays.map((day) => (
                          <div
                            key={`timed-${day}`}
                            className={`relative border-r border-slate-100/80 last:border-r-0 ${
                              day === clientToday ? "bg-slate-50/40" : "bg-white"
                            }`}
                          >
                            {plannerHours.slice(0, -1).map((hour, index) => (
                              <div
                                key={`${day}-${hour}`}
                                className="absolute left-0 right-0 border-t border-slate-100/80"
                                style={{ top: index * PLANNER_HOUR_HEIGHT }}
                              />
                            ))}
                            {day === clientToday && currentTimeTop !== null ? (
                              <div
                                className="absolute left-2 right-2 z-10 border-t border-rose-300"
                                style={{ top: currentTimeTop }}
                              >
                                <span className="absolute -left-1 -top-1.5 h-2.5 w-2.5 rounded-full bg-rose-300" />
                              </div>
                            ) : null}
                            {(plannerTimedLayoutsByDate[day] ?? []).map((layout) => {
                              const gutter = 8;
                              const width = `calc(${100 / layout.columnCount}% - ${gutter}px)`;
                              const left = `calc(${(layout.columnIndex * 100) / layout.columnCount}% + ${gutter / 2}px)`;
                              const timeRange = `${formatPlannerEventTime(layout.event.startAt)}${
                                layout.event.endAt ? `-${formatPlannerEventTime(layout.event.endAt)}` : ""
                              }`;
                              const workResolution = plannerWorkResolutionStatus(layout.event);
                              const showWorkResolutionActions = isPastUnresolvedPlannerWorkEvent(
                                layout.event,
                                clientNowMs
                              );
                              const workActionSaving = plannerWorkActionSavingId === layout.event.id;

                              return (
                                <div
                                  key={`${day}-${layout.event.id}`}
                                  role="button"
                                  tabIndex={0}
                                  className={`absolute z-20 cursor-grab select-none overflow-hidden rounded-xl border px-2 py-1.5 text-[11px] active:cursor-grabbing ${
                                    plannerInteraction?.eventId === layout.event.id ? "ring-2 ring-slate-300" : ""
                                  } ${plannerEventTone(
                                    layout.event.eventType
                                  )}`}
                                  style={{
                                    top: layout.top,
                                    height: layout.height,
                                    left,
                                    width,
                                  }}
                                  title={`${layout.event.title}${timeRange ? ` • ${timeRange}` : ""}`}
                                  onPointerDown={(e) => beginPlannerEventInteraction(e, layout.event, "move")}
                                  onClick={() => {
                                    if (suppressPlannerEventClickRef.current) return;
                                    openPlannerEventEdit(layout.event);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") openPlannerEventEdit(layout.event);
                                  }}
                                >
                                  <div className="flex min-w-0 items-center gap-1 font-medium leading-tight">
                                    <PlannerEventTypeIcon eventType={layout.event.eventType} />
                                    <span className="truncate">{layout.event.title}</span>
                                  </div>
                                  {layout.height >= 42 && timeRange ? (
                                    <div className="mt-0.5 truncate text-[10px] opacity-70">{timeRange}</div>
                                  ) : null}
                                  {workResolution ? (
                                    <div className="mt-1 inline-flex w-fit rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                      {workResolution === "logged" ? "Logged" : "Skipped"}
                                    </div>
                                  ) : null}
                                  {showWorkResolutionActions ? (
                                    <div
                                      className="mt-1 flex flex-wrap gap-1"
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {layout.event.taskId && taskById[layout.event.taskId] ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={workActionSaving}
                                            onClick={() => logPlannerWorkAsPlanned(layout.event)}
                                            className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                                          >
                                            Log as planned
                                          </button>
                                          <button
                                            type="button"
                                            disabled={workActionSaving}
                                            onClick={() => adjustPlannerWorkLog(layout.event)}
                                            className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-white disabled:opacity-50"
                                          >
                                            Adjust
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={workActionSaving}
                                          onClick={() => openPlannerEventEdit(layout.event)}
                                          className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                                        >
                                          Link task to log
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        disabled={workActionSaving}
                                        onClick={() => skipPlannerWorkEvent(layout.event)}
                                        className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-white disabled:opacity-50"
                                      >
                                        Skip
                                      </button>
                                    </div>
                                  ) : null}
                                  <div
                                    className="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize rounded-full"
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      beginPlannerEventInteraction(e, layout.event, "resize");
                                    }}
                                    aria-hidden="true"
                                  >
                                    <span className="mx-auto mt-1 block h-0.5 w-6 rounded-full bg-current opacity-25" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : plannerView === "month" ? (
              <div className="pt-3">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="px-1 text-xs font-semibold text-slate-600">{plannerMonthLabel}</div>
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => movePlannerMonth(-1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Previous month"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      onClick={returnPlannerToToday}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlannerMonth(1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Next month"
                    >
                      &gt;
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[18px] border border-slate-200/70 bg-white">
                  <div className="grid grid-cols-7 border-b border-slate-100/80 bg-slate-50/40">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
                      <div
                        key={weekday}
                        className="border-r border-slate-100/70 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 last:border-r-0"
                      >
                        {weekday}
                      </div>
                    ))}
                  </div>

                  <div>
                    {plannerMonthWeeks.map((week, weekIndex) => {
                      const weekSpans = plannerMonthAllDaySpansByWeek[weekIndex] ?? [];
                      return (
                        <div key={`month-week-${week[0]?.date ?? weekIndex}`} className="relative grid grid-cols-7">
                          {week.map((day) => {
                            const events = (plannerMonthEventsByDate[day.date] ?? []).filter(
                              (item) => !(item.sourceType === "calendar_event" && item.event.allDay)
                            );
                            const visibleEvents = events.slice(0, 4);
                            const hiddenCount = Math.max(0, events.length - visibleEvents.length);
                            const isToday = day.date === clientToday;

                            return (
                              <div
                                key={day.date}
                                className={`min-h-[96px] border-r border-b border-slate-100/70 px-1.5 py-1.5 [&:nth-child(7n)]:border-r-0 ${
                                  day.isCurrentMonth ? "bg-white" : "bg-slate-50/40"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPlannerAnchorDate(day.date);
                                    setPlannerView("week");
                                  }}
                                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums hover:bg-slate-100 ${
                                    isToday
                                      ? "bg-slate-900 text-white hover:bg-slate-800"
                                      : day.isCurrentMonth
                                        ? "text-slate-700"
                                        : "text-slate-300"
                                  }`}
                                  aria-label={`Open week containing ${day.date}`}
                                >
                                  {Number(day.date.slice(8, 10))}
                                </button>

                                <div
                                  className="space-y-0.5"
                                  style={{ marginTop: weekSpans.length ? weekSpans.length * 18 + 6 : 4 }}
                                >
                                  {visibleEvents.map((item) => {
                                    const prefix = plannerItemPrefix(item, day.date);
                                    return (
                                      <button
                                        key={`${day.date}-${item.sourceType === "calendar_event" ? item.event.id : item.task.id}`}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (item.sourceType === "calendar_event") openPlannerEventEdit(item.event);
                                          else openEdit(item.task);
                                        }}
                                        className={`flex w-full min-w-0 items-center gap-1 rounded-lg border px-1.5 py-0.5 text-left text-[10px] font-medium leading-4 ${
                                          item.sourceType === "calendar_event"
                                            ? plannerEventTone(item.event.eventType)
                                            : plannerDeadlineTone(item.task)
                                        }`}
                                        title={plannerItemTitle(item)}
                                      >
                                        {prefix ? (
                                          <span className="shrink-0 tabular-nums opacity-65">{prefix}</span>
                                        ) : item.sourceType === "task_deadline" ? (
                                          <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        ) : (
                                          <PlannerEventTypeIcon eventType={item.event.eventType} />
                                        )}
                                        <span className="truncate">{plannerItemTitle(item)}</span>
                                      </button>
                                    );
                                  })}
                                  {hiddenCount ? (
                                    <div className="px-1 pt-0.5 text-[10px] font-medium text-slate-400">
                                      +{hiddenCount} more
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                          {weekSpans.length ? (
                            <div
                              className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-y-0.5 px-1.5"
                              style={{ gridTemplateRows: `repeat(${weekSpans.length}, 16px)` }}
                            >
                              {weekSpans.map((span, index) => (
                                <button
                                  key={plannerAllDaySpanKey(span, `month-${weekIndex}`)}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (span.item.sourceType === "calendar_event") openPlannerEventEdit(span.item.event);
                                    else openEdit(span.item.task);
                                  }}
                                  className={`pointer-events-auto flex min-w-0 items-center gap-1 border px-1.5 py-0.5 text-left text-[10px] font-medium leading-4 ${
                                    span.startsBefore ? "rounded-l-sm" : "rounded-l-lg"
                                  } ${span.endsAfter ? "rounded-r-sm" : "rounded-r-lg"} ${
                                    span.item.sourceType === "calendar_event"
                                      ? plannerEventTone(span.item.event.eventType)
                                      : plannerDeadlineTone(span.item.task)
                                  }`}
                                  style={{
                                    gridColumn: `${span.startIndex + 1} / span ${span.span}`,
                                    gridRow: index + 1,
                                  }}
                                  title={plannerItemTitle(span.item)}
                                >
                                  {span.item.sourceType === "calendar_event" ? (
                                    <PlannerEventTypeIcon eventType={span.item.event.eventType} />
                                  ) : (
                                    <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  )}
                                  <span className="truncate">{plannerItemTitle(span.item)}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-medium text-slate-500">{plannerYearLabel}</div>
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => movePlannerYear(-1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Previous year"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      onClick={returnPlannerToToday}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlannerYear(1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Next year"
                    >
                      &gt;
                    </button>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] font-medium text-slate-500">
                  {PLANNER_EVENT_TYPES.map((option) => (
                    <div key={option.id} className="inline-flex items-center gap-1.5">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full ${plannerYearMarkerTone(
                          option.id
                        )}`}
                      >
                        <PlannerYearMarkerIcon eventType={option.id} />
                      </span>
                      <span>{option.label}</span>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {plannerYearMonths.map((month) => (
                    <div key={month.id} className="rounded-[18px] border border-slate-200/70 bg-white p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPlannerAnchorDate(month.anchorDate);
                          setPlannerView("month");
                        }}
                        className="text-sm font-semibold text-slate-700 hover:text-slate-950"
                      >
                        {month.label}
                      </button>

                      <div className="mt-2 grid grid-cols-7 gap-y-1">
                        {["M", "T", "W", "T", "F", "S", "S"].map((weekday, index) => (
                          <div
                            key={`${month.id}-${weekday}-${index}`}
                            className="text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-300"
                          >
                            {weekday}
                          </div>
                        ))}
                      </div>

                      <div className="mt-1">
                        {Array.from({ length: Math.ceil(month.days.length / 7) }, (_, weekIndex) => {
                          const week = month.days.slice(weekIndex * 7, weekIndex * 7 + 7);
                          const currentMonthDays = week.filter((day) => day.isCurrentMonth);
                          const firstCurrentMonthIndex = week.findIndex((day) => day.isCurrentMonth);
                          const currentMonthDates = currentMonthDays.map((day) => day.date);
                          const monthItems: PlannerDateItem[] = currentMonthDates.flatMap((date) =>
                            (plannerYearEventsByDate[date] ?? []).filter((item) => {
                              const span = plannerItemDateSpan(item);
                              return Boolean(span && span.start < span.end);
                            })
                          );
                          const uniqueSpanItems = Array.from(
                            new Map(
                              monthItems.map((item) => [
                                item.sourceType === "calendar_event" ? item.event.id : item.task.id,
                                item,
                              ])
                            ).values()
                          );
                          const spanItems = plannerAllDaySpansForDays(currentMonthDates, uniqueSpanItems)
                            .filter((span) => span.item.sourceType === "calendar_event")
                            .map((span) => ({
                              ...span,
                              startIndex: firstCurrentMonthIndex + span.startIndex,
                            }));
                          const visibleSpanItems = spanItems.slice(0, 2);

                          return (
                            <div
                              key={`${month.id}-week-${weekIndex}`}
                              className="relative grid grid-cols-7"
                              style={{ minHeight: Math.max(30, 24 + visibleSpanItems.length * 13) }}
                            >
                              {week.map((day) => {
                                const items = (plannerYearEventsByDate[day.date] ?? []).filter((item) => {
                                  const span = plannerItemDateSpan(item);
                                  return !span || span.start === span.end;
                                });
                                const markerTypes = Array.from(new Set(items.map(plannerYearItemEventType))).slice(0, 3);
                                const isToday = day.date === clientToday;

                                if (!day.isCurrentMonth) {
                                  return (
                                    <div
                                      key={`${month.id}-${day.date}`}
                                      className="mx-auto h-7 w-7"
                                      aria-hidden="true"
                                    />
                                  );
                                }

                                return (
                                  <button
                                    key={`${month.id}-${day.date}`}
                                    type="button"
                                    onClick={() => {
                                      setPlannerAnchorDate(day.date);
                                      setPlannerView("week");
                                    }}
                                    className={`group relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[10px] tabular-nums hover:bg-slate-100 ${
                                      isToday
                                        ? "bg-slate-900 text-white hover:bg-slate-800"
                                        : "text-slate-600"
                                    }`}
                                    title={
                                      items.length
                                        ? `${day.date}: ${items.length} item${items.length === 1 ? "" : "s"}`
                                        : day.date
                                    }
                                    aria-label={`Open week containing ${day.date}`}
                                  >
                                    {Number(day.date.slice(8, 10))}
                                    {markerTypes.length ? (
                                      <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                                        {markerTypes.map((eventType) => (
                                          <span
                                            key={eventType}
                                            className={`flex h-3 w-3 items-center justify-center rounded-full ${plannerYearMarkerTone(
                                              eventType
                                            )}`}
                                          >
                                            <PlannerYearMarkerIcon eventType={eventType} />
                                          </span>
                                        ))}
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                              {visibleSpanItems.map((span, spanIndex) => {
                                const eventType = plannerYearItemEventType(span.item);
                                return (
                                  <div
                                    key={plannerAllDaySpanKey(span, `${month.id}-year-${weekIndex}`)}
                                    className={`absolute grid h-3.5 min-w-0 grid-cols-[auto_1fr] items-center gap-0.5 overflow-hidden border px-1 text-[8px] font-medium leading-none ${
                                      span.startsBefore ? "rounded-l-sm" : "rounded-l-full"
                                    } ${span.endsAfter ? "rounded-r-sm" : "rounded-r-full"} ${plannerYearPillTone(eventType)}`}
                                    style={{
                                      left: `calc(${(span.startIndex / 7) * 100}% + 2px)`,
                                      right: `calc(${((7 - span.startIndex - span.span) / 7) * 100}% + 2px)`,
                                      top: 25 + spanIndex * 13,
                                    }}
                                    title={plannerItemTitle(span.item)}
                                  >
                                    <PlannerYearMarkerIcon eventType={eventType} />
                                    {span.span >= 3 ? <span className="truncate">{plannerItemTitle(span.item)}</span> : null}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : mode === "logger" ? (
          <div className="mt-4">
            <div className="flex flex-col gap-3 rounded-[18px] border border-slate-200/70 bg-white p-3">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-medium text-slate-500">{loggerPeriodLabel}</div>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  {[
                    { id: "week", label: "Week" },
                    { id: "month", label: "Month" },
                    { id: "year", label: "Year" },
                    { id: "custom", label: "Custom" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLoggerRangeMode(option.id as LoggerRangeMode)}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        loggerRangeMode === option.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                    {[
                      { id: "hours", label: "Hours logged" },
                      { id: "times", label: "Times logged" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLoggerValueMode(option.id as LoggerValueMode)}
                        className={`rounded-lg px-3 py-1.5 text-sm ${
                          loggerValueMode === option.id
                            ? "bg-slate-900 text-white"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                <select
                  value={loggerTaskFilter}
                  onChange={(e) => setLoggerTaskFilter(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 sm:w-[220px]"
                >
                  <option value="all">All tasks</option>
                  {filtered.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>

                <div className="inline-flex h-9 rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => moveLoggerSelectedRange(-1)}
                    disabled={loggerRangeMode === "custom"}
                    className="rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Previous Logger range"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    onClick={returnLoggerRangeToToday}
                    className="rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLoggerSelectedRange(1)}
                    disabled={loggerRangeMode === "custom"}
                    className="rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Next Logger range"
                  >
                    &gt;
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => openLogTime()}
                  className="h-9 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Log time
                </button>
                </div>
              </div>

            {loggerRangeMode === "custom" ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <label className="flex items-center gap-2">
                  <span>From</span>
                  <input
                    type="date"
                    value={customStartDate}
                    max={customEndDate || undefined}
                    onChange={(e) => {
                      const nextStart = e.target.value;
                      if (!isValidISODate(nextStart)) return;
                      setCustomStartDate(nextStart);
                      if (!isValidISODate(customEndDate) || nextStart > customEndDate) {
                        setCustomEndDate(nextStart);
                      }
                    }}
                    className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>To</span>
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={(e) => {
                      const nextEnd = e.target.value;
                      if (!isValidISODate(nextEnd)) return;
                      setCustomEndDate(nextEnd);
                      if (!isValidISODate(customStartDate) || nextEnd < customStartDate) {
                        setCustomStartDate(nextEnd);
                      }
                    }}
                    className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>
            ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[18px] border border-slate-200/70 bg-white lg:grid-cols-4">
              <div className="border-b border-r border-slate-100/80 p-2.5 sm:p-3 lg:border-b-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Total hours</div>
                <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
                  {formatLoggedTime(loggerRangeSummary.totalHours)}
                </div>
              </div>
              <div className="border-b border-slate-100/80 p-2.5 sm:p-3 lg:border-r lg:border-b-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Avg / active day
                </div>
                <div className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
                  {loggerRangeSummary.activeDayCount
                    ? formatLoggedTime(loggerRangeSummary.averageHoursPerActiveDay)
                  : "—"}
                </div>
              </div>
              <div className="border-r border-slate-100/80 p-2.5 sm:p-3 lg:border-b-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Most worked task
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-slate-900">
                  {loggerRangeSummary.mostWorkedTask?.title ?? "—"}
                </div>
                {loggerRangeSummary.mostWorkedTask ? (
                  <div className="mt-1 text-xs tabular-nums text-slate-500">
                    {formatLoggedTime(loggerRangeSummary.mostWorkedTask.hours)}
                  </div>
                ) : null}
              </div>
              <div className="p-2.5 sm:p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Most worked category
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-slate-900">
                  {loggerRangeSummary.mostWorkedCategory?.label ?? "—"}
                </div>
                {loggerRangeSummary.mostWorkedCategory ? (
                  <div className="mt-1 text-xs tabular-nums text-slate-500">
                    {formatLoggedTime(loggerRangeSummary.mostWorkedCategory.hours)}
                  </div>
                ) : null}
              </div>
            </div>

            {openTimeLogs.length ? (
              <div className="mt-3 rounded-[18px] border border-cyan-100 bg-cyan-50/40 px-3 py-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-700/70">
                  Open sessions
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {openTimeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-cyan-700">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">
                            {taskNameById[log.taskId] ?? "Archived task"}
                          </div>
                          <div className="text-xs text-cyan-700">
                            {formatOpenSessionStarted(log)} · Open
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openLogTime(log.taskId, log.date, log)}
                        className="rounded-full border border-cyan-100 bg-white px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
                      >
                        Add end time
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {loggerRangeMode === "year" ? (
              <div className="border-b border-slate-100 px-4 py-8 text-center text-sm text-slate-400">
                Detailed daily view is available in Week, Month or Custom.
              </div>
            ) : (
              <>
              <div className="mt-3 md:hidden">
                <div className="overflow-x-auto pb-2">
                  <div className="flex w-max gap-1">
                    {loggerDays.map((day) => {
                      const isSelected = day === loggerMobileDate;
                      const isToday = day === clientToday;
                      return (
                        <button
                          key={`logger-mobile-day-${day}`}
                          type="button"
                          onClick={() => setLoggerMobileSelectedDate(day)}
                          className={`w-14 rounded-2xl border px-2 py-2 text-center transition-colors ${
                            isSelected
                              ? "border-slate-900 bg-white text-slate-950"
                              : "border-slate-200/80 bg-white/70 text-slate-500 hover:bg-white"
                          }`}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                            {formatLoggerWeekday(day).slice(0, 3)}
                          </div>
                          <div
                            className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                              isToday ? "bg-slate-900 text-white" : ""
                            }`}
                          >
                            {new Date(day + "T00:00:00").getDate()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 divide-y divide-slate-100 rounded-[18px] border border-slate-200/70 bg-white">
                  <div className="px-3 py-2 text-xs font-medium text-slate-500">
                    {formatLoggerDate(loggerMobileDate)}
                  </div>
                  {loggerRows.length ? (
                    loggerRows.map(({ task }) => {
                      const cellLogs = logsByTaskDate[`${task.id}:${loggerMobileDate}`] ?? [];
                      const openCellLogs = openLogsByTaskDate[`${task.id}:${loggerMobileDate}`] ?? [];
                      const hours = cellLogs.reduce((sum, log) => sum + (log.hours ?? 0), 0);
                      const count = cellLogs.length;
                      const hasValue = loggerValueMode === "hours" ? hours > 0 : count > 0;

                      return (
                        <button
                          key={`logger-mobile-row-${task.id}`}
                          type="button"
                          onClick={() => openLogTime(task.id, loggerMobileDate, cellLogs[0] ?? openCellLogs[0])}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50/70"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800">{task.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-400">{courseLabel(task.courseId)}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                            {hasValue
                              ? loggerValueMode === "hours"
                                ? formatGridHours(hours)
                                : count
                              : openCellLogs.length
                                ? <Clock3 className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                                : ""}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-slate-400">
                      No tasks have time logs in this view.
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={loggerGridScrollRef}
                className="mt-3 hidden max-w-full overflow-x-auto rounded-[18px] border border-slate-200/70 bg-white p-2 md:block"
              >
                <table
                  className={`min-w-max border-separate text-sm ${
                    useCompactLoggerGrid
                      ? "border-spacing-x-0 border-spacing-y-0.5"
                      : "border-spacing-x-0.5 border-spacing-y-0.5"
                  }`}
                >
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th
                        className={`sticky left-0 z-40 bg-white text-left font-medium shadow-[1px_0_0_rgba(148,163,184,0.18)] ${
                          useCompactLoggerGrid
                            ? "w-[232px] min-w-[232px] max-w-[232px] rounded-lg px-3 py-1.5"
                            : "w-64 rounded-xl px-3 py-2"
                        }`}
                      >
                        Task
                      </th>
                      <th
                        className={`sticky z-40 bg-white text-left font-medium text-slate-400 shadow-[1px_0_0_rgba(148,163,184,0.14)] ${
                          useCompactLoggerGrid
                            ? "left-[232px] w-[156px] min-w-[156px] max-w-[156px] rounded-lg px-3 py-1.5"
                            : "left-64 w-44 rounded-xl px-3 py-2"
                        }`}
                      >
                        Category
                      </th>
                      {loggerDays.map((day) => (
                        <th
                          key={day}
                          className={`text-center font-medium ${
                            useCompactLoggerGrid
                              ? "w-12 min-w-12 px-0.5 py-0.5"
                              : "w-16 min-w-16 px-1 py-1"
                          }`}
                        >
                          <div
                            className={`${
                              useCompactLoggerGrid ? "rounded-lg px-1 py-1.5" : "rounded-xl px-2 py-2"
                            } ${
                              day === clientToday ? "bg-slate-100 text-slate-800" : "bg-white text-slate-500"
                            }`}
                          >
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                              {formatLoggerWeekday(day).slice(0, 3)}
                            </div>
                            <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">
                              {new Date(day + "T00:00:00").getDate()}
                            </div>
                          </div>
                        </th>
                      ))}
                      <th
                        className={`sticky right-0 z-40 bg-white text-right font-medium shadow-[-1px_0_0_rgba(148,163,184,0.18)] ${
                          useCompactLoggerGrid
                            ? "w-20 min-w-20 rounded-lg px-2 py-1.5"
                            : "w-24 rounded-xl px-3 py-2"
                        }`}
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loggerRows.length ? (
                      loggerRows.map(({ task, total }) => (
                        <tr key={task.id}>
                          <td
                            className={`sticky left-0 z-30 bg-white shadow-[1px_0_0_rgba(148,163,184,0.14)] ${
                              useCompactLoggerGrid
                                ? "w-[232px] min-w-[232px] max-w-[232px] rounded-lg px-3 py-1.5"
                                : "w-64 rounded-xl px-3 py-2"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openLogTime(task.id)}
                              className={`block truncate text-left font-medium text-slate-800 hover:text-slate-950 ${
                                useCompactLoggerGrid ? "max-w-[208px]" : "max-w-56"
                              }`}
                            >
                              {task.title}
                            </button>
                          </td>
                          <td
                            className={`sticky z-30 bg-white text-xs text-slate-500 shadow-[1px_0_0_rgba(148,163,184,0.1)] ${
                              useCompactLoggerGrid
                                ? "left-[232px] w-[156px] min-w-[156px] max-w-[156px] rounded-lg px-3 py-1.5"
                                : "left-64 w-44 rounded-xl px-3 py-2"
                            }`}
                          >
                            <span className="block truncate">{courseLabel(task.courseId)}</span>
                          </td>
                          {loggerDays.map((day) => {
                            const cellLogs = logsByTaskDate[`${task.id}:${day}`] ?? [];
                            const openCellLogs = openLogsByTaskDate[`${task.id}:${day}`] ?? [];
                            const hours = cellLogs.reduce((sum, log) => sum + (log.hours ?? 0), 0);
                            const count = cellLogs.length;
                            const hasValue = loggerValueMode === "hours" ? hours > 0 : count > 0;
                            const title = `${task.title} • ${day} • ${
                              loggerValueMode === "hours" ? formatDuration(hours) : `${count} logs`
                            }${openCellLogs.length ? " • Open session" : ""}`;

                            return (
                              <td
                                key={`${task.id}-${day}`}
                                className={`text-center text-xs font-medium tabular-nums ${
                                  useCompactLoggerGrid
                                    ? "h-10 w-12 min-w-12 px-0.5 py-0.5"
                                    : "h-11 w-16 min-w-16 px-1 py-1"
                                }`}
                                title={title}
                              >
                                <button
                                  type="button"
                                  onClick={() => openLogTime(task.id, day, cellLogs[0] ?? openCellLogs[0])}
                                  className={`flex items-center justify-center transition-colors ${
                                    useCompactLoggerGrid ? "h-9 w-11 rounded-lg" : "h-10 w-14 rounded-xl"
                                  } ${
                                    loggerValueMode === "hours"
                                      ? loggerCellTone(hours)
                                      : loggerCountCellTone(count)
                                  } ${hasValue ? "hover:ring-1 hover:ring-violet-200" : "hover:bg-slate-50"}`}
                                  aria-label={title}
                                >
                                  {loggerValueMode === "hours" ? (
                                    formatGridHours(hours) || (openCellLogs.length ? <Clock3 className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" /> : "")
                                  ) : (
                                    count || (openCellLogs.length ? <Clock3 className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" /> : "")
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          <td
                            className={`sticky right-0 z-30 bg-white text-right text-xs font-semibold tabular-nums text-slate-800 shadow-[-1px_0_0_rgba(148,163,184,0.14)] ${
                              useCompactLoggerGrid
                                ? "w-20 min-w-20 rounded-lg px-2 py-1.5"
                                : "w-24 rounded-xl px-3 py-2"
                            }`}
                          >
                            {loggerValueMode === "hours"
                              ? total > 0
                                ? formatLoggedTime(total)
                                : ""
                              : closedTimeLogs.filter((log) => log.taskId === task.id && loggerDays.includes(log.date)).length || ""}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={loggerDays.length + 3}
                          className="px-4 py-8 text-center text-sm text-slate-400"
                        >
                          No tasks have time logs in this view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </>
            )}

            <div className="space-y-4 border-t border-slate-100 px-4 py-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Daily work</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Less</span>
                    {[0, 0.5, 1.5, 3, 5].map((hours) => (
                      <span
                        key={hours}
                        className={`h-3 w-3 rounded-[3px] ${calendarCellTone(hours)}`}
                        aria-label={`${formatLoggedTime(hours)} logged`}
                      />
                    ))}
                    <span>More</span>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto pb-1">
                  {loggerRangeMode === "week" || (loggerRangeMode === "custom" && workCalendar.days.length <= 14) ? (
                    <div className="flex min-w-max gap-2">
                      {workCalendar.days.map((day) => (
                        <div key={day.date} className="grid gap-1 text-center">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                            {formatLoggerWeekday(day.date).slice(0, 3)}
                          </span>
                          <span
                            className={`h-10 w-10 rounded-lg ${calendarCellTone(day.hours)}`}
                            title={`${formatLoggerDate(day.date)} • ${
                              day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                            }`}
                            aria-label={`${day.date}: ${
                              day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                            }`}
                          />
                          <span className="text-[11px] tabular-nums text-slate-500">
                            {new Date(day.date + "T00:00:00").getDate()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="min-w-max">
                      <div className="grid grid-cols-[28px_1fr] gap-x-2">
                        <div />
                        <div
                          className="grid h-4 text-[10px] text-slate-400"
                          style={{
                            gridTemplateColumns: `repeat(${workCalendar.weeks.length}, ${
                              workCalendar.compact ? "12px" : "22px"
                            })`,
                          }}
                        >
                          {workCalendar.weeks.map((week, index) => {
                            const month = new Date(week.weekStart + "T00:00:00").getMonth();
                            const previousMonth =
                              index > 0
                                ? new Date(workCalendar.weeks[index - 1].weekStart + "T00:00:00").getMonth()
                                : null;
                            return (
                              <div key={week.weekStart} className="relative">
                                {index === 0 || month !== previousMonth ? (
                                  <span className="absolute left-0 whitespace-nowrap">
                                    {new Intl.DateTimeFormat("en", { month: "short" }).format(
                                      new Date(week.weekStart + "T00:00:00")
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div
                          className={`grid grid-rows-7 ${
                            workCalendar.compact ? "gap-[3px]" : "gap-1"
                          } pt-[3px] text-[10px] leading-3 text-slate-400`}
                        >
                          {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => (
                            <div key={`${label}-${index}`} className={workCalendar.compact ? "h-3" : "h-5"}>
                              {label}
                            </div>
                          ))}
                        </div>
                        <div className={`flex ${workCalendar.compact ? "gap-[3px]" : "gap-1"}`}>
                          {workCalendar.weeks.map((week) => (
                            <div
                              key={week.weekStart}
                              className={`grid grid-rows-7 ${workCalendar.compact ? "gap-[3px]" : "gap-1"}`}
                            >
                              {week.days.map((day) => {
                                const isInRange = day.date >= workCalendar.rawStart && day.date <= workCalendar.end;
                                return (
                                  <span
                                    key={day.date}
                                    className={`${workCalendar.compact ? "h-3 w-3 rounded-[3px]" : "h-5 w-5 rounded-md"} ${
                                      isInRange ? calendarCellTone(day.hours) : "bg-transparent"
                                    }`}
                                    title={`${formatLoggerDate(day.date)} • ${
                                      isInRange && day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                                    }`}
                                    aria-label={`${day.date}: ${
                                      isInRange && day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold">Most worked tasks</div>
                <div className="mt-3 space-y-3">
                  {topWorkedTasks.rows.length ? (
                    topWorkedTasks.rows.map((row, index) => {
                      const percent = topWorkedTasks.maxHours
                        ? Math.max(4, (row.hours / topWorkedTasks.maxHours) * 100)
                        : 0;

                      return (
                        <div key={row.taskId} className="grid gap-1">
                          <div className="grid grid-cols-[28px_1fr_auto] items-baseline gap-3 text-xs">
                            <div className="tabular-nums text-slate-400">{index + 1}</div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-800">{row.title}</div>
                              <div className="truncate text-[11px] text-slate-500">{row.category}</div>
                            </div>
                            <div className="tabular-nums text-slate-600">{formatDuration(row.hours)}</div>
                          </div>
                          <div className="ml-10 h-2 rounded-full bg-slate-100">
                            <div
                              className={`h-2 rounded-full ${courseBarClass(row.courseId)}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
                      No logged task activity yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            {/* Attention */}
            <section className="order-1">
              <div className="border-b border-slate-200/70 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-slate-900">Attention score</div>
                    <div className="text-xs text-slate-500">{scoredTasks.length} tasks</div>
                  </div>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttentionCategoryMenuOpen((open) => !open);
                      }}
                    >
                      Categories
                      {attentionIncludedCategoryIds.length !== activeCategories.length ? (
                        <span className="text-slate-400"> · {attentionIncludedCategoryIds.length}</span>
                      ) : null}
                    </button>
                    {attentionCategoryMenuOpen ? (
                      <div className="absolute right-0 top-full z-[1000] mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-xl ring-1 ring-slate-900/5">
                        <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                          Categories
                        </div>
                        <div className="mt-1 max-h-56 overflow-auto">
                          {activeCategories.map((category) => {
                            const selected = !attentionCategoryExcludedIds.includes(category.id);
                            return (
                              <button
                                key={category.id}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-600 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAttentionCategoryExcludedIds((ids) =>
                                    selected
                                      ? Array.from(new Set([...ids, category.id]))
                                      : ids.filter((id) => id !== category.id)
                                  );
                                }}
                              >
                                <span className="flex h-4 w-4 items-center justify-center text-slate-700">
                                  {selected ? <Check className="h-3 w-3" /> : null}
                                </span>
                                <span className="min-w-0 truncate">{categoryDisplayLabel(category)}</span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttentionCategoryExcludedIds([]);
                          }}
                        >
                          Select all
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="grid overflow-hidden rounded-[18px] border border-slate-200/70 bg-white sm:grid-cols-2 xl:grid-cols-3">
                  {attentionIncludedCategoryIds.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400 sm:col-span-2 xl:col-span-3">
                      No categories selected
                    </div>
                  ) : null}
                  {attentionIncludedCategoryIds.length > 0 ? scoredTasks.map(({ task, total: score, reasons, visualAttentionScore }, index) => {
                    return (
                      <div
                        key={task.id}
                        className="cursor-pointer border-b border-slate-100/80 p-3 transition-colors hover:bg-slate-50/70 sm:border-r xl:[&:nth-child(3n)]:border-r-0 sm:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r"
                        role="button"
                        tabIndex={0}
                        onClick={() => openEdit(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openEdit(task);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid min-w-0 grid-cols-[1.5rem_1fr] gap-2">
                            <div className="pt-0.5 text-xs tabular-nums text-slate-300">{index + 1}</div>
                            <div className="min-w-0">
                            <div className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">{task.title}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{courseLabel(task.courseId)}</div>
                            {reasons.length ? (
                              <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                                {reasons.join(" · ")}
                              </div>
                            ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{Math.round(score)}</div>
                        </div>

                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${urgencyColour(visualAttentionScore)}`}
                            style={{ width: `${visualAttentionScore}%` }}
                          />
                        </div>
                      </div>
                    );
                  }) : null}
                </div>
              </div>
            </section>

            {/* Category columns */}
            <div className="order-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {activeCategories.map((c) => {
                const categoryTasks = byCourse[c.id] ?? [];
                const isExpanded = expandedDashboardCategoryIds.includes(c.id);
                const visibleTasks = isExpanded ? categoryTasks : categoryTasks.slice(0, 4);
                const remainingTasks = Math.max(0, categoryTasks.length - visibleTasks.length);

                return (
                <div key={c.id} className="self-start rounded-[18px] border border-slate-200/70 bg-white">
                  <div className="border-b border-slate-100/80 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold tracking-tight text-slate-900">{categoryDisplayLabel(c)}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditCategory(c)}
                          className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 px-4 py-4">
                    {categoryTasks.length ? (
                      visibleTasks.map((t) => {
                        const deadlineLabel = compactDeadlineLabel(t);
                        const activityLabel = activityTypeLabel(t.activityType);

                        return (
                          <div
                            key={t.id}
                            onClick={() => openEdit(t)}
                            className={`cursor-pointer rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50/70 ${frozenTaskClass(t)}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openEdit(t);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={`truncate text-sm font-medium ${frozenTitleClass(t)}`}>{t.title}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {deadlineLabel ? (
                                    <TaskMetaPill className={`${deadlinePillTone(t)} bg-opacity-60`}>
                                      <Clock className="h-3 w-3" aria-hidden="true" />
                                      {deadlineLabel}
                                    </TaskMetaPill>
                                  ) : null}
                                  {t.activityType && activityLabel ? (
                                    <TaskMetaPill className={`${activityPillTone(t.activityType)} bg-opacity-60`}>
                                      <ActivityTypeIcon activityType={t.activityType} />
                                      {activityLabel}
                                    </TaskMetaPill>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeTask(t.id);
                                }}
                                aria-label="Mark completed"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        className="cursor-pointer rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-400 hover:bg-slate-50"
                        role="button"
                        tabIndex={0}
                        onClick={() => openNewTaskForCourse(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openNewTaskForCourse(c.id);
                        }}
                      >
                        Empty
                      </div>
                    )}
                    {categoryTasks.length > 4 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDashboardCategoryIds((ids) =>
                            isExpanded ? ids.filter((id) => id !== c.id) : [...ids, c.id]
                          )
                        }
                        className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      >
                        {isExpanded ? "Show less" : `Show ${remainingTasks} more`}
                      </button>
                    ) : null}
                  </div>
                </div>
                );
              })}

              <button
                type="button"
                onClick={openAddCategory}
                className="min-h-[150px] rounded-[20px] border border-dashed border-slate-300 bg-white p-4 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-semibold text-slate-700">+ Add category</div>
                <div className="mt-1 text-xs text-slate-400">
                  Create a new category card
                </div>
              </button>

              {archivedCategories.length ? (
                <div className="rounded-[20px] border border-slate-200/70 bg-white p-4 md:col-span-2 xl:col-span-3 2xl:col-span-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold">Archived categories</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Hidden from normal use, still safe for existing tasks
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {archivedCategories.map((category) => (
                      <div
                        key={category.id}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
                      >
                        <span>{categoryDisplayLabel(category)}</span>
                        <button
                          type="button"
                          onClick={() => restoreCategory(category)}
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

          </div>
        )}

        {/* Keyboard reminder */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="font-medium text-slate-900">Keyboard</div>
              <div className="mt-1">
                Press <span className="rounded border px-1">/</span> to search,{" "}
                <span className="rounded border px-1">n</span> to create a task.
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Last local backup: {hasMounted ? backupStatus.label : "—"} · Backups kept:{" "}
                {hasMounted ? backupStatus.count : "—"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportBackup}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Export backup
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Import backup
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importBackup(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>
        </div>
        </div>
      </main>

      {/* Smart schedule import modal */}
      <Modal open={smartImportOpen} title="Smart schedule import" onClose={closeSmartImport}>
        <div className="grid gap-4">
          <Field label="Paste schedule">
            <textarea
              value={smartImportRaw}
              onChange={(e) => setSmartImportRaw(e.target.value)}
              className="min-h-[150px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Thesis meeting every Tuesday 11-1pm room 103 between October 1 and December 12"
            />
          </Field>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={parseSmartImportInput}
              disabled={!smartImportRaw.trim() || smartImportSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Parse schedule
            </button>
            {smartImportMessage ? (
              <div className="text-right text-xs text-slate-500">{smartImportMessage}</div>
            ) : null}
          </div>

          {smartImportProposals.length || smartImportRaw.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              {smartImportProposals.length ? (
                <button
                  type="button"
                  onClick={parseSmartImportInput}
                  disabled={!smartImportRaw.trim() || smartImportSaving}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Retry parse
                </button>
              ) : null}
              <button
                type="button"
                onClick={resetSmartImport}
                disabled={smartImportSaving}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                Start over
              </button>
            </div>
          ) : null}

          {smartImportProposals.length ? (
            <div className="grid max-h-[48vh] gap-3 overflow-y-auto pr-1">
              {smartImportProposals.map((proposal) => {
                const warnings = validateSmartImportProposal(proposal);
                const possibleDuplicate = smartImportDuplicateWarning(proposal, calendarEvents);
                return (
                  <div
                    key={proposal.id}
                    className={`rounded-2xl border p-3 ${
                      proposal.savedEventId
                        ? "border-green-100 bg-green-50/60"
                        : warnings.length
                          ? "border-amber-100 bg-amber-50/40"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={proposal.include}
                          disabled={Boolean(proposal.savedEventId)}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { include: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="truncate">{proposal.title || "Untitled event"}</span>
                      </label>
                      <div className="flex shrink-0 items-center gap-1">
                        {proposal.savedEventId ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            Added
                          </span>
                        ) : null}
                        {possibleDuplicate && !proposal.savedEventId ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Possible duplicate
                          </span>
                        ) : null}
                        {warnings.length ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Needs review
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Title">
                        <input
                          value={proposal.title}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { title: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                      <Field label="Type">
                        <select
                          value={proposal.eventType}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              eventType: e.target.value as CalendarEventType,
                              allDay:
                                (e.target.value === "travel" && !proposal.startTime) ||
                                e.target.value === "milestone" ||
                                proposal.allDay,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          {PLANNER_EVENT_TYPES.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Field label="Recurrence">
                        <select
                          value={proposal.recurrence}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              recurrence: e.target.value as SmartImportRecurrence,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          <option value="none">One-off</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </Field>
                      <Field label={proposal.recurrence === "weekly" ? "Start date" : "Date"}>
                        <input
                          type="date"
                          value={proposal.date}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              date: e.target.value,
                              endDate: proposal.endDate < e.target.value ? e.target.value : proposal.endDate,
                              weekday:
                                proposal.recurrence === "weekly" && isValidISODate(e.target.value)
                                  ? isoWeekday(e.target.value)
                                  : proposal.weekday,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                      <Field label={proposal.recurrence === "weekly" || proposal.allDay ? "End date" : "End date"}>
                        <input
                          type="date"
                          value={proposal.endDate}
                          min={proposal.date}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              endDate: e.target.value < proposal.date ? proposal.date : e.target.value,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                    </div>

                    {proposal.recurrence === "weekly" ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Field label="Weekday">
                          <select
                            value={proposal.weekday}
                            onChange={(e) => updateSmartImportProposal(proposal.id, { weekday: Number(e.target.value) })}
                            className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          >
                            {PLANNER_WEEKDAY_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={proposal.allDay}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { allDay: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        All day
                      </label>
                      <Field label="Start time">
                        <input
                          type="time"
                          value={proposal.startTime}
                          disabled={proposal.allDay}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { startTime: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </Field>
                      <Field label="End time">
                        <input
                          type="time"
                          value={proposal.endTime}
                          disabled={proposal.allDay}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { endTime: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Location">
                        <input
                          value={proposal.location}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { location: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                      <Field label="Notes">
                        <input
                          value={proposal.notes}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { notes: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                    </div>

                    {proposal.eventType === "travel" ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Origin">
                          <input
                            value={proposal.origin}
                            onChange={(e) => updateSmartImportProposal(proposal.id, { origin: e.target.value })}
                            className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </Field>
                        <Field label="Destination">
                          <input
                            value={proposal.destination}
                            onChange={(e) => updateSmartImportProposal(proposal.id, { destination: e.target.value })}
                            className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </Field>
                      </div>
                    ) : null}

                    <div className="mt-2 text-[11px] text-slate-400">
                      Source: {proposal.sourceText}
                    </div>
                    {warnings.length ? (
                      <div className="mt-2 text-xs text-amber-700">
                        {warnings.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={closeSmartImport}
              disabled={smartImportSaving}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={confirmSmartImport}
              disabled={
                smartImportSaving ||
                !smartImportProposals.some((proposal) => proposal.include && !proposal.savedEventId) ||
                smartImportProposals.some(
                  (proposal) =>
                    proposal.include &&
                    !proposal.savedEventId &&
                    validateSmartImportProposal(proposal).length > 0
                )
              }
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {smartImportSaving ? "Adding" : "Add selected events"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Planner event modal */}
      <Modal
        open={plannerEventModalOpen}
        title={plannerEventDraft ? (plannerEventModalMode === "edit" ? "Edit event" : "New event") : "New event"}
        onClose={closePlannerEventModal}
      >
        {!plannerEventDraft ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {PLANNER_EVENT_TYPES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => startPlannerEventCreate(option.id)}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-slate-50 ${plannerEventTone(
                  option.id
                )}`}
              >
                <PlannerEventTypeIcon eventType={option.id} />
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            <div
              className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${plannerEventTone(
                plannerEventDraft.eventType
              )}`}
            >
              <PlannerEventTypeIcon eventType={plannerEventDraft.eventType} />
              {PLANNER_EVENT_TYPES.find((option) => option.id === plannerEventDraft.eventType)?.label ?? "Event"}
            </div>

            <Field label="Type">
              <select
                value={plannerEventDraft.eventType}
                onChange={(e) => {
                  const eventType = e.target.value as CalendarEventType;
                  setPlannerEventDraft({
                    ...plannerEventDraft,
                    eventType,
                    allDay: eventType === "milestone" ? true : plannerEventDraft.allDay,
                    repeat: eventType === "class" ? plannerEventDraft.repeat : "none",
                  });
                }}
                className={`h-10 w-full rounded-[16px] border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${plannerEventTone(
                  plannerEventDraft.eventType
                )}`}
              >
                {PLANNER_EVENT_TYPES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {plannerEventDraft.recurrenceParentId ? (
              <Field label="Apply changes to">
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                  {[
                    { id: "this", label: "This event" },
                    { id: "future", label: "This and future" },
                    { id: "all", label: "All events" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setPlannerEventDraft({
                          ...plannerEventDraft,
                          recurrenceApplyScope: option.id as PlannerEventDraft["recurrenceApplyScope"],
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        plannerEventDraft.recurrenceApplyScope === option.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}

            {plannerEventError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {plannerEventError}
              </div>
            ) : null}

            <Field label="Title">
              <input
                value={plannerEventDraft.title}
                onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, title: e.target.value })}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Event title"
              />
            </Field>

            {plannerEventDraft.eventType === "work" ? (
              <>
                <Field label="Tracker task">
                  <select
                    value={plannerEventDraft.taskId}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, taskId: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">No linked task</option>
                    {plannerTaskOptions.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Focus">
                  <input
                    value={plannerEventDraft.description}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, description: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Optional focus"
                  />
                </Field>
              </>
            ) : null}

            {plannerEventDraft.eventType === "meeting" ? (
              <Field label="Who">
                <input
                  value={plannerEventDraft.who}
                  onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, who: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            ) : null}

            {plannerEventDraft.eventType === "deadline" || plannerEventDraft.eventType === "personal" ? (
              <label className="flex w-fit items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={plannerEventDraft.allDay}
                  onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, allDay: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                All day
              </label>
            ) : null}

            {plannerEventDraft.eventType === "travel" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start date">
                  <input
                    type="date"
                    value={plannerEventDraft.date}
                    onChange={(e) => {
                      const date = e.target.value;
                      setPlannerEventDraft({
                        ...plannerEventDraft,
                        date,
                        endDate: plannerEventDraft.endDate < date ? date : plannerEventDraft.endDate,
                      });
                    }}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field label="End date">
                  <input
                    type="date"
                    value={plannerEventDraft.endDate}
                    min={plannerEventDraft.date}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, endDate: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
              </div>
            ) : (
              <Field label={plannerEventDraft.allDay ? "Date" : "Date"}>
                <input
                  type="date"
                  value={plannerEventDraft.date}
                  onChange={(e) => {
                    const date = e.target.value;
                    setPlannerEventDraft({
                      ...plannerEventDraft,
                      date,
                      endDate: date,
                      recurrenceStartDate:
                        plannerEventDraft.eventType === "class" && plannerEventDraft.repeat === "weekly"
                          ? date
                          : plannerEventDraft.recurrenceStartDate,
                      recurrenceEndDate:
                        plannerEventDraft.eventType === "class" &&
                        plannerEventDraft.repeat === "weekly" &&
                        plannerEventDraft.recurrenceEndDate < date
                          ? date
                          : plannerEventDraft.recurrenceEndDate,
                      recurrenceWeekday:
                        plannerEventDraft.eventType === "class" && isValidISODate(date)
                          ? isoWeekday(date)
                          : plannerEventDraft.recurrenceWeekday,
                    });
                  }}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            )}

            {!plannerEventDraft.allDay ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={plannerEventDraft.eventType === "deadline" ? "Time" : "Start time"}>
                  <input
                    type="time"
                    value={plannerEventDraft.startTime}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, startTime: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                {plannerEventDraft.eventType !== "deadline" ? (
                  <Field label="End time">
                    <input
                      type="time"
                      value={plannerEventDraft.endTime}
                      onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, endTime: e.target.value })}
                      className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}

            {plannerEventDraft.eventType === "class" ? (
              <div className="grid gap-3 rounded-[18px] border border-slate-100 bg-slate-50/60 p-3">
                <Field label="Repeat">
                  <select
                    value={plannerEventDraft.repeat}
                    onChange={(e) => {
                      const repeat = e.target.value as PlannerEventDraft["repeat"];
                      setPlannerEventDraft({
                        ...plannerEventDraft,
                        repeat,
                        recurrenceWeekday: isoWeekday(plannerEventDraft.date),
                        recurrenceStartDate: plannerEventDraft.date,
                        recurrenceEndDate:
                          plannerEventDraft.recurrenceEndDate < plannerEventDraft.date
                            ? plannerEventDraft.date
                            : plannerEventDraft.recurrenceEndDate,
                      });
                    }}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </Field>

                {plannerEventDraft.repeat === "weekly" ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Weekday">
                      <select
                        value={plannerEventDraft.recurrenceWeekday}
                        onChange={(e) =>
                          setPlannerEventDraft({
                            ...plannerEventDraft,
                            recurrenceWeekday: Number(e.target.value),
                          })
                        }
                        className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        {PLANNER_WEEKDAY_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Series start">
                      <input
                        type="date"
                        value={plannerEventDraft.recurrenceStartDate}
                        onChange={(e) => {
                          const recurrenceStartDate = e.target.value;
                          setPlannerEventDraft({
                            ...plannerEventDraft,
                            recurrenceStartDate,
                            recurrenceEndDate:
                              plannerEventDraft.recurrenceEndDate < recurrenceStartDate
                                ? recurrenceStartDate
                                : plannerEventDraft.recurrenceEndDate,
                          });
                        }}
                        className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </Field>
                    <Field label="Series end">
                      <input
                        type="date"
                        value={plannerEventDraft.recurrenceEndDate}
                        min={plannerEventDraft.recurrenceStartDate}
                        onChange={(e) =>
                          setPlannerEventDraft({
                            ...plannerEventDraft,
                            recurrenceEndDate:
                              e.target.value < plannerEventDraft.recurrenceStartDate
                                ? plannerEventDraft.recurrenceStartDate
                                : e.target.value,
                          })
                        }
                        className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}

            {plannerEventDraft.eventType === "travel" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Origin">
                  <input
                    value={plannerEventDraft.origin}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, origin: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field label="Destination">
                  <input
                    value={plannerEventDraft.destination}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, destination: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
              </div>
            ) : null}

            {plannerEventDraft.eventType === "class" ||
            plannerEventDraft.eventType === "meeting" ||
            plannerEventDraft.eventType === "personal" ? (
              <Field label="Location">
                <input
                  value={plannerEventDraft.location}
                  onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, location: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            ) : null}

            {plannerEventDraft.eventType === "meeting" ? (
              <Field label="Video link">
                <input
                  value={plannerEventDraft.videoUrl}
                  onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, videoUrl: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            ) : null}

            <Field label="Notes">
              <textarea
                value={plannerEventDraft.notes}
                onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, notes: e.target.value })}
                className="min-h-[72px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <div className="flex items-center justify-between pt-2">
              {plannerEventModalMode === "edit" ? (
                <button
                  type="button"
                  onClick={
                    plannerEventDraft.recurrenceParentId
                      ? cancelPlannerRecurringOccurrence
                      : removePlannerEvent
                  }
                  disabled={plannerEventSaving}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {plannerEventDraft.recurrenceParentId ? "Cancel occurrence" : "Delete"}
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closePlannerEventModal}
                  disabled={plannerEventSaving}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPlannerEvent}
                  disabled={plannerEventSaving}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {plannerEventSaving ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* New Task modal */}
      <Modal
        open={newOpen}
        title="New task"
        onClose={() => setNewOpen(false)}
      >
        <div className="grid gap-3">
          <Field label="Title">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title (brief)"
              className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNewTask();
                }
              }}
            />
          </Field>

          <SectionHeading>Organisation</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <IconSelectBox<Status>
                value={newStatus}
                onChange={setNewStatus}
                options={STATUSES}
                renderIcon={(status) => <StatusIcon status={status} />}
              />
            </Field>

            <Field label="Category">
              <select
                value={newCourseId}
                onChange={(e) => setNewCourseId(e.target.value)}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryDisplayLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <SectionHeading>Planning</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1.8fr]">
            <Field label="Priority">
              <IconSelectBox<Priority>
                value={newPriority}
                onChange={setNewPriority}
                options={PRIORITIES}
                renderIcon={(priority) => <PriorityIcon priority={priority} />}
              />
            </Field>

            <Field label="Difficulty (1–5)">
              <select
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value)}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {["1", "2", "3", "4", "5"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <EffortLevelField value={newEffortLevel} onChange={setNewEffortLevel} />
          </div>

          <DeadlineField
            due={newDue}
            deadlineMode={newDeadlineMode}
            visionHorizon={newVisionHorizon}
            onDateChange={(due) => {
              setNewDue(due);
              setNewDeadlineMode(due ? "date" : undefined);
              setNewVisionHorizon(null);
            }}
            onVisionChange={(horizon) => {
              setNewDue("");
              setNewDeadlineMode("vision");
              setNewVisionHorizon(horizon);
            }}
          />

          <SectionHeading>Type</SectionHeading>
          <ActivityTypeField value={newActivityType} onChange={setNewActivityType} />

          <SectionHeading>Notes</SectionHeading>
          <Field label="Notes">
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Any extra context"
              className="min-h-[64px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <SectionHeading>Actions</SectionHeading>
          <div className="flex items-center justify-end gap-2">
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setNewOpen(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={submitNewTask}
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Category modal */}
      <Modal
        open={categoryModalOpen}
        title={editingCategory ? "Edit category" : "Add category"}
        onClose={() => {
          if (categorySaving) return;
          setCategoryModalOpen(false);
          resetCategoryDraft();
        }}
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <Field label="Category name">
              <input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Bloomberg Lab"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <Field label="Emoji">
              <input
                value={categoryEmoji}
                onChange={(e) => setCategoryEmoji(e.target.value)}
                placeholder="📈"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>
          </div>

          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOURS.map((option) => {
                const selected = categoryColour === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCategoryColour(option.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                      selected
                        ? "border-slate-300 bg-slate-100 text-slate-800"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full ${option.swatch}`} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="flex items-center justify-between gap-2 pt-1">
            {editingCategory ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={categorySaving}
                onClick={() => archiveCategory(editingCategory)}
              >
                Archive
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={categorySaving}
                onClick={() => {
                  setCategoryModalOpen(false);
                  resetCategoryDraft();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!categoryName.trim() || categorySaving}
                onClick={submitCategory}
              >
                {editingCategory ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Log Time modal */}
      <Modal
        open={logOpen}
        title={logModalTitle}
        onClose={() => {
          setEditingLogId(null);
          setPlannerLogSourceEventId(null);
          setLogOpen(false);
        }}
      >
        <div className="grid gap-3">
          <Field label="Task / project">
            <select
              value={logTaskId}
              onChange={(e) => setLogTaskId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {!logTaskOptions.length ? <option value="">No tasks available</option> : null}
              {logTaskOptions.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={logDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setLogDate(nextDate);
                  if (!logEndDate || logEndDate < nextDate) {
                    setLogEndDate(nextDate);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <Field label="Start time">
              <input
                type="time"
                value={logStartTime}
                onChange={(e) => setLogStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitTimeLog();
                  }
                }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="End time">
              <input
                type="time"
                value={logEndTime}
                onChange={(e) => setLogEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitTimeLog();
                  }
                }}
              />
            </Field>

            <Field label="End date">
              <input
                type="date"
                value={logEndDate}
                min={logDate || undefined}
                onChange={(e) => setLogEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>
          </div>

          <Field label="Duration">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={displayedLogHoursInput}
                  readOnly={isCalculatedLogDuration}
                  onChange={(e) => {
                    if (!isCalculatedLogDuration) {
                      setLogHoursInput(e.target.value);
                    }
                  }}
                  placeholder="0.5"
                  className={`w-full rounded-xl border border-slate-200 px-3 py-2 pr-14 text-sm tabular-nums outline-none focus:ring-2 focus:ring-slate-200 ${
                    isCalculatedLogDuration
                      ? "bg-slate-50 text-slate-600"
                      : "bg-white text-slate-900"
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitTimeLog();
                    }
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                  hours
                </span>
              </div>
              {isCalculatedLogDuration ? (
                <p className="mt-1 text-[11px] text-slate-400">Calculated from start and end time</p>
              ) : null}
          </Field>

          <Field label="Note">
            <textarea
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              placeholder="What moved forward?"
              className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <div className="flex items-center justify-between gap-2 pt-1">
            {editingLogId ? (
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={() => deleteTimeLog(editingLogId)}
              >
                Delete
              </button>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {!plannerLogSourceEventId && (!editingTimeLog || isOpenTimeLog(editingTimeLog)) ? (
                <button
                  className="rounded-full border border-cyan-100 bg-cyan-50/60 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={startOpenTimeLog}
                  disabled={
                    logSaving ||
                    !logTaskId ||
                    !isTimeLogISODate(logDate || clientToday || todayISO()) ||
                    timeLogTimeToMinutes(logStartTime) === null ||
                    Boolean(logEndTime)
                  }
                >
                  {editingLogId ? "Save open session" : "Start open session"}
                </button>
              ) : null}
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditingLogId(null);
                  setPlannerLogSourceEventId(null);
                  setLogOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={submitTimeLog}
                disabled={
                  logSaving ||
                  !logTaskId ||
                  (editingTimeLog && isOpenTimeLog(editingTimeLog)
                    ? calculatedLogHours === null
                    : resolveClosedTimeLogHours(logHoursInput, calculatedLogHours, logStartTime, logEndTime) === null)
                }
              >
                {editingTimeLog && isOpenTimeLog(editingTimeLog) ? "Close session" : editingLogId ? "Save" : "Log time"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        title="Edit task"
        onClose={() => {
          setEditOpen(false);
          setDraft(null);
        }}
      >
        {!draft ? null : (
          <div className="grid gap-3">
            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <SectionHeading>Organisation</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <IconSelectBox<Status>
                  value={draft.status}
                  onChange={(status) => setDraft(applyTaskStatus(draft, status))}
                  options={STATUSES}
                  renderIcon={(status) => <StatusIcon status={status} />}
                />
              </Field>

              <Field label="Category">
                <select
                  value={draft.courseId}
                  onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryDisplayLabel(c)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <SectionHeading>Planning</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1.8fr]">
              <Field label="Priority">
                <IconSelectBox<Priority>
                  value={draft.priority}
                  onChange={(priority) => setDraft({ ...draft, priority })}
                  options={PRIORITIES}
                  renderIcon={(priority) => <PriorityIcon priority={priority} />}
                />
              </Field>

              <Field label="Difficulty (1–5)">
                <select
                  value={draft.difficulty == null ? "3" : String(draft.difficulty)}
                  onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {["1", "2", "3", "4", "5"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                ))}
              </select>
              </Field>

              <EffortLevelField
                value={draft.effortLevel ?? null}
                suggestedValue={draft.effortLevel ? null : inferredEffortLevel(draft.durationHrs)}
                onChange={(effortLevel) => setDraft({ ...draft, effortLevel })}
              />
            </div>

            <DeadlineField
              due={draft.due}
              deadlineMode={draft.deadlineMode ?? (draft.due ? "date" : undefined)}
              visionHorizon={draft.visionHorizon ?? null}
              onDateChange={(due) =>
                setDraft({
                  ...draft,
                  due: due || undefined,
                  deadlineMode: due ? "date" : undefined,
                  visionHorizon: null,
                })
              }
              onVisionChange={(horizon) =>
                setDraft({
                  ...draft,
                  due: null,
                  deadlineMode: "vision",
                  visionHorizon: horizon,
                })
              }
            />

            <SectionHeading>Type</SectionHeading>
            <ActivityTypeField
              value={draft.activityType}
              onChange={(activityType) => setDraft({ ...draft, activityType })}
            />

            <SectionHeading>Notes</SectionHeading>
            <Field label="Notes">
              <textarea
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="min-h-[64px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <SectionHeading>Actions</SectionHeading>
            <div className="flex items-center justify-between">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  deleteTask(draft.id);
                  setEditOpen(false);
                  setDraft(null);
                }}
              >
                Delete
              </button>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setEditOpen(false);
                    setDraft(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => {
                    if (!draft.title.trim()) return;
                    saveEdit({ ...draft, title: draft.title.trim() });
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
