import type { ActivityType, DeadlineMode, EffortLevel, Priority, Status, Task, VisionHorizon } from "./taskTypes";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const defaultCourseId = isDemoMode ? "studio_work" : "robotics_studio";
const practiceCourseId = isDemoMode ? "practice" : "the_yas_project";

export function uid() {
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

export function normalizeTask(t: Record<string, unknown>): Task {
  const rawCourseId = String(t.courseId ?? t.course ?? defaultCourseId);
  const resolvedCourseId =
    rawCourseId === "fab_ar"
      ? "computational_design"
      : !isDemoMode && rawCourseId === "yas_project"
        ? "the_yas_project"
        : rawCourseId;
  const due = typeof t.due === "string" && t.due ? t.due : null;
  const rawDeadlineMode = t.deadlineMode === "vision" || t.deadlineMode === "date"
    ? (t.deadlineMode as DeadlineMode)
    : undefined;
  const rawVisionHorizon =
    t.visionHorizon === "short" || t.visionHorizon === "mid" || t.visionHorizon === "long"
      ? (t.visionHorizon as VisionHorizon)
      : null;
  const deadlineMode = due ? "date" : rawDeadlineMode === "vision" && rawVisionHorizon ? "vision" : undefined;
  const activityType =
    t.activityType === "correspondence" || t.activityType === "activity" || t.activityType === "uni_work"
      ? (t.activityType as ActivityType)
      : undefined;
  const effortLevel =
    t.effortLevel === "quick" || t.effortLevel === "moderate" || t.effortLevel === "extensive"
      ? (t.effortLevel as EffortLevel)
      : null;
  const completedAt = typeof t.completedAt === "string" && t.completedAt ? t.completedAt : null;

  return {
    id: String(t.id ?? uid()),
    title: String(t.title ?? "").trim(),
    courseId: resolvedCourseId,
    status: (t.status ?? "to_do") as Status,
    priority: (t.priority ?? "normal") as Priority,
    due: deadlineMode === "date" ? due : deadlineMode === "vision" ? null : undefined,
    deadlineMode,
    visionHorizon: deadlineMode === "vision" ? rawVisionHorizon : null,
    activityType,
    effortLevel,
    notes:
      typeof t.notes === "string"
        ? t.notes
        : typeof t.comments === "string"
          ? t.comments
          : undefined,
    durationHrs: t.durationHrs == null ? null : Number(t.durationHrs),
    difficulty: t.difficulty == null ? null : Number(t.difficulty),
    completedAt,
    createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    mode: resolvedCourseId === practiceCourseId ? "practice" : "task",
  };
}
