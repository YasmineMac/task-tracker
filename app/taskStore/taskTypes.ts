export type Priority = "low" | "normal" | "high";
export type Status = "to_do" | "in_progress" | "urgent" | "frozen" | "completed";

export type Task = {
  id: string;
  title: string;
  courseId: string;
  status: Status;
  priority: Priority;
  due?: string;
  notes?: string;
  durationHrs?: number | null;
  difficulty?: number | null;
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
  onLocalBackup?: (tasks: Task[], timeLogs: TimeLog[]) => void;
};

export type TaskStore = {
  loadTasks(syncCode: string): Promise<TaskLoadResult>;
  saveTasks(tasks: Task[], options: TaskSaveOptions): Promise<boolean>;
};
