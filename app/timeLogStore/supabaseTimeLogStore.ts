import { supabase } from "@/lib/supabase";
import type { TimeLog } from "../taskStore/taskTypes";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeTimeValue(value: unknown) {
  return typeof value === "string" && value ? value.slice(0, 5) : undefined;
}

function timeLogFromRow(row: Record<string, unknown>): TimeLog {
  return {
    id: String(row.id ?? ""),
    taskId: String(row.task_id ?? ""),
    date: String(row.date ?? ""),
    startTime: normalizeTimeValue(row.start_time),
    endTime: normalizeTimeValue(row.end_time),
    hours: Number(row.hours ?? 0),
    note: typeof row.note === "string" ? row.note : "",
  };
}

function timeLogPayload(log: TimeLog, syncCode: string) {
  return {
    id: log.id,
    sync_code: syncCode,
    task_id: log.taskId || null,
    date: log.date,
    start_time: log.startTime || null,
    end_time: log.endTime || null,
    hours: log.hours,
    note: log.note ?? "",
  };
}

function isSupabaseCompatibleLogId(id: string) {
  return UUID_PATTERN.test(id);
}

export async function loadTimeLogs(syncCode: string) {
  if (!supabase) {
    console.warn("Skipped time log load: Supabase env vars are missing");
    return { ok: false, logs: [] as TimeLog[] };
  }

  const { data, error } = await supabase
    .from("time_logs")
    .select("id,task_id,date,start_time,end_time,hours,note")
    .eq("sync_code", syncCode)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to load time logs from Supabase:", error);
    return { ok: false, logs: [] as TimeLog[] };
  }

  return {
    ok: true,
    logs: (data || [])
      .map((row: Record<string, unknown>) => timeLogFromRow(row))
      .filter((log) => log.id && log.date && Number.isFinite(log.hours) && log.hours > 0),
  };
}

export async function saveTimeLog(syncCode: string, log: TimeLog) {
  if (!supabase) {
    console.warn("Skipped time log save: Supabase env vars are missing");
    return false;
  }

  if (!isSupabaseCompatibleLogId(log.id)) {
    console.warn("Skipped time log save: id is not a Supabase-compatible UUID", { id: log.id });
    return false;
  }

  const { error } = await supabase
    .from("time_logs")
    .upsert(timeLogPayload(log, syncCode), { onConflict: "id" });

  if (error) {
    console.warn("Failed to save time log to Supabase:", {
      operation: "upsert",
      id: log.id,
      error,
    });
    return false;
  }

  return true;
}

export async function deleteTimeLog(syncCode: string, id: string) {
  if (!supabase) {
    console.warn("Skipped time log delete: Supabase env vars are missing");
    return false;
  }

  if (!isSupabaseCompatibleLogId(id)) {
    console.warn("Skipped time log delete: id is not a Supabase-compatible UUID", { id });
    return false;
  }

  const { error } = await supabase
    .from("time_logs")
    .delete()
    .eq("sync_code", syncCode)
    .eq("id", id);

  if (error) {
    console.warn("Failed to delete time log from Supabase:", {
      operation: "delete",
      id,
      error,
    });
    return false;
  }

  return true;
}
