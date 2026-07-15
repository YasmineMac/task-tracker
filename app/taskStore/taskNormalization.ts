import type { Priority, Status, Task } from "./taskTypes";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const defaultCourseId = isDemoMode ? "studio_work" : "robotics_studio";
const practiceCourseId = isDemoMode ? "practice" : "the_yas_project";

export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function normalizeTask(t: Record<string, unknown>): Task {
  const rawCourseId = String(t.courseId ?? t.course ?? defaultCourseId);
  const resolvedCourseId =
    rawCourseId === "fab_ar"
      ? "computational_design"
      : !isDemoMode && rawCourseId === "yas_project"
        ? "the_yas_project"
        : rawCourseId;

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
    mode: resolvedCourseId === practiceCourseId ? "practice" : "task",
  };
}
