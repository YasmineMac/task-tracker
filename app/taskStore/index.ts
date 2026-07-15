import type { TaskStore } from "./taskTypes";

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function getTaskStore(): Promise<TaskStore> {
  if (isDemoMode) {
    const { demoTaskStore } = await import("./demoTaskStore");
    return demoTaskStore;
  }

  const { supabaseTaskStore } = await import("./supabaseTaskStore");
  return supabaseTaskStore;
}
