"use client";

// =======================================================
// IMPORTS (libraries + UI components + icons + data)
// =======================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Trash2, ChevronRight, Circle, Clock, Flag } from "lucide-react";
import { courses, Course } from "./courses";

// =======================================================
// APP DESCRIPTION (what this file is)
// =======================================================
// Minimal, Linear-like task tracker
// - Local-only, using localStorage
// - Two views: Dashboard + List
// - New task dialog + Edit task dialog
// - Search + filters
// - Keyboard shortcuts: "/" focuses search, "n" opens new task

// =======================================================
// GLOBAL CONSTANTS (storage key + dropdown options)
// =======================================================
const STORAGE_KEY = "yasmine_tasks_v1";

// -------------------- STATUS OPTIONS --------------------
const STATUSES = [
  { id: "to_do", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "urgent", label: "Urgent" },
  { id: "frozen", label: "Frozen" },
  { id: "completed", label: "Completed" },
];

const NEW_STATUSES = [
  { id: "to_do", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "frozen", label: "Frozen" },
  { id: "urgent", label: "Urgent" },
  { id: "completed", label: "Completed" },
];

// -------------------- TYPE OPTIONS (legacy/unused now) --------------------
const TYPES = [
  { id: "studio", label: "Studio" },
  { id: "seminar", label: "Seminar" },
  { id: "admin", label: "Admin" },
  { id: "personal", label: "Personal" },
];

// -------------------- PRIORITY OPTIONS --------------------
const PRIORITIES = [
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

// -------------------- EFFORT OPTIONS (legacy/unused now) --------------------
const EFFORTS = [
  { id: "15m", label: "15m" },
  { id: "30m", label: "30m" },
  { id: "1h", label: "1h" },
  { id: "deep", label: "Deep" },
];

// -------------------- DIFFICULTY OPTIONS --------------------
const DIFFICULTIES = [
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "3", label: "3" },
  { id: "4", label: "4" },
  { id: "5", label: "5" },
];

// -------------------- COURSE OPTIONS (for UI dropdowns) --------------------
const COURSES = [
  { id: "robotics_studio", label: "Robotics Studio" },
  { id: "after_gaudi", label: "After Gaudí" },
  { id: "assembled_arch", label: "Assembled Architecture" },
  { id: "adv_robotics_workshop", label: "Advanced Robotics Workshop" },
  { id: "computational_design", label: "Computational Design" },
  { id: "lecture_series", label: "Lecture Series" },
];

// =======================================================
// HELPERS (IDs, localStorage, normalisation)
// =======================================================

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// -------------------- localStorage: load --------------------
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTask);
  } catch {
    return [];
  }
}

// -------------------- data normaliser (cleans old fields) --------------------
function normalizeTask(t: any) {
  // Unify course field
  const courseId = t.courseId ?? t.course ?? "";

  return {
    ...t,
    courseId,
    // remove old field if it exists (optional, but keeps data clean)
    course: undefined,
    type: undefined,
    effort: undefined,
  };
}

// -------------------- localStorage: save --------------------
function saveTasks(tasks: any[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// =======================================================
// HELPERS (formatting, sorting ranks, counts)
// =======================================================

function formatDateISO(d: string | null | undefined) {
  if (!d) return "";
  // Keep ISO yyyy-mm-dd
  return d;
}

function priorityRank(p) {
  if (p === "high") return 0;
  if (p === "normal") return 1;
  return 2;
}

// NOTE: This is still here, but "effort" is legacy and no longer used
function effortRank(e) {
  if (e === "15m") return 0;
  if (e === "30m") return 1;
  if (e === "1h") return 2;
  return 3;
}

function isCompleted(t: any) {
  return t.status === "completed";
}

function openCount(list: any[]) {
  return list.filter((t) => !isCompleted(t)).length;
}

function statusLabel(id) {
  return STATUSES.find((s) => s.id === id)?.label ?? id;
}

function courseLabel(id: string) {
  if (!id) return "";
  const fromLocal = COURSES.find((c) => c.id === id)?.label;
  if (fromLocal) return fromLocal;
  const fromImported = courses.find((c) => c.id === id)?.name;
  return fromImported ?? id;
}


// NOTE: These label helpers still exist, but type/effort are legacy now
function typeLabel(id) {
  return TYPES.find((t) => t.id === id)?.label ?? "";
}

function priorityLabel(id) {
  return PRIORITIES.find((p) => p.id === id)?.label ?? "";
}

function effortLabel(id) {
  return EFFORTS.find((e) => e.id === id)?.label ?? "";
}

// =======================================================
// UI HELPER COMPONENTS (small reusable UI bits)
// =======================================================

function Chip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

// =======================================================
// DATE HELPERS (parsing + formatting + time-left)
// =======================================================

function parseDDMMYYYY(input: string): string | "" {
  // Accepts dd/mm/yyyy and returns yyyy-mm-dd (or "" if invalid)
  const m = input.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12) return "";
  if (dd < 1 || dd > 31) return "";

  // Validate real calendar date
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) return "";

  const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return iso;
}

function formatISOToDDMMYYYY(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  function timeScoreFromDays(days: number | null) {
    if (days === null) return 0;
    if (days < 0) return 100;
    if (days === 0) return 90;
    if (days === 1) return 75;
    if (days === 2) return 60;
    if (days <= 7) return 40;
    return 20;
  }

  function priorityScore(p: string | undefined) {
    if (p === "high") return 60;
    if (p === "normal") return 35;
    return 15;
  }

  function durationScore(durationHrs: number | null | undefined) {
    const d = durationHrs == null ? 1 : durationHrs;
    return clamp(Math.round((clamp(d, 0, 6) / 6) * 50), 0, 50);
  }

  function difficultyScore(diff: number | null | undefined) {
    const x = diff == null ? 3 : diff;
    return clamp(Math.round((clamp(x, 1, 5) / 5) * 40), 0, 40);
  }

function daysLeftFromISO(iso: string): number | null {
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

function timeLeftLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1d left";
  return `${days}d left`;
}

// =======================================================
// COMPONENT: TaskCard (each task shown in lists/columns)
// =======================================================

function TaskCard({ task, onMove, onDelete, onOpen }) {
  // -------------------- derived: "due soon" + "days left" --------------------
  const dueSoon = task.due && task.due <= formatDateISO(new Date().toISOString().slice(0, 10));
  const daysLeft =
    task.due && daysLeftFromISO(task.due) !== null
      ? daysLeftFromISO(task.due)
      : null;

  return (
    <div
      className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{task.title}</div>

          {/* -------------------- Task meta chips + badges row -------------------- */}
          <div className="mt-2 flex flex-wrap gap-2">
            {/* NOTE: type/effort chips are legacy, still present here */}
            {task.type ? <Chip icon={ChevronRight}>{typeLabel(task.type)}</Chip> : null}
            {task.priority === "high" ? (
  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">
    <Flag className="h-3.5 w-3.5" />
    High
  </span>
) : null}
            {task.effort ? <Chip icon={Clock}>{effortLabel(task.effort)}</Chip> : null}

            {/* -------------------- Due date badge -------------------- */}
            {task.due ? (
              <Badge variant={dueSoon ? "destructive" : "secondary"} className="rounded-full">
                Due {task.due}
              </Badge>
            ) : null}

            {/* -------------------- Time left badge -------------------- */}
            {daysLeft !== null ? (
              <Badge variant={daysLeft <= 2 ? "destructive" : "secondary"} className="rounded-full">
                {timeLeftLabel(daysLeft)}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* -------------------- Hover actions: status dropdown + delete button -------------------- */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 rounded-full"
    onClick={(e) => {
      e.stopPropagation();
      onDelete(task.id);
    }}
    aria-label="Delete"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>

      </div>
    </div>
  );
}

// =======================================================
// COMPONENT: TaskDialog (Edit Task dialog)
// =======================================================

function TaskDialog({ open, onOpenChange, task, onSave }) {
  const [draft, setDraft] = useState(task ?? null);

  useEffect(() => {
    setDraft(task ?? null);
  }, [task]);

  if (!draft) return null;

  // -------------------- derived: days left for the draft task --------------------
  const daysLeft =
    draft.due && daysLeftFromISO(draft.due) !== null
      ? daysLeftFromISO(draft.due)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-white text-slate-900 border border-slate-200">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>

        {/* -------------------- Form layout container -------------------- */}
        <div className="grid gap-4">

          {/* -------------------- Field: Title -------------------- */}
          <div className="grid gap-2">
            <div className="text-xs text-muted-foreground">Title</div>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>

          {/* -------------------- Grid: Status / Course / Priority / Duration / Difficulty / Due -------------------- */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

            {/* Status */}
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Status</div>
              <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                  {STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-slate-900">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Course */}
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Course</div>
              <Select value={draft.courseId} onValueChange={(v) => setDraft((d) => ({ ...d, courseId: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Course" />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                  {COURSES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Priority</div>
              <Select value={draft.priority} onValueChange={(v) => setDraft((d) => ({ ...d, priority: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration (hours) */}
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Duration (hours)</div>
              <Input
                inputMode="decimal"
                placeholder="e.g. 1.5"
                value={draft.durationHrs ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = raw === "" ? null : Number(raw);
                  setDraft((d) => ({ ...d, durationHrs: Number.isFinite(n as any) ? n : null }));
                }}
                className="rounded-xl"
              />
            </div>

            {/* Difficulty (1–5) */}
            <div className="grid gap-2">
              <div className="text-xs text-muted-foreground">Difficulty</div>
              <Select
                value={draft.difficulty == null ? "3" : String(draft.difficulty)}
                onValueChange={(v) => setDraft((d) => ({ ...d, difficulty: Number(v) }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Difficulty (1–5)" />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                  {["1", "2", "3", "4", "5"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date + time left label */}
            <div className="grid gap-2">
            <div className="text-xs text-muted-foreground">Due date</div>
            <Input
                type="date"
                value={draft.due ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))}
                className="rounded-xl"
            />
            {daysLeft !== null ? (
                <div className="text-[11px] text-muted-foreground">
                Time left: {timeLeftLabel(daysLeft)}
                </div>
            ) : (
                <div className="text-[11px] text-muted-foreground">No due date</div>
            )}
            </div>

          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <div className="text-xs text-muted-foreground">Notes (optional)</div>
            <textarea
              className="min-h-[110px] w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Keep it short. One or two lines is enough."
            />
          </div>
        </div>

        {/* Footer buttons */}
        <DialogFooter>
          <Button
            onClick={() => {
              if (!draft.title.trim()) return;
              onSave(draft);
              onOpenChange(false);
            }}
            className="rounded-full"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =======================================================
// MAIN COMPONENT: MinimalTaskTracker (the whole page UI)
// =======================================================

export default function MinimalTaskTracker() {
  // -------------------- STATE: tasks data --------------------
  const [tasks, setTasks] = useState<any[]>([]);
  const WEEKLY_CAPACITY_HRS = 4;

  // -------------------- STATE: search + filters --------------------
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // NOTE: type is legacy now, but filter still exists
  const [statusMode, setStatusMode] = useState("board"); // board | list

  // -------------------- STATE: New Task dialog fields --------------------
  const [newTitle, setNewTitle] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const [newStatus, setNewStatus] = useState("to_do");
  const [newCourseId, setNewCourseId] = useState("robotics_studio");
  const [newPriority, setNewPriority] = useState("normal");
  const [newComments, setNewComments] = useState("");
  const [newDue, setNewDue] = useState(""); // yyyy-mm-dd from date input
  const [newDifficulty, setNewDifficulty] = useState("3"); // "1"..."5"
  const [newDurationHrs, setNewDurationHrs] = useState(""); // free text for now
  // -------------------- LIST VIEW: sort state --------------------
const [listSortKey, setListSortKey] = useState<
  "title" | "course" | "status" | "priority" | "due" | "timeLeft" | "duration" | "difficulty"
>("due");

const [listSortDir, setListSortDir] = useState<"asc" | "desc">("asc");


  // -------------------- STATE: Attention Score toggles (for Chart 1 later) --------------------
  const [scoreUseTime, setScoreUseTime] = useState(true);
  const [scoreUsePriority, setScoreUsePriority] = useState(true);
  const [scoreUseDuration, setScoreUseDuration] = useState(true);
  const [scoreUseDifficulty, setScoreUseDifficulty] = useState(true);
  const [scoreShowBreakdown, setScoreShowBreakdown] = useState(false);
  const [scoreShowCompleted, setScoreShowCompleted] = useState(false);


  <button
  className={`rounded-xl border px-2 py-1 text-xs ${
    scoreShowBreakdown ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white text-slate-400"
  }`}
  onClick={() => setScoreShowBreakdown((v) => !v)}
  type="button"
>
  Breakdown bars
  <button
  className={`rounded-xl border px-2 py-1 text-xs ${
    scoreShowCompleted ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white text-slate-400"
  }`}
  onClick={() => setScoreShowCompleted((v) => !v)}
  type="button"
>
  Include completed
</button>
</button>




  // -------------------- REFS: search input focus --------------------
  const searchRef = useRef(null);

  // =======================================================
  // EFFECT: initial load (localStorage -> tasks)
  // =======================================================
  useEffect(() => {
    const initial = loadTasks();

    if (initial.length) {
      setTasks(initial);
      return;
    }

    // optional seeding (disabled)
  }, []);

  // -------------------- STATE: Edit Task dialog --------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  // =======================================================
  // EFFECT: save tasks to localStorage whenever tasks change
  // =======================================================
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // =======================================================
  // EFFECT: keyboard shortcuts (/, n, Escape)
  // =======================================================
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;

      const isTypingField =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          (el as HTMLElement).isContentEditable);

      if (isTypingField) {
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setNewOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setNewOpen(false);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // =======================================================
  // DERIVED DATA: filtered + sorted tasks (search + filters)
  // =======================================================
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (courseFilter !== "all" && t.courseId !== courseFilter) return false;
        if (typeFilter !== "all" && t.type !== typeFilter) return false; // NOTE: type is legacy now
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        // Done goes last in list view
        if (statusMode === "list") {
          if (a.status === "completed" && b.status !== "completed") return 1;
          if (b.status === "completed" && a.status !== "completed") return -1;
        }

        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;

        // NOTE: effort is legacy, but still used here in sorting
        const er = effortRank(a.effort) - effortRank(b.effort);
        if (er !== 0) return er;

        // Due first
        const ad = a.due || "9999-12-31";
        const bd = b.due || "9999-12-31";
        if (ad !== bd) return ad.localeCompare(bd);

        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [tasks, query, courseFilter, typeFilter, statusMode]);

  // -------------------- DERIVED: list view sorted rows --------------------
const listRows = useMemo(() => {
  const rows = filtered.slice();

  function cmp(a: any, b: any) {
    const dir = listSortDir === "asc" ? 1 : -1;

    const aDays = a.due ? daysLeftFromISO(a.due) : null;
    const bDays = b.due ? daysLeftFromISO(b.due) : null;

    const get = (t: any) => {
      switch (listSortKey) {
        case "title": return (t.title ?? "").toLowerCase();
        case "course": return courseLabel(t.courseId ?? "").toLowerCase();
        case "status": return statusLabel(t.status ?? "").toLowerCase();
        case "priority": return priorityRank(t.priority);
        case "due": return t.due ?? "9999-12-31";
        case "timeLeft": {
  const d = t.due ? daysLeftFromISO(t.due) : null;
  return d === null ? 999999 : d;
}        case "duration": return t.durationHrs == null ? 999999 : Number(t.durationHrs);
        case "difficulty": return t.difficulty == null ? 999999 : Number(t.difficulty);
        default: return 0;
      }
    };

    const av = get(a);
    const bv = get(b);

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;

    // stable tie-breaker: newest first
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  }

  rows.sort(cmp);
  return rows;
}, [filtered, listSortKey, listSortDir]);


  // =======================================================
  // DERIVED DATA: byStatus map (not used in dashboard now)
  // =======================================================
  const byStatus = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
    for (const t of filtered) {
      if (!map[t.status]) map[t.status] = [];
      map[t.status].push(t);
    }
    return map;
  }, [filtered]);

  // =======================================================
  // DERIVED DATA: byCourse map (powers the Dashboard columns)
  // =======================================================
  const byCourse = useMemo(() => {
    const map: Record<string, any[]> = Object.fromEntries(
      COURSES.map((c) => [c.id, []])
    );

    for (const t of filtered) {
      const key = t.courseId ?? t.course ?? "robotics_studio";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }

    // -------------------- sorting inside each course column --------------------
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const aDays = a.due ? daysLeftFromISO(a.due) : null;
        const bDays = b.due ? daysLeftFromISO(b.due) : null;

        const aBucket =
          aDays === null ? 3 : aDays < 0 ? 0 : aDays <= 2 ? 1 : 2;
        const bBucket =
          bDays === null ? 3 : bDays < 0 ? 0 : bDays <= 2 ? 1 : 2;

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


  // -------------------- DERIVED: scored tasks (Attention Score) --------------------
const scoredTasks = useMemo(() => {
  const baseList = scoreShowCompleted ? filtered : filtered.filter((t) => t.status !== "completed");
const scored = baseList.map((t) => {
    const days = t.due ? daysLeftFromISO(t.due) : null;


    const sTime = scoreUseTime ? timeScoreFromDays(days) : 0;
    const sPri = scoreUsePriority ? priorityScore(t.priority) : 0;
    const sDur = scoreUseDuration ? durationScore(t.durationHrs) : 0;
    const sDiff = scoreUseDifficulty ? difficultyScore(t.difficulty) : 0;

    const total = sTime + sPri + sDur + sDiff;


    return {
      task: t,
      total,
      parts: { time: sTime, priority: sPri, duration: sDur, difficulty: sDiff },
    };
  });

  

  scored.sort((a, b) => {
  if (b.total !== a.total) return b.total - a.total;

  // tie-break 1: earliest due date first (tasks with no due go last)
  const ad = a.task.due || "9999-12-31";
  const bd = b.task.due || "9999-12-31";
  if (ad !== bd) return ad.localeCompare(bd);

  // tie-break 2: high priority first
  const pr = priorityRank(a.task.priority) - priorityRank(b.task.priority);
  if (pr !== 0) return pr;

  // tie-break 3: newest first
  return (b.task.createdAt ?? 0) - (a.task.createdAt ?? 0);
});
  return scored;
}, [filtered, scoreShowCompleted, scoreUseTime, scoreUsePriority, scoreUseDuration, scoreUseDifficulty]);

// -------------------- DERIVED: weekly horizon (next 7 days) --------------------
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


// -------------------- DERIVED: max score for bar scaling --------------------
const maxScore = useMemo(() => {
  return Math.max(1, ...scoredTasks.map((x) => x.total));
}, [scoredTasks]);


  // =======================================================
  // ACTION: addTask (creates a new task object and saves it)
  // =======================================================
  function addTask(base?: any) {
    const title = (base?.title ?? newTitle).trim();

    function openNewTaskForCourse(courseId: string) {
  setNewCourseId(courseId);
  setNewOpen(true);
}

    const t = {
      id: uid(),
      title,
      status: base?.status ?? newStatus,
      courseId: base?.courseId ?? "robotics_studio",
      priority: base?.priority ?? "normal",
      due: base?.due ?? newDue,
      notes: base?.notes ?? newComments,
      difficulty: base?.difficulty ?? Number(newDifficulty),
      durationHrs: base?.durationHrs ?? (newDurationHrs ? Number(newDurationHrs) : null),
      createdAt: Date.now(),
    };

    setTasks((prev) => [t, ...prev]);

    // -------------------- reset New Task dialog fields --------------------
    setNewTitle("");
    setNewCourseId("robotics_studio");
    setNewPriority("normal");
    setNewStatus("to_do");
    setNewDue("");
    setNewDifficulty("3");
    setNewDurationHrs("");
    setNewComments("");
  }

  // =======================================================
  // ACTIONS: move, delete, save, open
  // =======================================================
  function moveTask(id, status) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function saveTask(updated) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function openTask(t) {
    setActiveTask(t);
    setDialogOpen(true);
  }
  function openNewTaskForCourse(courseId: string) {
  setNewCourseId(courseId);
  setNewOpen(true);
}

function submitNewTask() {
  addTask({
    title: newTitle,
    status: newStatus,
    courseId: newCourseId,
    priority: newPriority,
    notes: newComments,
    due: newDue,
    difficulty: Number(newDifficulty),
    durationHrs: newDurationHrs ? Number(newDurationHrs) : undefined,
  });
  setNewOpen(false);
}


  // =======================================================
  // RENDER: Page layout
  // =======================================================
  return (
    <div className="min-h-screen w-full text-slate-900 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.10),transparent_45%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.10),transparent_45%),linear-gradient(to_bottom,white,rgba(248,250,252,1))]">
      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* =======================================================
           HEADER AREA (title + search + filters + new button)
        ======================================================= */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Yasmine's task tracker</div>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search (press /)"
                className="w-full rounded-full pl-9 sm:w-[320px]"
              />
            </div>

            {/* Course filter */}
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-full rounded-full sm:w-[200px]">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                <SelectItem value="all">All courses</SelectItem>
                {COURSES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type filter (legacy) */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full rounded-full sm:w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                <SelectItem value="all">All types</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* New button */}
            <Button onClick={() => setNewOpen(true)} className="rounded-full">
              <Plus className="mr-2 h-4 w-4" />
              New (n)
            </Button>
          </div>
        </div>

        {/* =======================================================
           TOP CONTROLS (Dashboard/List tabs + count)
        ======================================================= */}
        <div className="mt-5 flex items-center justify-between">
          <Tabs value={statusMode} onValueChange={setStatusMode}>
            <TabsList className="rounded-full">
              <TabsTrigger value="board" className="rounded-full">Dashboard</TabsTrigger>
              <TabsTrigger value="list" className="rounded-full">List</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="text-sm text-muted-foreground">
            {filtered.length} task{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* =======================================================
           MAIN VIEW SWITCH (List view vs Dashboard view)
        ======================================================= */}
       {statusMode === "list" ? (
  // -------------------- LIST VIEW: sortable table --------------------
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
            <th key={key as string} className="px-3 py-2 text-left font-medium">
              <button
                type="button"
                className="hover:underline"
                onClick={() => {
                  const k = key as any;
                  if (listSortKey === k) {
                    setListSortDir((d) => (d === "asc" ? "desc" : "asc"));
                  } else {
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
              className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
              onClick={() => openTask(t)}
            >
              <td className="px-3 py-2 max-w-[420px] truncate font-medium">{t.title}</td>
              <td className="px-3 py-2 text-slate-600">{courseLabel(t.courseId)}</td>
              <td className="px-3 py-2 text-slate-600">{statusLabel(t.status)}</td>
              <td className="px-3 py-2 text-slate-600">{priorityLabel(t.priority)}</td>
              <td className="px-3 py-2 text-slate-600 tabular-nums">{t.due ?? "—"}</td>
              <td className={`px-3 py-2 tabular-nums ${days !== null && days <= 2 ? "text-red-600" : "text-slate-600"}`}>
                {days === null ? "—" : timeLeftLabel(days)}
              </td>
              <td className="px-3 py-2 text-slate-600 tabular-nums">
                {t.durationHrs == null ? "—" : `${t.durationHrs}h`}
              </td>
              <td className="px-3 py-2 text-slate-600 tabular-nums">
                {t.difficulty == null ? "—" : t.difficulty}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
) : (

          // -------------------- DASHBOARD VIEW (course columns) --------------------
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {COURSES.map((c) => (
              <Card key={c.id} className="rounded-2xl shadow-sm bg-white border border-slate-200">
                <CardHeader className="pb-3">
                  {/* Column header: course name + counts */}
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm font-semibold">{c.label}</CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {byCourse[c.id]?.length ?? 0} total
                      {byCourse[c.id]?.length ? (
                        <> • {openCount(byCourse[c.id])} open</>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>

                {/* Column body: tasks */}
                <CardContent className="space-y-3">
                  {byCourse[c.id]?.length ? (
                    byCourse[c.id].map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onMove={moveTask}
                        onDelete={deleteTask}
                        onOpen={openTask}
                      />
                    ))
                  ) : (
                    <div
  className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-400 cursor-pointer hover:bg-slate-50"
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
                </CardContent>
              </Card>
            ))}
            </div>


{/* -------------------- RIGHT RAIL: Attention Score -------------------- */}
<Card className="rounded-2xl shadow-sm bg-white border border-slate-200 h-fit lg:sticky lg:top-6">
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-semibold">Attention score</CardTitle>
      <div className="text-xs text-muted-foreground">
        {scoredTasks.length} tasks
      </div>
    </div>

    {/* Toggles */}
    <div className="mt-3 grid grid-cols-3 gap-2">
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
  </CardHeader>

  <CardContent className="space-y-3">
    <div className="text-[11px] text-muted-foreground">
  You've got this
</div>

{/* -------------------- Weekly horizon -------------------- */}
<div className="mt-4 space-y-2">
  <div className="flex items-center justify-between">
    <div className="text-sm font-semibold">Next 7 days</div>
    <div className="text-xs text-muted-foreground">
      Red if &gt; {WEEKLY_CAPACITY_HRS}h
    </div>
  </div>

  <div className="space-y-2">
    {weeklyHorizon.days.map((d) => {
      const h = d.totalHrs;
      const pct = Math.round((h / weeklyHorizon.maxHrs) * 100);
      const over = h > WEEKLY_CAPACITY_HRS;

      return (
        <div key={d.iso} className="grid grid-cols-[72px_1fr_42px] items-center gap-2">
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {d.iso.slice(5)}
          </div>

          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={over ? "h-2 bg-red-500" : "h-2 bg-slate-400"}
              style={{ width: `${pct}%` }}
              title={`${h.toFixed(1)}h • ${d.tasksDueCount} tasks`}
            />
          </div>

          <div className={`text-[11px] tabular-nums text-right ${over ? "text-red-600" : "text-muted-foreground"}`}>
            {h ? h.toFixed(1) : "0.0"}
          </div>
        </div>
      );
    })}
  </div>
</div>



    {/* Scroll list */}
    <div className="max-h-[70vh] overflow-auto pr-1 space-y-2">
      {scoredTasks.map(({ task, total, parts }) => {
        const width = Math.round((total / maxScore) * 100); // 250 is just a rough max
        const days = task.due ? daysLeftFromISO(task.due) : null;

        return (
            <div
                key={task.id}
                className="rounded-xl border border-slate-200 p-2 cursor-pointer hover:bg-slate-50"
                role="button"
                tabIndex={0}
                onClick={() => openTask(task)}
                onKeyDown={(e) => {
                if (e.key === "Enter") openTask(task);
                }}
            >

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-medium leading-snug">
  {task.title}
</div>

                <div className="mt-1 flex flex-wrap gap-2">
                  {task.courseId ? (
                    <span className="text-[11px] text-muted-foreground">
                        {courseLabel(task.courseId)}
                        </span>
                                ) : null}
                                {task.due ? (
                                    <span className={`text-[11px] ${days !== null && days <= 2 ? "text-red-600" : "text-muted-foreground"}`}>
                                    {timeLeftLabel(days as number)}
                                    </span>
                                ) : (
                                    <span className="text-[11px] text-muted-foreground">No due</span>
                                )}
                                {task.priority ? (
                                    <span className="text-[11px] text-muted-foreground">{priorityLabel(task.priority)}</span>
                                ) : null}
                                {task.durationHrs != null ? (
                                    <span className="text-[11px] text-muted-foreground">{task.durationHrs}h</span>
                                ) : null}
                                {task.difficulty != null ? (
                                    <span className="text-[11px] text-muted-foreground">D{task.difficulty}</span>
                                ) : null}
                                </div>
                            </div>

                            <div className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                                {Math.round(total)}
                            </div>
                            </div>

                            {/* Bar */}
                           <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            {!scoreShowBreakdown ? (
                                <div className="h-2 rounded-full bg-slate-400" style={{ width: `${width}%` }} />
                            ) : (
                                <div className="h-2 flex" style={{ width: `${width}%` }}>
                                <div className="h-2 bg-slate-400" style={{ width: `${Math.round((parts.time / (total || 1)) * 100)}%` }} />
                                <div className="h-2 bg-slate-500" style={{ width: `${Math.round((parts.priority / (total || 1)) * 100)}%` }} />
                                <div className="h-2 bg-slate-600" style={{ width: `${Math.round((parts.duration / (total || 1)) * 100)}%` }} />
                                <div className="h-2 bg-slate-700" style={{ width: `${Math.round((parts.difficulty / (total || 1)) * 100)}%` }} />
                                </div>
                            )}
                            </div>


                           {/* Breakdown (tiny) */}
                            {!scoreShowBreakdown ? (
                            <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] text-muted-foreground">
                                <div className={scoreUseTime ? "" : "opacity-40"}>◷ {parts.time}</div>
                                <div className={scoreUsePriority ? "" : "opacity-40"}>‼ {parts.priority}</div>
                                <div className={scoreUseDuration ? "" : "opacity-40"}>⧖ {parts.duration}</div>
                                <div className={scoreUseDifficulty ? "" : "opacity-40"}>++ {parts.difficulty}</div>
                            </div>
                            ) : null}
                      </div>
                     );
                 })}
             </div>
         </CardContent>
    </Card>

</div>
)}



        {/* =======================================================
           NEW TASK DIALOG (create)
        ======================================================= */}
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="w-[95vw] max-w-[520px] bg-white text-slate-900 border border-slate-200">
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>

            <div className="grid gap-3">
              {/* Title */}
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title (brief)"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                    e.preventDefault();
                    submitNewTask();
                    }
                }}
                />




              {/* Row 1: Status + Course */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                      {NEW_STATUSES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <div className="text-xs text-muted-foreground">Course</div>
                  <Select value={newCourseId} onValueChange={setNewCourseId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Course" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                      {COURSES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Priority + Difficulty */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <div className="text-xs text-muted-foreground">Priority</div>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1">
                  <div className="text-xs text-muted-foreground">Difficulty</div>
                  <Select value={newDifficulty} onValueChange={setNewDifficulty}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Difficulty (1–5)" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900 border border-slate-200 shadow-lg">
                      {["1", "2", "3", "4", "5"].map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Due date + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <div className="text-xs text-muted-foreground">Due date</div>
                  <Input
                    type="date"
                    value={newDue}
                    onChange={(e) => setNewDue(e.target.value)}
                    className="rounded-xl"
                  />

                  {/* time-left helper label under due date */}
                  <div className="text-[11px] text-muted-foreground">
                    {newDue && daysLeftFromISO(newDue) !== null
                      ? `Time left: ${timeLeftLabel(daysLeftFromISO(newDue) as number)}`
                      : ""}
                  </div>
                </div>

                <div className="grid gap-1">
                  <div className="text-xs text-muted-foreground">Duration (hours)</div>
                  <Input
                    inputMode="decimal"
                    placeholder="e.g. 1.5"
                    value={newDurationHrs}
                    onChange={(e) => setNewDurationHrs(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Comments */}
              <div className="grid gap-1">
                <div className="text-xs text-muted-foreground">Comments</div>
                <textarea
                  className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  value={newComments}
                  onChange={(e) => setNewComments(e.target.value)}
                  placeholder="Any extra context"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
  className="rounded-full"
  onClick={submitNewTask}
>
  Create
</Button>

            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =======================================================
           EDIT TASK DIALOG (edit existing task)
        ======================================================= */}
        <TaskDialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setActiveTask(null);
          }}
          task={activeTask}
          onSave={saveTask}
        />

        {/* =======================================================
           FOOTER: keyboard reminder box
        ======================================================= */}
        <div className="mt-10 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">Keyboard</div>
          <div className="mt-1">
            Press <span className="rounded border px-1">/</span> to search,{" "}
            <span className="rounded border px-1">n</span> to create a task.
          </div>
        </div>

      </div>
    </div>
  );
}
