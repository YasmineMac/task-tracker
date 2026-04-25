"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { COURSES } from "./courses";
import { supabase } from "@/lib/supabase";

type Priority = "low" | "normal" | "high";
type Status = "to_do" | "in_progress" | "urgent" | "frozen" | "completed";

type Task = {
  id: string;
  title: string;
  courseId: string;
  status: Status;
  priority: Priority;
  due?: string; // yyyy-mm-dd
  notes?: string;
  durationHrs?: number | null;
  difficulty?: number | null; // 1..5
  createdAt: number;
  mode?: "task" | "practice";
};

const STORAGE_KEY = "yasmine_tasks_v2_clean";

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

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function loadTasks(syncCode: string): Promise<Task[]> {
  if (!supabase) {
    console.error("Supabase env vars are missing");
    return [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("sync_code", syncCode)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading tasks:", error);
    return [];
  }

  return (data || []).map((t: any) =>
    normalizeTask({
      id: t.id,
      title: t.title,
      courseId: t.course_id,
      status: t.status,
      priority: t.priority,
      due: t.due,
      notes: t.notes,
      durationHrs: t.duration_hrs,
      difficulty: t.difficulty,
      createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
    })
  );
}

async function saveTasks(tasks: Task[]) {
  if (!supabase) {
    console.error("Supabase env vars are missing");
    return;
  }

  const SYNC_CODE = "YAS-TEST-001";

  const { error: deleteError } = await supabase
    .from("tasks")
    .delete()
    .eq("sync_code", SYNC_CODE);

  if (deleteError) {
    console.error(
      "Error deleting old tasks:",
      deleteError.message,
      deleteError.details,
      deleteError.hint
    );
    return;
  }

  const tasksToInsert = tasks.map((t) => ({
    sync_code: SYNC_CODE,
    title: t.title,
    course_id: t.courseId,
    status: t.status,
    priority: t.priority,
    due: t.due ?? null,
    notes: t.notes ?? null,
    duration_hrs: t.durationHrs ?? null,
    difficulty: t.difficulty ?? null,
  }));

  if (tasksToInsert.length === 0) return;

  const { error: insertError } = await supabase
    .from("tasks")
    .insert(tasksToInsert);

  if (insertError) {
    console.error(
      "Error saving tasks:",
      insertError.message,
      insertError.details,
      insertError.hint
    );
  }
}

function normalizeTask(t: any): Task {
  const resolvedCourseId = String(t.courseId ?? t.course ?? "robotics_studio");

  return {
    id: String(t.id ?? uid()),
    title: String(t.title ?? "").trim(),
    courseId: resolvedCourseId,
    status: (t.status ?? "to_do") as Status,
    priority: (t.priority ?? "normal") as Priority,
    due: typeof t.due === "string" ? t.due : undefined,
    notes:
      typeof t.notes === "string"
        ? t.notes
        : typeof t.comments === "string"
          ? t.comments
          : undefined,
    durationHrs: t.durationHrs == null ? null : Number(t.durationHrs),
    difficulty: t.difficulty == null ? null : Number(t.difficulty),
    createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    mode: resolvedCourseId === "yas_project" ? "practice" : "task",
  };
}

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
    case "Urgent":
      return "bg-red-100 text-red-700";
    case "In progress":
      return "bg-blue-100 text-blue-700";
    case "To do":
      return "bg-slate-100 text-slate-700";
    case "Frozen":
      return "bg-zinc-200 text-zinc-600";
    case "Completed":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-600";
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
  const WEEKLY_CAPACITY_HRS = 4;

  const [tasks, setTasks] = useState<Task[]>([]);
  const hasLoadedFromSupabase = useRef(false);
  const [mode, setMode] = useState<"board" | "list">("board");

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

const SYNC_CODE = "YAS-TEST-001";

useEffect(() => {
  async function fetchTasks() {
    const loaded = await loadTasks(SYNC_CODE);
    setTasks(loaded);
    hasLoadedFromSupabase.current = true;
  }

  fetchTasks();
}, []);

useEffect(() => {
  if (!hasLoadedFromSupabase.current) return;
  saveTasks(tasks);
}, [tasks]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const isTyping =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as any).isContentEditable);

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

    function get(t: Task) {
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
      const av = get(a) as any;
      const bv = get(b) as any;

      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });

    return rows;
  }, [filtered, listSortKey, listSortDir]);

  const byCourse = useMemo(() => {
    const map: Record<string, Task[]> = Object.fromEntries(COURSES.map((c) => [c.id, []]));
    for (const t of filtered) {
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

  const weeklyHorizon = useMemo(() => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);

      const tasksDue = filtered.filter((t) => t.due === iso && t.status !== "completed");
      const totalHrs = tasksDue.reduce((sum, t) => {
        const hrs = t.durationHrs == null ? 1 : Number(t.durationHrs);
        return sum + (Number.isFinite(hrs) ? hrs : 1);
      }, 0);

      return { iso, totalHrs, tasksDueCount: tasksDue.length };
    });

    const maxHrs = Math.max(1, ...days.map((x) => x.totalHrs));
    return { days, maxHrs };
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

  const maxScore = useMemo(() => Math.max(1, ...scoredTasks.map((x) => x.total)), [scoredTasks]);

  function openNewTaskForCourse(courseId: string) {
    setNewCourseId(courseId);
    setNewOpen(true);
  }

  function submitNewTask() {
    const title = newTitle.trim();
    if (!title) return;

    const dur = newDurationHrs.trim() ? Number(newDurationHrs) : null;
    const diff = newDifficulty.trim() ? Number(newDifficulty) : null;

    const t: Task = {
      id: uid(),
      title,
      courseId: newCourseId || COURSES[0].id,
      status: newStatus,
      priority: newPriority,
      due: newDue || undefined,
      notes: newNotes.trim() || undefined,
      durationHrs: Number.isFinite(dur as any) ? dur : null,
      difficulty: Number.isFinite(diff as any) ? diff : null,
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
    setTasks((prev) => prev.filter((t) => t.id !== id));
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

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm text-slate-500">Yasmine’s task tracker</div>
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
                  {[
                    ["title", "Title"],
                    ["course", "Course"],
                    ["status", "Status"],
                    ["priority", "Priority"],
                    ["due", "Due"],
                    ["timeLeft", "Time left"],
                    ["duration", "Duration"],
                    ["difficulty", "Difficulty"],
                  ].map(([key, label]) => (
                    <th key={key} className="px-3 py-2 text-left font-medium">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          const k = key as any;
                          if (listSortKey === k) setListSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          else {
                            setListSortKey(k);
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
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
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
  <div className="mt-3 space-y-4 rounded-2xl border border-white/40 bg-white/60 p-3 backdrop-blur-md shadow-sm text-xs">

    <div>
      <label>Time: {weights.time}</label>
      <input
        type="range"
        min="0"
        max="100"
        value={weights.time}
        onChange={(e) =>
          setWeights({ ...weights, time: Number(e.target.value) })
        }
        className="glass-slider w-full"
        style={{
          background: `linear-gradient(to right,
            #84cc16 0%,
            #f97316 ${weights.time * 0.55}%,
            #fb7185 ${weights.time - 8}%,
            #ffffff ${weights.time + 4}%,
            #ffffff 100%)`,
        }}
      />
    </div>

    <div>
      <label>Priority: {weights.priority}</label>
      <input
        type="range"
        min="0"
        max="100"
        value={weights.priority}
        onChange={(e) =>
          setWeights({ ...weights, priority: Number(e.target.value) })
        }
        className="glass-slider w-full"
        style={{
          background: `linear-gradient(to right,
            #84cc16 0%,
            #f97316 ${weights.priority * 0.55}%,
            #fb7185 ${weights.priority - 8}%,
            #ffffff ${weights.priority + 4}%,
            #ffffff 100%)`,
        }}
      />
    </div>

    <div>
      <label>Duration: {weights.duration}</label>
      <input
        type="range"
        min="0"
        max="100"
        value={weights.duration}
        onChange={(e) =>
          setWeights({ ...weights, duration: Number(e.target.value) })
        }
        className="glass-slider w-full"
        style={{
          background: `linear-gradient(to right,
            #84cc16 0%,
            #f97316 ${weights.duration * 0.55}%,
            #fb7185 ${weights.duration - 8}%,
            #ffffff ${weights.duration + 4}%,
            #ffffff 100%)`,
        }}
      />
    </div>

    <div>
      <label>Difficulty: {weights.difficulty}</label>
      <input
        type="range"
        min="0"
        max="100"
        value={weights.difficulty}
        onChange={(e) =>
          setWeights({ ...weights, difficulty: Number(e.target.value) })
        }
        className="glass-slider w-full"
        style={{
          background: `linear-gradient(to right,
            #84cc16 0%,
            #f97316 ${weights.difficulty * 0.55}%,
            #fb7185 ${weights.difficulty - 8}%,
            #ffffff ${weights.difficulty + 4}%,
            #ffffff 100%)`,
        }}
      />
    </div>

    <button
      onClick={() =>
        setWeights({
          time: 50,
          priority: 20,
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
                  const width = score; // already 0–100
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
          <div className="font-medium text-slate-900">Keyboard</div>
          <div className="mt-1">
            Press <span className="rounded border px-1">/</span> to search,{" "}
            <span className="rounded border px-1">n</span> to create a task.
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
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = raw.trim() === "" ? null : Number(raw);
                    setDraft({ ...draft, durationHrs: Number.isFinite(n as any) ? n : null });
                  }}
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
