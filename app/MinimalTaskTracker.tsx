"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Circle, Clock, Mail } from "lucide-react";
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
import type {
  ActivityType,
  BackupSnapshot,
  DeadlineMode,
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
const ATTENTION_CATEGORY_SCOPE_KEY = isDemoMode
  ? "task_tracker_demo_attention_category_scope_v1"
  : "yasmine_attention_category_scope_v1";
const SYNC_CODE = isDemoMode ? "DEMO-TASKS" : "YAS-TEST-001";

type ViewMode = "board" | "list" | "logger";
type LoggerValueMode = "hours" | "times";
type ListFilterMenu = "status" | "priority" | "difficulty" | "timeLeft" | "duration";
const LOGGER_DAY_COUNT = 14;
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
  return raw.trim() ? parseTimeLogHours(raw) : calculatedHours;
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

function timeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function durationHoursFromTimes(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return null;
  return (end - start) / 60;
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

function loggerCellTone(hours: number) {
  if (hours <= 0) return "bg-white text-slate-300";
  if (hours < 1) return "bg-violet-50 text-violet-700";
  if (hours < 2) return "bg-violet-100 text-violet-800";
  if (hours < 4) return "bg-violet-200 text-violet-900";
  return "bg-violet-300 text-violet-950";
}

function calendarCellTone(hours: number) {
  if (hours <= 0) return "bg-slate-100";
  if (hours < 1) return "bg-emerald-100";
  if (hours < 2.5) return "bg-emerald-300";
  if (hours < 5) return "bg-emerald-500";
  return "bg-emerald-700";
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
    const startTime = typeof raw.startTime === "string" ? raw.startTime : undefined;
    const endTime = typeof raw.endTime === "string" ? raw.endTime : undefined;
    const hours = Number(raw.hours ?? 0);
    if (!taskId || taskId.startsWith("logger-") || !date || !Number.isFinite(hours) || hours <= 0) {
      continue;
    }

    logs.push({
      id: String(raw.id ?? uid()),
      taskId,
      date,
      startTime,
      endTime,
      hours,
      note: typeof raw.note === "string" ? raw.note : "",
    });
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
  if (value === "list" || value === "logger") return value;
  return "board";
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
  weights = {
    time: 50,
    priority: 20,
    duration: 15,
    difficulty: 15,
  }
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
  weights.time + weights.priority + weights.duration + weights.difficulty || 1;

const weightedScore =
  (timePressure * weights.time +
    priorityScore * weights.priority +
    workload * weights.duration +
    difficultyScore * weights.difficulty) /
  totalWeight;

return clamp(weightedScore, 0, 100);
}

function urgencyColour(score: number) {
  if (score >= 85) return "bg-rose-500";   // calm strong green
  if (score >= 70) return "bg-orange-500";      // fresh lime
  if (score >= 55) return "bg-amber-400";    // warm amber
  if (score >= 40) return "bg-lime-300";   // soft coral-orange
  return "bg-lime-100";                      // muted rose, not danger red
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
  if (activityType === "correspondence") return <Mail className="h-3 w-3" aria-hidden="true" />;
  if (activityType === "uni_work") return <BookOpen className="h-3 w-3" aria-hidden="true" />;
  return <Circle className="h-3 w-3" aria-hidden="true" />;
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        <div className="px-5 py-4">{children}</div>
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
              {option.label}
            </button>
          );
        })}
      </div>
    </Field>
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
  const [backupStatus, setBackupStatus] = useState({ label: "—", count: 0 });
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [showWeights, setShowWeights] = useState(false);
  const [attentionCategoryMenuOpen, setAttentionCategoryMenuOpen] = useState(false);
  const [attentionCategoryExcludedIds, setAttentionCategoryExcludedIds] = useState<string[]>([]);

const [weights, setWeights] = useState(() => {
  if (typeof window === "undefined") {
    return { time: 50, priority: 20, duration: 15, difficulty: 15 };
  }

  const saved = localStorage.getItem("attentionWeights");

  return saved
    ? JSON.parse(saved)
    : { time: 50, priority: 20, duration: 15, difficulty: 15 };
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
  const [newDurationHrs, setNewDurationHrs] = useState<string>("");
  const [newDifficulty, setNewDifficulty] = useState<string>("3");
  const [newNotes, setNewNotes] = useState<string>("");

  // Time log modal state
  const [logOpen, setLogOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logTaskId, setLogTaskId] = useState<string>("");
  const [logDate, setLogDate] = useState<string>("");
  const [logStartTime, setLogStartTime] = useState<string>("");
  const [logEndTime, setLogEndTime] = useState<string>("");
  const [logHoursInput, setLogHoursInput] = useState<string>("");
  const [logNote, setLogNote] = useState<string>("");
  const [loggerTaskFilter, setLoggerTaskFilter] = useState<string>("all");
  const [loggerValueMode, setLoggerValueMode] = useState<LoggerValueMode>("hours");
  const [timelineEnd, setTimelineEnd] = useState<string>("");
  const [clientToday, setClientToday] = useState<string>("");
  const [clientNowMs, setClientNowMs] = useState<number>(0);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Task | null>(null);

  // List sorting
  const [listSortKey, setListSortKey] = useState<
    "title" | "course" | "status" | "priority" | "due" | "timeLeft" | "duration" | "difficulty"
  >("due");
  const [listSortDir, setListSortDir] = useState<"asc" | "desc">("asc");
  const [openStatusTaskId, setOpenStatusTaskId] = useState<string | null>(null);
  const [openListFilter, setOpenListFilter] = useState<ListFilterMenu | null>(null);
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
    setTimelineEnd(today);
    setLogDate(today);
    setMode(storedTabToMode(localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)));
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
  });
}, []);

useEffect(() => {
  if (!hasMounted) return;
  localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, modeToStoredTab(mode));
}, [hasMounted, mode]);

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
      .map((task) => ({
        task,
        total: urgencyScore(task, weights),
      }));

    scored.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const ad = a.task.due || "9999-12-31";
      const bd = b.task.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      const pr = priorityRank(a.task.priority) - priorityRank(b.task.priority);
      if (pr !== 0) return pr;
      return (b.task.createdAt ?? 0) - (a.task.createdAt ?? 0);
    });

    return scored;
  }, [attentionIncludedCategoryIdSet, attentionIncludedCategoryIds.length, filtered, weights]);

  const loggerDays = useMemo(() => {
    const center = isValidISODate(timelineEnd) ? timelineEnd : todayISO();
    const startOffset = -Math.floor(LOGGER_DAY_COUNT / 2) + 1;

    return Array.from({ length: LOGGER_DAY_COUNT }, (_, i) => addDaysISO(center, startOffset + i));
  }, [timelineEnd]);

  const calculatedLogHours = useMemo(() => {
    return durationHoursFromTimes(logStartTime, logEndTime);
  }, [logEndTime, logStartTime]);

  const loggerTasks = useMemo(() => {
    const taskIdsWithLogs = new Set(timeLogs.map((log) => log.taskId));

    return filtered
      .filter((task) => loggerTaskFilter === "all" || task.id === loggerTaskFilter)
      .filter((task) => taskIdsWithLogs.has(task.id))
      .slice()
      .sort((a, b) => {
        const aHours = timeLogs
            .filter((log) => log.taskId === a.id)
            .reduce((sum, log) => sum + log.hours, 0);
        const bHours = timeLogs
            .filter((log) => log.taskId === b.id)
            .reduce((sum, log) => sum + log.hours, 0);

        if (bHours !== aHours) return bHours - aHours;
        return a.title.localeCompare(b.title);
      });
  }, [filtered, loggerTaskFilter, timeLogs]);

  const taskNameById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task.title]));
  }, [tasks]);

  const taskById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task]));
  }, [tasks]);

  const logTaskOptions = useMemo(() => {
    return tasks
      .filter((task) => task.status !== "completed")
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  const logsByTaskDate = useMemo(() => {
    const map: Record<string, TimeLog[]> = {};
    for (const log of timeLogs) {
      const key = `${log.taskId}:${log.date}`;
      map[key] = [...(map[key] ?? []), log];
    }
    return map;
  }, [timeLogs]);

  const loggerRows = useMemo(() => {
    const visibleDates = new Set(loggerDays);
    return loggerTasks.map((task) => {
      const logs = timeLogs.filter((log) => log.taskId === task.id && visibleDates.has(log.date));
      return {
        task,
        total: logs.reduce((sum, log) => sum + log.hours, 0),
      };
    });
  }, [loggerDays, loggerTasks, timeLogs]);

  const workCalendar = useMemo(() => {
    const totals = new Map<string, number>();
    for (const log of timeLogs) {
      totals.set(log.date, (totals.get(log.date) ?? 0) + log.hours);
    }

    const end = isValidISODate(clientToday) ? clientToday : todayISO();
    const rawStart = addDaysISO(end, -364);
    const startDate = new Date(rawStart + "T00:00:00");
    const start = addDaysISO(rawStart, -startDate.getDay());
    const weeks: { weekStart: string; days: { date: string; hours: number }[] }[] = [];
    let cursor = start;

    for (let week = 0; week < 53; week += 1) {
      const days = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDaysISO(cursor, dayIndex);
        return {
          date,
          hours: date >= rawStart && date <= end ? totals.get(date) ?? 0 : 0,
        };
      });

      weeks.push({ weekStart: cursor, days });
      cursor = addDaysISO(cursor, 7);
    }

    return { rawStart, end, weeks };
  }, [clientToday, timeLogs]);

  const topWorkedTasks = useMemo(() => {
    const totals = new Map<string, number>();
    for (const log of timeLogs) {
      totals.set(log.taskId, (totals.get(log.taskId) ?? 0) + log.hours);
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
}, [taskById, timeLogs]);

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

    const dur = optionalFiniteNumber(newDurationHrs);
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
      notes: newNotes.trim() || undefined,
      durationHrs: dur,
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
    setNewDurationHrs("");
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
    setTimeLogs((prev) => prev.filter((log) => log.taskId !== id));
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
    const existingHoursInput = existing ? formatHourInput(existing.hours) : "";

    setEditingLogId(existing?.id ?? null);
    setLogTaskId(existing?.taskId ?? selectedTaskId);
    setLogDate(existing?.date ?? date);
    setLogStartTime(existing?.startTime ?? "");
    setLogEndTime(existing?.endTime ?? "");
    setLogHoursInput(existingHoursInput);
    setLogNote(existing?.note ?? "");
    setLogOpen(true);
  }

  function moveLoggerRange(direction: -1 | 1) {
    setTimelineEnd((date) => {
      const anchor = isValidISODate(date)
        ? date
        : isValidISODate(clientToday)
          ? clientToday
          : todayISO();
      return addDaysISO(anchor, direction * LOGGER_DAY_COUNT);
    });
  }

  function submitTimeLog() {
    const hours = resolveTimeLogHours(logHoursInput, calculatedLogHours);
    if (!logTaskId || hours === null) return;

    const date = logDate || clientToday || todayISO();
    const existing = editingLogId
      ? timeLogs.find((entry) => entry.id === editingLogId)
      : null;
    const next: TimeLog = {
      id: existing?.id ?? createTimeLogId(),
      taskId: logTaskId,
      date,
      startTime: logStartTime || undefined,
      endTime: logEndTime || undefined,
      hours,
      note: logNote.trim(),
    };

    setTimeLogs((prev) => {
      if (!existing) return [next, ...prev];
      return prev.map((entry) => (entry.id === existing.id ? next : entry));
    });

    void saveSupabaseTimeLog(SYNC_CODE, next).catch((error) => {
      console.warn("Unexpected Supabase time log save failure:", {
        operation: existing ? "edit" : "create",
        id: next.id,
        error,
      });
    });

    setEditingLogId(null);
    setLogOpen(false);
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
      setWeights(incoming.attentionWeights as typeof weights);
      localStorage.setItem("attentionWeights", JSON.stringify(incoming.attentionWeights));
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
          className={`rounded-full border px-3 py-2 text-sm ${
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
          className={`rounded-full border px-3 py-2 text-sm ${
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

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm text-slate-500">
              {isDemoMode ? "Task Tracker Playground" : "Yasmine's Tracker"}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 lg:w-[180px]"
            >
              <option value="all">Category</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryDisplayLabel(c)}
                </option>
              ))}
            </select>

            {mode === "list" ? (
              <>
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
              </>
            ) : null}

            <div className="relative">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search (press /)"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 lg:w-[260px]"
              />
            </div>

            <button
              onClick={() => setNewOpen(true)}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              New
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex items-center justify-between">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            <button
              className={`rounded-full px-4 py-2 text-sm ${
                mode === "board" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setMode("board")}
            >
              Dashboard
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm ${
                mode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setMode("list")}
            >
              List
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm ${
                mode === "logger" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setMode("logger")}
            >
              Logger
            </button>
          </div>

          <div className="text-sm text-slate-500">
            {filtered.length} task{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Main */}
        {mode === "list" ? (
          <>
            <div className="mt-5 overflow-x-auto overflow-y-visible rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    {([
                      ["title", "Title"],
                      ["course", "Course"],
                      ["status", "Status"],
                      ["priority", "Priority"],
                      ["due", "Due"],
                      ["timeLeft", "Time left"],
                      ["duration", "Duration"],
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
                        className={`relative cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                          statusMenuOpen ? "z-50" : "z-0"
                        }`}
                        onClick={() => openEdit(t)}
                      >
                        <td className={`max-w-[420px] truncate px-3 py-2 font-medium ${frozenTitleClass(t)}`}>{t.title}</td>
                        <td className={`px-3 py-2 ${t.status === "frozen" ? "text-slate-400" : "text-slate-600"}`}>{courseLabel(t.courseId)}</td>
                        <td
                          className={`relative px-3 py-2 ${statusMenuOpen ? "z-[120]" : "z-0"}`}
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
                        <td className="px-3 py-2 text-slate-600">{priorityLabel(t.priority)}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{t.due ?? "—"}</td>
                        <td className={`px-3 py-2 tabular-nums ${days !== null && days <= 2 ? "text-red-600" : "text-slate-600"}`}>
                          {days === null ? "—" : timeLeftLabel(days)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">
                          {t.durationHrs == null ? "—" : `${t.durationHrs}h`}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{t.difficulty == null ? "—" : t.difficulty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {completedRows.length ? (
              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
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
        ) : mode === "logger" ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Logger</div>
                <div className="mt-1 text-xs text-slate-500">
                  {loggerDays[0]} to {loggerDays[loggerDays.length - 1]}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={loggerTaskFilter}
                  onChange={(e) => setLoggerTaskFilter(e.target.value)}
                  className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 sm:w-[220px]"
                >
                  <option value="all">All tasks</option>
                  {filtered.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>

                <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                  {[
                    { id: "hours", label: "Hours logged" },
                    { id: "times", label: "Times logged" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLoggerValueMode(option.id as LoggerValueMode)}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        loggerValueMode === option.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => moveLoggerRange(-1)}
                    className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = todayISO();
                      setClientToday(today);
                      setTimelineEnd(today);
                    }}
                    className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLoggerRange(1)}
                    className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => openLogTime()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Log time
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-max border-separate border-spacing-0 text-sm">
                <thead className="text-xs text-slate-600">
                  <tr>
                    <th className="sticky left-0 z-30 w-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium">
                      Category
                    </th>
                    <th className="sticky left-40 z-30 w-64 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium">
                      Task
                    </th>
                    {loggerDays.map((day) => (
                      <th
                        key={day}
                        className="w-28 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-center font-medium"
                      >
                        <div>{formatLoggerWeekday(day)}</div>
                        <div className="mt-0.5 tabular-nums text-slate-400">{formatLoggerDate(day)}</div>
                      </th>
                    ))}
                    <th className="sticky right-0 z-30 w-28 border-b border-l border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loggerRows.length ? (
                    loggerRows.map(({ task, total }) => (
                      <tr key={task.id}>
                        <td className="sticky left-0 z-20 w-40 border-b border-r border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          {courseLabel(task.courseId)}
                        </td>
                        <td className="sticky left-40 z-20 w-64 border-b border-r border-slate-200 bg-white px-3 py-2">
                          <button
                            type="button"
                            onClick={() => openLogTime(task.id)}
                            className="block max-w-56 truncate text-left font-medium text-slate-800 hover:text-slate-950"
                          >
                            {task.title}
                          </button>
                        </td>
                        {loggerDays.map((day) => {
                          const cellLogs = logsByTaskDate[`${task.id}:${day}`] ?? [];
                          const hours = cellLogs.reduce((sum, log) => sum + log.hours, 0);
                          const title = `${task.title} • ${day} • ${formatDuration(hours)}`;
                          const timeLines = cellLogs.length
                            ? cellLogs.map((log) =>
                                log.startTime && log.endTime ? `${log.startTime}-${log.endTime}` : "—"
                              )
                            : ["—"];

                          return (
                            <td
                              key={`${task.id}-${day}`}
                              className={`h-16 w-28 border-b border-r border-slate-200 px-3 py-2 text-center text-xs font-medium tabular-nums ${loggerCellTone(hours)}`}
                              title={title}
                            >
                              <button
                                type="button"
                                onClick={() => openLogTime(task.id, day, cellLogs[0])}
                                className="h-full w-full"
                                aria-label={title}
                              >
                                {loggerValueMode === "hours" ? (
                                  formatDuration(hours)
                                ) : (
                                  <span className="flex flex-col gap-0.5 leading-tight">
                                    {timeLines.map((line, index) => (
                                      <span key={`${line}-${index}`}>{line}</span>
                                    ))}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                        <td className="sticky right-0 z-20 w-28 border-b border-l border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-800">
                          {formatDuration(total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={loggerDays.length + 3}
                        className="border-b border-slate-200 px-4 py-8 text-center text-sm text-slate-400"
                      >
                        No tasks have time logs in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 border-t border-slate-100 px-4 py-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Daily work calendar</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {workCalendar.rawStart} to {workCalendar.end}
                    </div>
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
                  <div className="min-w-max">
                    <div className="grid grid-cols-[28px_1fr] gap-x-2">
                      <div />
                      <div
                        className="grid h-4 text-[10px] text-slate-400"
                        style={{ gridTemplateColumns: `repeat(${workCalendar.weeks.length}, 12px)` }}
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

                      <div className="grid grid-rows-7 gap-[3px] pt-[3px] text-[10px] leading-3 text-slate-400">
                        {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => (
                          <div key={`${label}-${index}`} className="h-3">
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-[3px]">
                        {workCalendar.weeks.map((week) => (
                          <div key={week.weekStart} className="grid grid-rows-7 gap-[3px]">
                            {week.days.map((day) => {
                              const isInRange = day.date >= workCalendar.rawStart && day.date <= workCalendar.end;
                              return (
                                <span
                                  key={day.date}
                                  className={`h-3 w-3 rounded-[3px] ${
                                    isInRange ? calendarCellTone(day.hours) : "bg-transparent"
                                  }`}
                                  title={`${day.date} • ${formatLoggedTime(day.hours)} logged`}
                                  aria-label={`${day.date}: ${formatLoggedTime(day.hours)} logged`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
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
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Course columns */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCategories.map((c) => (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{categoryDisplayLabel(c)}</div>
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

                  <div className="space-y-3 px-4 py-4">
                    {byCourse[c.id]?.length ? (
                      byCourse[c.id].map((t) => {
                        const deadlineLabel = compactDeadlineLabel(t);
                        const activityLabel = activityTypeLabel(t.activityType);

                        return (
                          <div
                            key={t.id}
                            onClick={() => openEdit(t)}
                            className={`cursor-pointer rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 ${frozenTaskClass(t)}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openEdit(t);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={`truncate text-sm font-medium ${frozenTitleClass(t)}`}>{t.title}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {deadlineLabel ? (
                                    <TaskMetaPill className={deadlinePillTone(t)}>
                                      <Clock className="h-3 w-3" aria-hidden="true" />
                                      {deadlineLabel}
                                    </TaskMetaPill>
                                  ) : null}
                                  {t.activityType && activityLabel ? (
                                    <TaskMetaPill className={activityPillTone(t.activityType)}>
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
                        className="cursor-pointer rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-400 hover:bg-slate-50"
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
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={openAddCategory}
                className="min-h-[160px] rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-left shadow-sm hover:bg-slate-50"
              >
                <div className="text-sm font-semibold text-slate-700">+ Add category</div>
                <div className="mt-1 text-xs text-slate-400">
                  Create a new category card
                </div>
              </button>

              {archivedCategories.length ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2 lg:col-span-3">
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

            {/* Right rail */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 h-fit">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Attention score</div>
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

              <div className="space-y-4 px-4 py-4">
                {/* Score list */}
                <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
                  {attentionIncludedCategoryIds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                      No categories selected
                    </div>
                  ) : null}
                  {attentionIncludedCategoryIds.length > 0 ? scoredTasks.map(({ task }) => {
                    const score = urgencyScore(task, weights);

                    return (
                      <div
                        key={task.id}
                        className="cursor-pointer rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
                        role="button"
                        tabIndex={0}
                        onClick={() => openEdit(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openEdit(task);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{courseLabel(task.courseId)}</div>
                          </div>

                          <div className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{Math.round(score)}</div>
                        </div>

                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${urgencyColour(score)}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    );
                  }) : null}
                </div>
              </div>

              {showWeights ? (
                <div className="space-y-6 border-y border-slate-100 bg-slate-50/40 px-4 py-5 text-xs">
                  <div>
                    <label className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      <span>Time</span>
                      <span className="tabular-nums text-slate-900">{weights.time}</span>
                    </label>
                    <div className="editorial-slider-wrap mt-3">
                      <span className="editorial-slider-marker left-1/4" />
                      <span className="editorial-slider-marker left-1/2" />
                      <span className="editorial-slider-marker left-3/4" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={weights.time}
                        onChange={(e) => setWeights({ ...weights, time: Number(e.target.value) })}
                        className="editorial-slider"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      <span>Priority</span>
                      <span className="tabular-nums text-slate-900">{weights.priority}</span>
                    </label>
                    <div className="editorial-slider-wrap mt-3">
                      <span className="editorial-slider-marker left-1/4" />
                      <span className="editorial-slider-marker left-1/2" />
                      <span className="editorial-slider-marker left-3/4" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={weights.priority}
                        onChange={(e) => setWeights({ ...weights, priority: Number(e.target.value) })}
                        className="editorial-slider"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      <span>Duration</span>
                      <span className="tabular-nums text-slate-900">{weights.duration}</span>
                    </label>
                    <div className="editorial-slider-wrap mt-3">
                      <span className="editorial-slider-marker left-1/4" />
                      <span className="editorial-slider-marker left-1/2" />
                      <span className="editorial-slider-marker left-3/4" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={weights.duration}
                        onChange={(e) => setWeights({ ...weights, duration: Number(e.target.value) })}
                        className="editorial-slider"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      <span>Difficulty</span>
                      <span className="tabular-nums text-slate-900">{weights.difficulty}</span>
                    </label>
                    <div className="editorial-slider-wrap mt-3">
                      <span className="editorial-slider-marker left-1/4" />
                      <span className="editorial-slider-marker left-1/2" />
                      <span className="editorial-slider-marker left-3/4" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={weights.difficulty}
                        onChange={(e) => setWeights({ ...weights, difficulty: Number(e.target.value) })}
                        className="editorial-slider"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setWeights({
                        time: 50,
                        priority: 100,
                        duration: 15,
                        difficulty: 15,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-2 py-1 text-xs text-slate-600"
                  >
                    Reset to Default
                  </button>
                </div>
              ) : null}

              <div className="px-4 py-3">
                <button
                  onClick={() => setShowWeights(!showWeights)}
                  className="w-full rounded-xl border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  type="button"
                >
                  Adjust Weights
                </button>
              </div>
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
              <SelectBox
                value={newStatus}
                onChange={(v) => setNewStatus(v as Status)}
                options={STATUSES}
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
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Priority">
              <SelectBox
                value={newPriority}
                onChange={(v) => setNewPriority(v as Priority)}
                options={PRIORITIES}
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

            <Field label="Duration (hours)">
              <input
                inputMode="decimal"
                placeholder="e.g. 1.5"
                value={newDurationHrs}
                onChange={(e) => setNewDurationHrs(e.target.value)}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>
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
        title={editingLogId ? "Edit time log" : "Log time"}
        onClose={() => {
          setEditingLogId(null);
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
                onChange={(e) => setLogDate(e.target.value)}
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

            <Field label="Hours">
              <input
                type="number"
                min="0"
                step="any"
                value={logHoursInput}
                onChange={(e) => setLogHoursInput(e.target.value)}
                placeholder={calculatedLogHours ? formatHourInput(calculatedLogHours) : "0.5"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-slate-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitTimeLog();
                  }
                }}
              />
            </Field>
          </div>

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

            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditingLogId(null);
                  setLogOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={submitTimeLog}
                disabled={!logTaskId || resolveTimeLogHours(logHoursInput, calculatedLogHours) === null}
              >
                {editingLogId ? "Save" : "Log time"}
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
                <SelectBox
                  value={draft.status}
                  onChange={(v) => setDraft(applyTaskStatus(draft, v))}
                  options={STATUSES}
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Priority">
                <SelectBox
                  value={draft.priority}
                  onChange={(v) => setDraft({ ...draft, priority: v })}
                  options={PRIORITIES}
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

              <Field label="Duration (hours)">
                <input
                  inputMode="decimal"
                  value={draft.durationHrs == null ? "" : String(draft.durationHrs)}
                  onChange={(e) =>
                    setDraft({ ...draft, durationHrs: optionalFiniteNumber(e.target.value) })
                  }
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
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
