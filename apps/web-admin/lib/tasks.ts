import "server-only";

// In-memory task tracking for the personal Playbook — turns the 1:1 list into a
// staff workflow (assign → contacted → won/lost) with recovered-revenue logging.
// Keyed by the (stable) personal-play slot id. Swap for a DB table in production.

export type TaskStatus = "pending" | "contacted" | "won" | "lost";
export interface TaskState { status: TaskStatus; recovered: number; }

function store(): Map<string, TaskState> {
  const g = globalThis as unknown as { __mstTasks?: Map<string, TaskState> };
  if (!g.__mstTasks) g.__mstTasks = new Map();
  return g.__mstTasks;
}

export function getTask(id: string): TaskState {
  return store().get(id) ?? { status: "pending", recovered: 0 };
}

export function setTask(id: string, status: TaskStatus, recovered = 0): TaskState {
  const t: TaskState = { status, recovered: status === "won" ? Math.max(0, recovered) : 0 };
  store().set(id, t);
  return t;
}
