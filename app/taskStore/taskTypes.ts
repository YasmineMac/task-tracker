export type Priority = "low" | "normal" | "high";
export type Status = "to_do" | "in_progress" | "urgent" | "frozen" | "completed";
export type DeadlineMode = "date" | "vision";
export type VisionHorizon = "short" | "mid" | "long";
export type ActivityType = "correspondence" | "activity" | "uni_work";

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
  endTime?: string;
  hours: number;
  note: string;
};

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
