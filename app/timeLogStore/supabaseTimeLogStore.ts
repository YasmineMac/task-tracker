import { supabase } from "@/lib/supabase";
import {
  isClosedTimeLog,
  isOpenTimeLog,
  isTimeLogISODate,
  type TimeLog,
} from "../taskStore/taskTypes";
import { normalizeTimeLogPause } from "./timeLogPause";

const LEGACY_COLUMNS = "id,task_id,date,start_time,end_date,end_time,hours,note";
const PAUSE_COLUMNS = `${LEGACY_COLUMNS},paused_at,paused_seconds`;
let pauseColumnsSupported = true;

function missingPauseColumns(error: { code?: string; message?: string } | null) {
  return Boolean(error && ["42703", "PGRST204"].includes(error.code ?? "") && /paused_at|paused_seconds/.test(error.message ?? ""));
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeTimeValue(value: unknown) {
  return typeof value === "string" && value ? value.slice(0, 5) : undefined;
}

function normalizeDateValue(value: unknown) {
  return typeof value === "string" && isTimeLogISODate(value) ? value : null;
}

function normalizeHoursValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : null;
}

function timeLogFromRow(row: Record<string, unknown>): TimeLog {
  return {
    id: String(row.id ?? ""),
    taskId: String(row.task_id ?? ""),
    date: String(row.date ?? ""),
    startTime: normalizeTimeValue(row.start_time),
    endDate: normalizeDateValue(row.end_date),
    endTime: normalizeTimeValue(row.end_time),
    hours: normalizeHoursValue(row.hours),
    note: typeof row.note === "string" ? row.note : "",
    pausedAt: row.paused_at == null ? null : String(row.paused_at),
    pausedSeconds: row.paused_seconds == null ? 0 : Number(row.paused_seconds),
  };
}

function timeLogPayload(log: TimeLog, syncCode: string) {
  return {
    id: log.id,
    sync_code: syncCode,
    task_id: log.taskId || null,
    date: log.date,
    start_time: log.startTime || null,
    end_date: log.endDate || null,
    end_time: log.endTime || null,
    hours: log.hours,
    note: log.note ?? "",
    ...(pauseColumnsSupported ? { paused_at: log.pausedAt ?? null, paused_seconds: log.pausedSeconds ?? 0 } : {}),
  };
}

function isSupabaseCompatibleLogId(id: string) {
  return UUID_PATTERN.test(id);
}

export async function loadTimeLogs(syncCode: string) {
  if (!supabase) {
    console.warn("Skipped time log load: Supabase env vars are missing");
    return { ok: false, logs: [] as TimeLog[], pauseSupported: false };
  }

  let { data, error } = await supabase
    .from("time_logs")
    .select(PAUSE_COLUMNS)
    .eq("sync_code", syncCode)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Record<string, unknown>[]>();

  pauseColumnsSupported = !missingPauseColumns(error);
  if (!pauseColumnsSupported) {
    const fallback = await supabase.from("time_logs").select(LEGACY_COLUMNS).eq("sync_code", syncCode)
      .order("date", { ascending: false }).order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.warn("Failed to load time logs from Supabase:", error);
    return { ok: false, logs: [] as TimeLog[], pauseSupported: false };
  }

  return {
    ok: true,
    pauseSupported: pauseColumnsSupported,
    logs: (data || [])
      .map((row: Record<string, unknown>) => timeLogFromRow(row))
      .filter((log) => log.id && normalizeTimeLogPause(log) && (!log.pausedAt || isOpenTimeLog(log)) && (isClosedTimeLog(log) || isOpenTimeLog(log))),
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

  if (!normalizeTimeLogPause(log) || (!pauseColumnsSupported && (log.pausedAt || log.pausedSeconds))) return false;

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

export type TimeLogWriteResult =
  | { ok: true; log: TimeLog }
  | { ok: false; reason: "conflict" | "error" | "unavailable" };

function sameTimeLog(left: TimeLog, right: TimeLog) {
  const canonical = (log: TimeLog) => JSON.stringify({ ...timeLogPayload(log, ""),
    paused_at: log.pausedAt ? new Date(log.pausedAt).toISOString() : null, paused_seconds: log.pausedSeconds ?? 0 });
  return canonical(left) === canonical(right);
}

async function mutateTimeLogIfUnchanged(syncCode: string, expected: TimeLog, next?: TimeLog): Promise<TimeLogWriteResult> {
  if (!supabase || !isSupabaseCompatibleLogId(expected.id) || (next && next.id !== expected.id) ||
    !normalizeTimeLogPause(expected) || (next && !normalizeTimeLogPause(next))) return { ok: false, reason: "error" };
  try {
    let columns = PAUSE_COLUMNS;
    let snapshot = await supabase.from("time_logs").select(columns).eq("sync_code", syncCode).eq("id", expected.id).maybeSingle<Record<string, unknown>>();
    if (missingPauseColumns(snapshot.error)) {
      pauseColumnsSupported = false;
      if (expected.pausedAt || expected.pausedSeconds || next?.pausedAt || next?.pausedSeconds) return { ok: false, reason: "unavailable" };
      columns = LEGACY_COLUMNS;
      snapshot = await supabase.from("time_logs").select(columns).eq("sync_code", syncCode).eq("id", expected.id).maybeSingle<Record<string, unknown>>();
    } else if (!snapshot.error) pauseColumnsSupported = true;
    if (snapshot.error) return { ok: false, reason: "error" };
    if (!snapshot.data || !sameTimeLog(expected, timeLogFromRow(snapshot.data))) return { ok: false, reason: "conflict" };
    // Compare raw stored values in the UPDATE/DELETE itself, not just in the preceding read.
    let query = next ? supabase.from("time_logs").update(timeLogPayload(next, syncCode)) : supabase.from("time_logs").delete();
    query = query.eq("sync_code", syncCode).eq("id", expected.id);
    for (const column of columns.split(",").filter((column) => column !== "id")) {
      const value = snapshot.data[column];
      query = value == null ? query.is(column, null) : query.eq(column, value);
    }
    const result = await query.select(columns).maybeSingle<Record<string, unknown>>();
    if (result.error) return { ok: false, reason: "error" };
    if (!result.data) return { ok: false, reason: "conflict" };
    return { ok: true, log: timeLogFromRow(result.data) };
  } catch { return { ok: false, reason: "error" }; }
}

export function updateTimeLogIfUnchanged(syncCode: string, expected: TimeLog, next: TimeLog) {
  return mutateTimeLogIfUnchanged(syncCode, expected, next);
}

export function deleteTimeLogIfUnchanged(syncCode: string, expected: TimeLog) {
  return mutateTimeLogIfUnchanged(syncCode, expected);
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
