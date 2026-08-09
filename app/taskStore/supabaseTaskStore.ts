import { supabase } from "@/lib/supabase";
import { normalizeTask } from "./taskNormalization";
import type { BackupSnapshot, TaskStore } from "./taskTypes";

function taskFromSupabaseRow(t: Record<string, unknown>) {
  return normalizeTask({
    id: t.id,
    title: t.title,
    courseId: t.course_id,
    status: t.status,
    priority: t.priority,
    due: t.due,
    deadlineMode: t.deadline_mode,
    visionHorizon: t.vision_horizon,
    activityType: t.activity_type,
    notes: t.notes,
    durationHrs: t.duration_hrs,
    difficulty: t.difficulty,
    createdAt:
      typeof t.created_at === "string" || typeof t.created_at === "number"
        ? new Date(t.created_at).getTime()
        : Date.now(),
  });
}

async function createSupabaseBackup(syncCode: string, snapshot: BackupSnapshot) {
  if (!supabase) {
    console.warn("Skipping Supabase backup: Supabase env vars are missing");
    return false;
  }

  const { error } = await supabase.from("task_backups").insert({
    sync_code: syncCode,
    backup_json: snapshot,
  });

  if (error) {
    console.warn("Supabase backup insert failed. Destructive task write was cancelled:", error);
    return false;
  }

  return true;
}

export const supabaseTaskStore: TaskStore = {
  async loadTasks(syncCode) {
    if (!supabase) {
      console.warn("Failed to load tasks: Supabase env vars are missing");
      return { ok: false, tasks: [] };
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("sync_code", syncCode)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Failed to load tasks from Supabase:", error);
      return { ok: false, tasks: [] };
    }

    const tasks = (data || []).map((t: Record<string, unknown>) => taskFromSupabaseRow(t));

    if (tasks.length === 0) {
      console.warn("Supabase load returned 0 tasks. Automatic destructive sync is disabled for this session.");
    }

    return { ok: true, tasks };
  },

  async saveTasks(tasks, options) {
    if (!supabase) {
      console.warn("Skipped task save: Supabase env vars are missing");
      return false;
    }

    if (tasks.length === 0 && !options.allowEmptyOverwrite) {
      console.warn("Skipped task save because tasks array is empty. Existing Supabase tasks were not touched.");
      return false;
    }

    const { data: existingData, error: backupReadError } = await supabase
      .from("tasks")
      .select("*")
      .eq("sync_code", options.syncCode);

    if (backupReadError) {
      console.warn("Failed to read current Supabase tasks for backup. Destructive task write was cancelled:", backupReadError);
      return false;
    }

    const remoteTasks = (existingData || []).map((row: Record<string, unknown>) => taskFromSupabaseRow(row));
    const backupTasks = remoteTasks.length ? remoteTasks : tasks;
    options.onLocalBackup?.(backupTasks, options.timeLogs);

    const snapshot: BackupSnapshot = {
      createdAt: new Date().toISOString(),
      tasks: backupTasks,
      timeLogs: options.timeLogs,
    };

    const backupOk = await createSupabaseBackup(options.syncCode, snapshot);
    if (!backupOk) return false;

    const tasksToUpsert = tasks.map((t) => ({
      id: t.id,
      sync_code: options.syncCode,
      title: t.title,
      course_id: t.courseId,
      status: t.status,
      priority: t.priority,
      due: t.due ?? null,
      deadline_mode: t.deadlineMode ?? null,
      vision_horizon: t.visionHorizon ?? null,
      activity_type: t.activityType ?? null,
      notes: t.notes ?? null,
      duration_hrs: t.durationHrs ?? null,
      difficulty: t.difficulty ?? null,
    }));

    const deletedTaskIds = Array.from(new Set(options.deletedTaskIds ?? [])).filter(Boolean);

    if (tasksToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("tasks")
        .upsert(tasksToUpsert, { onConflict: "id" });

      if (upsertError) {
        console.warn(
          "Error saving tasks:",
          upsertError.message,
          upsertError.details,
          upsertError.hint
        );
        return false;
      }
    } else {
      console.warn("Skipped task upsert because task list is empty. Existing Supabase tasks were not touched.");
    }

    if (deletedTaskIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("sync_code", options.syncCode)
        .in("id", deletedTaskIds);

      if (deleteError) {
        console.warn(
          "Error deleting explicitly removed tasks:",
          deleteError.message,
          deleteError.details,
          deleteError.hint
        );
        return false;
      }
    }

    return true;
  },
};
