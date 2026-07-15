import { demoTasks } from "./demoData";
import { normalizeTask } from "./taskNormalization";
import type { Task, TaskStore } from "./taskTypes";

const DEMO_TASKS_STORAGE_KEY = "task_tracker_demo_tasks_v1";

function cloneTasks(tasks: Task[]) {
  return tasks.map((task) => ({ ...task }));
}

function loadLocalDemoTasks() {
  if (typeof window === "undefined") return cloneTasks(demoTasks);

  const saved = localStorage.getItem(DEMO_TASKS_STORAGE_KEY);
  if (!saved) return cloneTasks(demoTasks);

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return cloneTasks(demoTasks);
    return parsed.map((task) => normalizeTask(task));
  } catch (error) {
    console.warn("Failed to load demo tasks from localStorage:", error);
    return cloneTasks(demoTasks);
  }
}

export const demoTaskStore: TaskStore = {
  async loadTasks() {
    return { ok: true, tasks: loadLocalDemoTasks() };
  },

  async saveTasks(tasks) {
    if (typeof window === "undefined") return true;
    localStorage.setItem(DEMO_TASKS_STORAGE_KEY, JSON.stringify(tasks));
    return true;
  },
};
