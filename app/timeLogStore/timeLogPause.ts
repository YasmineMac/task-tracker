import { calculateTimeLogDurationHours, isOpenTimeLog, type TimeLog } from "../taskStore/taskTypes";

export function normalizeTimeLogPause(value: { pausedAt?: unknown; pausedSeconds?: unknown }) {
  const pausedAt = value.pausedAt == null ? null : value.pausedAt;
  if (value.pausedSeconds != null && typeof value.pausedSeconds !== "number" &&
    (typeof value.pausedSeconds !== "string" || !value.pausedSeconds.trim())) return null;
  const pausedSeconds = value.pausedSeconds == null ? 0 : Number(value.pausedSeconds);
  if (!Number.isFinite(pausedSeconds) || pausedSeconds < 0 ||
    (pausedAt !== null && (typeof pausedAt !== "string" || !Number.isFinite(Date.parse(pausedAt))))) return null;
  return { pausedAt: pausedAt === null ? null : new Date(String(pausedAt)).toISOString(), pausedSeconds };
}

export function isPausedTimeLog(log: TimeLog) {
  return isOpenTimeLog(log) && Boolean(log.pausedAt);
}

function localDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  return Number.isFinite(value.getTime()) ? value.getTime() : NaN;
}

export function calculateTimeLogWorkingDuration(log: TimeLog, endDate: string, endTime: string) {
  const gross = calculateTimeLogDurationHours(log.date, log.startTime ?? "", endDate, endTime);
  const pause = normalizeTimeLogPause(log);
  if (gross === null || !pause) return null;
  if (!pause.pausedAt && !pause.pausedSeconds) return { hours: gross, pausedSeconds: 0 };
  const start = localDateTime(log.date, log.startTime ?? "");
  const end = localDateTime(endDate, endTime);
  const pausedAt = pause.pausedAt ? Date.parse(pause.pausedAt) : null;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
    (pausedAt !== null && (pausedAt < start || pausedAt > end))) return null;
  const pausedSeconds = pause.pausedSeconds + (pausedAt === null ? 0 : (end - pausedAt) / 1000);
  const hours = ((end - start) / 1000 - pausedSeconds) / 3600;
  return Number.isFinite(hours) && hours > 0 ? { hours, pausedSeconds } : null;
}

export function toggleTimeLogPause(log: TimeLog, now: Date): TimeLog | null {
  const pause = normalizeTimeLogPause(log);
  if (!isOpenTimeLog(log) || !pause || !Number.isFinite(now.getTime())) return null;
  // Logger's start/end inputs have minute precision; pause actions use the same resolution.
  const timestamp = new Date(now);
  timestamp.setSeconds(0, 0);
  const start = localDateTime(log.date, log.startTime ?? "");
  if (!Number.isFinite(start) || timestamp.getTime() < start) return null;
  if (!pause.pausedAt) return { ...log, ...pause, pausedAt: timestamp.toISOString() };
  const elapsed = (timestamp.getTime() - Date.parse(pause.pausedAt)) / 1000;
  if (elapsed < 0) return null;
  return { ...log, pausedAt: null, pausedSeconds: pause.pausedSeconds + elapsed };
}
