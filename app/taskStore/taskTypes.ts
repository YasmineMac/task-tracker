export type Priority = "low" | "normal" | "high";
export type Status = "to_do" | "in_progress" | "frozen" | "completed";
export type DeadlineMode = "date" | "vision";
export type VisionHorizon = "short" | "mid" | "long";
export type ActivityType = "correspondence" | "activity" | "uni_work";
export type EffortLevel = "quick" | "moderate" | "extensive";

export type Task = {
  id: string;
  title: string;
  courseId: string;
  status: Status;
  priority: Priority;
  due?: string | null;
  deadlineMode?: DeadlineMode;
  visionHorizon?: VisionHorizon | null;
  activityType?: ActivityType;
  effortLevel?: EffortLevel | null;
  notes?: string;
  durationHrs?: number | null;
  difficulty?: number | null;
  completedAt?: string | null;
  createdAt: number;
  mode?: "task" | "practice";
};

export type TimeLog = {
  id: string;
  taskId: string;
  date: string;
  startTime?: string;
  endDate?: string | null;
  endTime?: string;
  hours: number | null;
  note: string;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export function isTimeLogISODate(value: string | null | undefined) {
  if (!value) return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function timeLogTimeToMinutes(value: string | null | undefined) {
  if (!value) return null;
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function effectiveTimeLogEndDate(log: TimeLog) {
  return log.endDate || log.date;
}

export function calculateTimeLogDurationHours(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
) {
  const startMinutes = timeLogTimeToMinutes(startTime);
  const endMinutes = timeLogTimeToMinutes(endTime);
  if (
    !isTimeLogISODate(startDate) ||
    !isTimeLogISODate(endDate) ||
    startMinutes === null ||
    endMinutes === null
  ) {
    return null;
  }

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay, 0, startMinutes);
  const end = Date.UTC(endYear, endMonth - 1, endDay, 0, endMinutes);
  if (end <= start) return null;
  return (end - start) / (60 * 60 * 1000);
}

export function isClosedTimeLog(log: TimeLog) {
  return typeof log.hours === "number" && Number.isFinite(log.hours) && log.hours > 0;
}

export function isOpenTimeLog(log: TimeLog) {
  return (
    Boolean(log.taskId) &&
    isTimeLogISODate(log.date) &&
    timeLogTimeToMinutes(log.startTime) !== null &&
    !log.endTime &&
    log.hours === null
  );
}

export type BackupSnapshot = {
  createdAt: string;
  tasks: Task[];
  timeLogs: TimeLog[];
};

export type TaskLoadResult =
  | { ok: true; tasks: Task[] }
  | { ok: false; tasks: Task[] };

export type TaskSaveOptions = {
  syncCode: string;
  timeLogs: TimeLog[];
  allowEmptyOverwrite?: boolean;
  allowDeleteAll?: boolean;
  deletedTaskIds?: string[];
  onLocalBackup?: (tasks: Task[], timeLogs: TimeLog[]) => void;
};

export type TaskStore = {
  loadTasks(syncCode: string): Promise<TaskLoadResult>;
  saveTasks(tasks: Task[], options: TaskSaveOptions): Promise<boolean>;
};
