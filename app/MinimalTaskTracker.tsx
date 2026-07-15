"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COURSES } from "./courses";
import { getTaskStore, isDemoMode } from "./taskStore";
import { normalizeTask, uid } from "./taskStore/taskNormalization";
import type { BackupSnapshot, Priority, Status, Task, TaskStore, TimeLog } from "./taskStore/taskTypes";

const TIME_LOGS_STORAGE_KEY = isDemoMode ? "task_tracker_demo_time_logs_v1" : "yasmine_time_logs_v1";
const BACKUP_KEY_PREFIX = isDemoMode ? "task_tracker_demo_backup_" : "yasmine_backup_";
const ACTIVE_TAB_STORAGE_KEY = isDemoMode ? "task_tracker_demo_active_tab" : "yasmine_active_tab";
const SYNC_CODE = isDemoMode ? "DEMO-TASKS" : "YAS-TEST-001";

type ViewMode = "board" | "list" | "logger";
type LoggerRangeView = "week" | "month";

const STATUSES: { id: Status; label: string }[] = [
  { id: "to_do", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "urgent", label: "Urgent" },
  { id: "frozen", label: "Frozen" },
  { id: "completed", label: "Completed" },
];

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

function courseLabel(id: string) {
  return COURSES.find((c) => c.id === id)?.label ?? id;
}

function statusLabel(id: Status) {
  return STATUSES.find((s) => s.id === id)?.label ?? id;
}

function priorityLabel(id: Priority) {
  return PRIORITIES.find((p) => p.id === id)?.label ?? id;
}

function statusPill(status?: string) {
  switch (status) {
    case "urgent":
      return "border border-red-100 bg-red-50 text-red-700";
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

function todayISO() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return d.toISOString().slice(0, 10);
}

function isValidISODate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(iso + "T00:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function addDaysISO(iso: string, offset: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

function formatMonthLabel(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short" })
    .format(new Date(iso + "T00:00:00"))
    .toUpperCase();
}

function dateNumber(iso: string) {
  return new Date(iso + "T00:00:00").getDate();
}

function weekdayLetter(iso: string) {
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(iso + "T00:00:00").getDay()];
}

function heatmapCellClass(hours: number) {
  if (hours <= 0) return "border border-slate-200/80 bg-white";
  if (hours < 1) return "border border-transparent bg-violet-50";
  if (hours < 2) return "border border-transparent bg-violet-100";
  if (hours < 3) return "border border-transparent bg-violet-300";
  return "border border-transparent bg-violet-500";
}

function heatmapFillClass(hours: number) {
  if (hours < 1) return "bg-violet-100 text-violet-700";
  if (hours < 2) return "bg-violet-200 text-violet-800";
  if (hours < 3) return "bg-violet-300 text-violet-900";
  return "bg-violet-500 text-white";
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
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function weekStartISO(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function monthStartISO(iso: string) {
  return `${iso.slice(0, 8)}01`;
}

function addMonthsISO(iso: string, offset: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + offset, 1);
  return d.toISOString().slice(0, 10);
}

function percentChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

function movementPill(change: number) {
  if (change > 0) return "border-green-100 bg-green-50 text-green-700";
  if (change < 0) return "border-red-100 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function movementLabel(change: number) {
  const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(change).toFixed(0)}%`;
}

function totalHoursBetween(logs: TimeLog[], startISO: string, endISO: string) {
  return logs.reduce((sum, log) => {
    if (log.date < startISO || log.date > endISO) return sum;
    return sum + log.hours;
  }, 0);
}

function streakStats(logs: TimeLog[]) {
  const activeDates = new Set(logs.filter((log) => log.hours > 0).map((log) => log.date));
  const dates = Array.from(activeDates).sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of dates) {
    run = previous && addDaysISO(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  let current = 0;
  let cursor = todayISO();
  while (activeDates.has(cursor)) {
    current += 1;
    cursor = addDaysISO(cursor, -1);
  }

  return { current, longest };
}

function normalizeTimeLogs(value: unknown): TimeLog[] {
  if (!Array.isArray(value)) return [];

  const byTaskDate = new Map<string, TimeLog>();
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

    const key = `${taskId}:${date}`;
    const existing = byTaskDate.get(key);
    if (existing) {
      byTaskDate.set(key, {
        ...existing,
        hours: existing.hours + hours,
        note: [existing.note, raw.note].filter(Boolean).join(" / "),
        startTime: existing.startTime ?? startTime,
        endTime: existing.endTime ?? endTime,
      });
    } else {
      byTaskDate.set(key, {
        id: String(raw.id ?? uid()),
        taskId,
        date,
        startTime,
        endTime,
        hours,
        note: typeof raw.note === "string" ? raw.note : "",
      });
    }
  }

  return Array.from(byTaskDate.values());
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
  due?: string;
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
  const timePressure =
    d === null
      ? 0
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
    <div className="grid gap-1">
      <div className="text-xs text-slate-500">{label}</div>
      {children}
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
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
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
  const skipNextTaskSaveRef = useRef(false);
  const timeLogsRef = useRef(timeLogs);
  const [mode, setMode] = useState<ViewMode>("board");
  const [backupStatus, setBackupStatus] = useState({ label: "—", count: 0 });
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [showWeights, setShowWeights] = useState(false);

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

  // New task modal state
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCourseId, setNewCourseId] = useState<string>(COURSES[0].id);
  const [newStatus, setNewStatus] = useState<Status>("to_do");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [newDue, setNewDue] = useState<string>("");
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
  const [logNote, setLogNote] = useState<string>("");
  const [loggerTaskFilter, setLoggerTaskFilter] = useState<string>("all");
  const [loggerRangeView, setLoggerRangeView] = useState<LoggerRangeView>("month");
  const [timelineEnd, setTimelineEnd] = useState<string>("");
  const [clientToday, setClientToday] = useState<string>("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Task | null>(null);

  // List sorting
  const [listSortKey, setListSortKey] = useState<
    "title" | "course" | "status" | "priority" | "due" | "timeLeft" | "duration" | "difficulty"
  >("due");
  const [listSortDir, setListSortDir] = useState<"asc" | "desc">("asc");

  // Attention score toggles
  const [scoreUseTime, setScoreUseTime] = useState(true);
  const [scoreUsePriority, setScoreUsePriority] = useState(true);
  const [scoreUseDuration, setScoreUseDuration] = useState(true);
  const [scoreUseDifficulty, setScoreUseDifficulty] = useState(true);
  const [scoreShowCompleted, setScoreShowCompleted] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);

useEffect(() => {
  queueMicrotask(() => {
    setHasMounted(true);

    const today = todayISO();
    setClientToday(today);
    setTimelineEnd(today);
    setLogDate(today);
    setMode(storedTabToMode(localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)));
    setBackupStatus(getLatestLocalBackupLabel());

    const savedLogs = localStorage.getItem(TIME_LOGS_STORAGE_KEY);
    if (savedLogs) {
      try {
        const restoredLogs = normalizeTimeLogs(JSON.parse(savedLogs));
        timeLogsRef.current = restoredLogs;
        setTimeLogs(restoredLogs);
      } catch (error) {
        console.error("Error loading time logs:", error);
      }
    }
    setTimeLogsLoaded(true);
  });
}, []);

useEffect(() => {
  if (!hasMounted) return;
  localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, modeToStoredTab(mode));
}, [hasMounted, mode]);

useEffect(() => {
  let cancelled = false;

  async function fetchTasks() {
    const store = await getTaskStore();
    if (cancelled) return;

    taskStoreRef.current = store;
    const loaded = await store.loadTasks(SYNC_CODE);
    if (cancelled) return;

    if (!loaded.ok) {
      console.warn("Task load failed. Task save is disabled until a successful load.");
      setTasksLoaded(true);
      return;
    }

    remoteLoadTrustedForDeleteRef.current = loaded.tasks.length > 0;
    if (!isDemoMode && loaded.tasks.length === 0) {
      console.warn("Remote task load returned empty. Delete-all sync remains disabled for this session.");
    }

    skipNextTaskSaveRef.current = true;
    setTasks(loaded.tasks);
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
  if (!hasLoadedFromStore.current) return;
  if (skipNextTaskSaveRef.current) {
    skipNextTaskSaveRef.current = false;
    return;
  }

  const allowEmptyOverwrite = allowNextEmptySaveRef.current;
  const allowDestructiveSave = allowNextDestructiveSaveRef.current;
  allowNextEmptySaveRef.current = false;
  allowNextDestructiveSaveRef.current = false;

  async function persistTasks() {
    const store = taskStoreRef.current ?? (await getTaskStore());
    taskStoreRef.current = store;

    await store.saveTasks(tasks, {
      syncCode: SYNC_CODE,
      timeLogs: timeLogsRef.current,
      allowEmptyOverwrite,
      allowDeleteAll: remoteLoadTrustedForDeleteRef.current || allowEmptyOverwrite || allowDestructiveSave,
      onLocalBackup: (backupTasks, backupTimeLogs) => {
        createLocalBackup(backupTasks, backupTimeLogs);
        refreshBackupStatus();
      },
    });
  }

  void persistTasks();
}, [tasks]);

useEffect(() => {
  timeLogsRef.current = timeLogs;
  if (!timeLogsLoaded) return;
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
        setEditingLogId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (courseFilter !== "all" && t.courseId !== courseFilter) return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        // completed last in list mode
        if (mode === "list") {
          if (a.status === "completed" && b.status !== "completed") return 1;
          if (b.status === "completed" && a.status !== "completed") return -1;
        }

        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;

        const ad = a.due || "9999-12-31";
        const bd = b.due || "9999-12-31";
        if (ad !== bd) return ad.localeCompare(bd);

        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [tasks, query, courseFilter, mode]);

  const listRows = useMemo(() => {
    const rows = filtered.slice();
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
  }, [filtered, listSortKey, listSortDir]);

  const byCourse = useMemo(() => {
    const map: Record<string, Task[]> = Object.fromEntries(COURSES.map((c) => [c.id, []]));
    for (const t of filtered.filter((task) => task.status !== "completed")) {
      const key = t.courseId || COURSES[0].id;
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
  }, [filtered]);

  const scoredTasks = useMemo(() => {
    const baseList = scoreShowCompleted ? filtered : filtered.filter((t) => t.status !== "completed");

  const scored = baseList.map((task) => ({
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
  }, [filtered, scoreShowCompleted, weights]);

  const loggerDays = useMemo(() => {
    const center = isValidISODate(timelineEnd) ? timelineEnd : todayISO();
    const dayCount = loggerRangeView === "week" ? 7 : 31;
    const startOffset = -Math.floor(dayCount / 2);

    return Array.from({ length: dayCount }, (_, i) => addDaysISO(center, startOffset + i));
  }, [loggerRangeView, timelineEnd]);

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

  const logTaskOptions = useMemo(() => {
    return tasks.slice().sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  const highestScorer = useCallback((startISO: string, endISO: string) => {
    const totals = new Map<string, number>();
    for (const log of timeLogs) {
      if (log.date < startISO || log.date > endISO) continue;
      totals.set(log.taskId, (totals.get(log.taskId) ?? 0) + log.hours);
    }

    let top: { taskId: string; hours: number } | null = null;
    for (const [taskId, hours] of totals) {
      if (!top || hours > top.hours) top = { taskId, hours };
    }

    if (!top || top.hours <= 0) return null;
    return {
      name: taskNameById[top.taskId] ?? (tasksLoaded ? "Archived task" : "Loading task…"),
      hours: top.hours,
    };
  }, [taskNameById, tasksLoaded, timeLogs]);

  const logsByTaskDate = useMemo(() => {
    const map: Record<string, TimeLog> = {};
    for (const log of timeLogs) {
      const key = `${log.taskId}:${log.date}`;
      map[key] = log;
    }
    return map;
  }, [timeLogs]);

  const loggerSummary = useMemo(() => {
    if (!clientToday) {
      return {
        week: 0,
        month: 0,
        weekChange: 0,
        monthChange: 0,
        highestWeek: null,
        highestMonth: null,
      };
    }

    const startOfWeek = weekStartISO(clientToday);
    const endOfPreviousWeek = addDaysISO(startOfWeek, -1);
    const startOfPreviousWeek = addDaysISO(startOfWeek, -7);
    const startOfMonth = monthStartISO(clientToday);
    const startOfPreviousMonth = addMonthsISO(startOfMonth, -1);
    const endOfPreviousMonth = addDaysISO(startOfMonth, -1);
    const week = totalHoursBetween(timeLogs, startOfWeek, clientToday);
    const month = totalHoursBetween(timeLogs, startOfMonth, clientToday);
    const previousWeek = totalHoursBetween(timeLogs, startOfPreviousWeek, endOfPreviousWeek);
    const previousMonth = totalHoursBetween(timeLogs, startOfPreviousMonth, endOfPreviousMonth);

    return {
      week,
      month,
      weekChange: percentChange(week, previousWeek),
      monthChange: percentChange(month, previousMonth),
      highestWeek: highestScorer(startOfWeek, clientToday),
      highestMonth: highestScorer(startOfMonth, clientToday),
    };
  }, [clientToday, highestScorer, timeLogs]);

  const recentLogs = useMemo(() => {
    return timeLogs
      .slice()
      .sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.id.localeCompare(a.id);
      })
      .slice(0, 8);
  }, [timeLogs]);

  function logTaskTitle(taskId: string) {
    return taskNameById[taskId] ?? (tasksLoaded ? "Archived task" : "Loading task…");
  }

  function openNewTaskForCourse(courseId: string) {
    setNewCourseId(courseId);
    setNewOpen(true);
  }

  function submitNewTask() {
    const title = newTitle.trim();
    if (!title) return;

    const dur = optionalFiniteNumber(newDurationHrs);
    const diff = optionalFiniteNumber(newDifficulty);

    const t: Task = {
      id: uid(),
      title,
      courseId: newCourseId || COURSES[0].id,
      status: newStatus,
      priority: newPriority,
      due: newDue || undefined,
      notes: newNotes.trim() || undefined,
      durationHrs: dur,
      difficulty: diff,
      createdAt: Date.now(),
    };

    setTasks((prev) => [t, ...prev]);

    // reset
    setNewTitle("");
    setNewStatus("to_do");
    setNewPriority("normal");
    setNewDue("");
    setNewDurationHrs("");
    setNewDifficulty("3");
    setNewNotes("");
    setNewCourseId(COURSES[0].id);

    setNewOpen(false);
  }

  function deleteTask(id: string) {
    createLocalBackup(tasks, timeLogsRef.current);
    refreshBackupStatus();
    allowNextDestructiveSaveRef.current = true;
    allowNextEmptySaveRef.current = true;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setTimeLogs((prev) => prev.filter((log) => log.taskId !== id));
  }

  function openEdit(t: Task) {
    setDraft(t);
    setEditOpen(true);
  }

  function saveEdit(next: Task) {
    setTasks((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    setEditOpen(false);
    setDraft(null);
  }

  function openLogTime(taskId?: string, date = clientToday || todayISO(), log?: TimeLog) {
    const selectedTaskId = taskId ?? loggerTasks[0]?.id ?? logTaskOptions[0]?.id ?? "";
    const existing =
      log ??
      timeLogs.find((entry) => entry.taskId === selectedTaskId && entry.date === date) ??
      null;

    setEditingLogId(existing?.id ?? null);
    setLogTaskId(existing?.taskId ?? selectedTaskId);
    setLogDate(existing?.date ?? date);
    setLogStartTime(existing?.startTime ?? "");
    setLogEndTime(existing?.endTime ?? "");
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
      const dayCount = loggerRangeView === "week" ? 7 : 31;
      return addDaysISO(anchor, direction * dayCount);
    });
  }

  function submitTimeLog() {
    const hours = calculatedLogHours;
    if (!logTaskId || hours === null || hours <= 0) return;

    const date = logDate || clientToday || todayISO();
    const existing = timeLogs.find(
      (entry) =>
        entry.id === editingLogId ||
        (!editingLogId && entry.taskId === logTaskId && entry.date === date)
    );

    setTimeLogs((prev) => {
      const withoutSameDate = prev.filter(
        (entry) =>
          entry.id !== existing?.id &&
          !(entry.taskId === logTaskId && entry.date === date)
      );
      const next: TimeLog = {
        id: existing?.id ?? uid(),
        taskId: logTaskId,
        date,
        startTime: logStartTime,
        endTime: logEndTime,
        hours,
        note: logNote.trim(),
      };
      return [next, ...withoutSameDate];
    });

    setEditingLogId(null);
    setLogOpen(false);
  }

  function deleteTimeLog(id: string) {
    setTimeLogs((prev) => prev.filter((log) => log.id !== id));
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
    setTasks(nextTasks);
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search (press /)"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 sm:w-[320px]"
              />
            </div>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 sm:w-[220px]"
            >
              <option value="all">All courses</option>
              {COURSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

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
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
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
                  return (
                    <tr
                      key={t.id}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                        t.status === "completed" ? "opacity-60" : ""
                      }`}
                      onClick={() => openEdit(t)}
                    >
                      <td className="max-w-[420px] truncate px-3 py-2 font-medium">{t.title}</td>
                      <td className="px-3 py-2 text-slate-600">{courseLabel(t.courseId)}</td>
                      <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPill(t.status)}`}>
                        {statusLabel(t.status)}
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
        ) : mode === "logger" ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">Logger</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Daily focus density across tasks and projects
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
                      { id: "week", label: "Week" },
                      { id: "month", label: "Month" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLoggerRangeView(option.id as LoggerRangeView)}
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          loggerRangeView === option.id
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
                      aria-label="Previous range"
                    >
                      ←
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
                      aria-label="Next range"
                    >
                      →
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

              <div className="overflow-x-auto scroll-smooth px-4 py-4 pb-5">
                <div className="min-w-max">
                  <div className="grid grid-cols-[190px_1fr] gap-3">
                    <div className="pt-8 text-xs font-medium text-slate-500">Task / project</div>
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${loggerDays.length}, ${
                          loggerRangeView === "week" ? "112px" : "16px"
                        })`,
                      }}
                    >
                      {loggerDays.map((day, index) => (
                        <div
                          key={day}
                          className={`rounded-lg text-center text-[10px] leading-tight text-slate-400 ${
                            loggerRangeView === "week" ? "h-12 bg-slate-50/70 px-2 py-1" : "h-11"
                          }`}
                        >
                          <div className="h-3 text-left font-semibold tracking-wide text-slate-400">
                            {index === 0 || day.slice(5, 7) !== loggerDays[index - 1]?.slice(5, 7)
                              ? formatMonthLabel(day)
                              : ""}
                          </div>
                          <div className="mt-1 font-medium text-slate-400">{weekdayLetter(day)}</div>
                          <div className="mt-0.5 tabular-nums text-slate-500">{dateNumber(day)}</div>
                        </div>
                      ))}
                    </div>

                    {loggerTasks.map((task) => (
                      <React.Fragment key={task.id}>
                        <div className="flex min-h-5 items-center justify-between gap-3 rounded-xl px-2 text-sm">
                          <button
                            type="button"
                            className="min-w-0 truncate text-left font-medium text-slate-700 hover:text-slate-950"
                            onClick={() => openLogTime(task.id)}
                          >
                            {task.title}
                          </button>
                          <span className="shrink-0 text-xs tabular-nums text-slate-400">
                            {timeLogs
                              .filter((log) => log.taskId === task.id)
                              .reduce((sum, log) => sum + log.hours, 0)
                              .toFixed(1)}
                            h
                          </span>
                        </div>

                        <div
                          className="grid items-center gap-1"
                          style={{
                            gridTemplateColumns: `repeat(${loggerDays.length}, ${
                              loggerRangeView === "week" ? "112px" : "16px"
                            })`,
                          }}
                        >
                          {loggerDays.map((day) => {
                            const log = logsByTaskDate[`${task.id}:${day}`];
                            const hours = log?.hours ?? 0;
                            const tooltip = `${task.title} • ${day} • ${hours.toFixed(2)}h${
                              log?.note ? ` • ${log.note}` : ""
                            }`;
                            const startMinutes = log?.startTime ? timeToMinutes(log.startTime) : null;
                            const endMinutes = log?.endTime ? timeToMinutes(log.endTime) : null;
                            const pillLeft =
                              startMinutes !== null ? `${(startMinutes / 1440) * 100}%` : "0%";
                            const pillWidth =
                              startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
                                ? `${Math.max(18, ((endMinutes - startMinutes) / 1440) * 100)}%`
                                : `${Math.min(100, Math.max(30, (hours / 4) * 100))}%`;
                            return (
                              <button
                                type="button"
                                key={`${task.id}-${day}`}
                                title={tooltip}
                                aria-label={tooltip}
                                onClick={() => openLogTime(task.id, day, log)}
                                className={
                                  loggerRangeView === "week"
                                    ? "flex h-12 w-28 items-center rounded-xl border border-slate-200/80 bg-white px-2 transition-colors duration-300 hover:border-violet-200 hover:bg-violet-50/40"
                                    : `h-4 w-4 rounded-[4px] transition-colors duration-300 hover:ring-2 hover:ring-violet-200 hover:ring-offset-1 ${heatmapCellClass(hours)}`
                                }
                              >
                                {loggerRangeView === "week" && hours > 0 ? (
                                  <span
                                    className={`flex h-6 items-center rounded-full px-2 text-[11px] font-medium tabular-nums ${heatmapFillClass(hours)}`}
                                    style={{ marginLeft: pillLeft, width: pillWidth }}
                                  >
                                    {hours.toFixed(1)}h
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </React.Fragment>
                    ))}

                    {loggerTasks.length === 0 ? (
                      <div className="col-span-2 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
                        No tasks match this logger view.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                <span>Less</span>
                {[0, 0.75, 2, 3.25, 4.5].map((hours) => (
                  <span
                    key={hours}
                    className={`h-4 w-4 rounded-[4px] ${heatmapCellClass(hours)}`}
                    aria-label={`${hours} hours`}
                  />
                ))}
                <span>More</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "This week hours",
                  value: `${loggerSummary.week.toFixed(1)}h`,
                  movement: loggerSummary.weekChange,
                },
                {
                  label: "This month hours",
                  value: `${loggerSummary.month.toFixed(1)}h`,
                  movement: loggerSummary.monthChange,
                },
                {
                  label: "Highest scorer this week",
                  value: loggerSummary.highestWeek
                    ? `${loggerSummary.highestWeek.name} · ${loggerSummary.highestWeek.hours.toFixed(1)}h`
                    : "—",
                },
                {
                  label: "Highest scorer this month",
                  value: loggerSummary.highestMonth
                    ? `${loggerSummary.highestMonth.name} · ${loggerSummary.highestMonth.hours.toFixed(1)}h`
                    : "—",
                },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">{card.label}</div>
                    {typeof card.movement === "number" ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${movementPill(card.movement)}`}>
                        {movementLabel(card.movement)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900">
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="text-sm font-semibold">Recent log entries</div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Task</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Start</th>
                    <th className="px-3 py-2 text-left font-medium">End</th>
                    <th className="px-3 py-2 text-left font-medium">Duration</th>
                    <th className="px-3 py-2 text-left font-medium">Note</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length ? (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {logTaskTitle(log.taskId)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{log.date}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{log.startTime || "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{log.endTime || "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{formatDuration(log.hours)}</td>
                        <td className="max-w-[420px] truncate px-3 py-2 text-slate-500">
                          {log.note || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openLogTime(log.taskId, log.date, log)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTimeLog(log.id)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-slate-100">
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                        No time logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Course columns */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {COURSES.map((c) => (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{c.label}</div>
                      <div className="text-xs text-slate-500">
                        {byCourse[c.id]?.length ?? 0} total
                        {byCourse[c.id]?.length ? <> • {openCount(byCourse[c.id])} open</> : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 py-4">
                    {byCourse[c.id]?.length ? (
                      byCourse[c.id].map((t) => {
                        const days = t.due ? daysLeftFromISO(t.due) : null;
                        const dueSoon = days !== null && days <= 2;

                        return (
                          <div
                            key={t.id}
                            onClick={() => openEdit(t)}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openEdit(t);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{t.title}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {t.priority === "high" ? <Pill tone="red">High</Pill> : null}
                                  {t.due ? <Pill tone={dueSoon ? "red" : "neutral"}>Due {t.due}</Pill> : null}
                                  {days !== null ? (
                                    <Pill tone={days <= 2 ? "red" : "neutral"}>{timeLeftLabel(days)}</Pill>
                                  ) : null}
                                  {t.durationHrs != null ? <Pill>{t.durationHrs}h</Pill> : null}
                                  {t.difficulty != null ? <Pill>D{t.difficulty}</Pill> : null}
                                </div>
                              </div>

                              <button
                                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(t.id);
                                }}
                                aria-label="Delete"
                              >
                                Delete
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
            </div>

            {/* Right rail */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 h-fit">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Attention score</div>
                  <div className="text-xs text-slate-500">{scoredTasks.length} tasks</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className={`rounded-xl border px-2 py-1 text-xs ${
                      scoreUseTime ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white text-slate-400"
                    }`}
                    onClick={() => setScoreUseTime((v) => !v)}
                    type="button"
                  >
                    Time
                  </button>
                  <button
                    className={`rounded-xl border px-2 py-1 text-xs ${
                      scoreUsePriority ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white text-slate-400"
                    }`}
                    onClick={() => setScoreUsePriority((v) => !v)}
                    type="button"
                  >
                    Priority
                  </button>
                  <button
                    className={`rounded-xl border px-2 py-1 text-xs ${
                      scoreUseDuration ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white text-slate-400"
                    }`}
                    onClick={() => setScoreUseDuration((v) => !v)}
                    type="button"
                  >
                    Duration
                  </button>
                  <button
                    className={`rounded-xl border px-2 py-1 text-xs ${
                      scoreUseDifficulty ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white text-slate-400"
                    }`}
                    onClick={() => setScoreUseDifficulty((v) => !v)}
                    type="button"
                  >
                    Difficulty
                  </button>
                </div>

                <div className="mt-2">
                  <button
                    className={`w-full rounded-xl border px-2 py-1 text-xs ${
                      scoreShowCompleted ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white text-slate-400"
                    }`}
                    onClick={() => setScoreShowCompleted((v) => !v)}
                    type="button"
                  >
                    Include completed
                  </button>
                </div>
              </div>

              <button
              onClick={() => setShowWeights(!showWeights)}
              className="mt-2 mx-4 w-[calc(100%-20px)] rounded-xl border border-slate-300 px-2 py-1 text-xs"
            >Adjust Weights
</button>

{showWeights && (
  <div className="mt-3 space-y-6 border-y border-slate-100 bg-slate-50/40 px-4 py-5 text-xs">

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
          onChange={(e) =>
            setWeights({ ...weights, time: Number(e.target.value) })
          }
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
          onChange={(e) =>
            setWeights({ ...weights, priority: Number(e.target.value) })
          }
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
          onChange={(e) =>
            setWeights({ ...weights, duration: Number(e.target.value) })
          }
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
          onChange={(e) =>
            setWeights({ ...weights, difficulty: Number(e.target.value) })
          }
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
)}

              <div className="space-y-4 px-4 py-4">
              

                {/* Score list */}
                <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
                  {scoredTasks.map(({ task }) => {
                  const score = urgencyScore(task, weights);
                  const days = task.due ? daysLeftFromISO(task.due) : null;


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
                            <div className="mt-1 flex flex-wrap gap-2">
                              {task.due ? (
                                <span className={`text-[11px] ${days !== null && days <= 2 ? "text-red-600" : "text-slate-500"}`}>
                                  {days === null ? "—" : timeLeftLabel(days)}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500">No due</span>
                              )}
                              <span className="text-[11px] text-slate-500">{priorityLabel(task.priority)}</span>
                              {task.durationHrs != null ? (
                                <span className="text-[11px] text-slate-500">{task.durationHrs}h</span>
                              ) : null}
                              {task.difficulty != null ? (
                                <span className="text-[11px] text-slate-500">D{task.difficulty}</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{Math.round(score)}</div>                        </div>

                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                            className={`h-2 rounded-full transition-all duration-500 ${urgencyColour(score)}`}
                            style={{ width: `${score}%` }}
                          />
                          </div>

                      </div>
                    );
                  })}
                </div>
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNewTask();
                }
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <SelectBox
  value={newStatus}
  onChange={(v) => setNewStatus(v as Status)}
  options={STATUSES}
/>
            </Field>

            <Field label="Course">
              <select
                value={newCourseId}
                onChange={(e) => setNewCourseId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {COURSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {["1", "2", "3", "4", "5"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
              <div className="text-[11px] text-slate-500">
                {newDue && daysLeftFromISO(newDue) !== null ? `Time left: ${timeLeftLabel(daysLeftFromISO(newDue) as number)}` : ""}
              </div>
            </Field>

            <Field label="Duration (hours)">
              <input
                inputMode="decimal"
                placeholder="e.g. 1.5"
                value={newDurationHrs}
                onChange={(e) => setNewDurationHrs(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Any extra context"
              className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-1">
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

            <Field label="Calculated duration">
              <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums text-slate-600">
                {calculatedLogHours ? formatDuration(calculatedLogHours) : "—"}
              </div>
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
                disabled={!logTaskId || !calculatedLogHours}
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <SelectBox
                  value={draft.status}
                  onChange={(v) => setDraft({ ...draft, status: v })}
                  options={STATUSES}
                />
              </Field>

              <Field label="Course">
                <select
                  value={draft.courseId}
                  onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {COURSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {["1", "2", "3", "4", "5"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date">
                <input
                  type="date"
                  value={draft.due ?? ""}
                  onChange={(e) => setDraft({ ...draft, due: e.target.value || undefined })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
                <div className="text-[11px] text-slate-500">
                  {draft.due && daysLeftFromISO(draft.due) !== null
                    ? `Time left: ${timeLeftLabel(daysLeftFromISO(draft.due) as number)}`
                    : "No due date"}
                </div>
              </Field>

              <Field label="Duration (hours)">
                <input
                  inputMode="decimal"
                  value={draft.durationHrs == null ? "" : String(draft.durationHrs)}
                  onChange={(e) =>
                    setDraft({ ...draft, durationHrs: optionalFiniteNumber(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <div className="flex items-center justify-between pt-1">
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
