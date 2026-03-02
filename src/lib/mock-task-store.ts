import { MOCK_TASKS } from "@/lib/mock-data";

const STORAGE_KEY = "palpay_mock_tasks";

type TaskStatus = "todo" | "in_progress" | "done";

export type MockTaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_by: string;
};

export function getStoredMockTasks(): MockTaskRow[] {
  if (typeof window === "undefined") return MOCK_TASKS as MockTaskRow[];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return MOCK_TASKS as MockTaskRow[];
  try {
    const parsed = JSON.parse(raw) as MockTaskRow[];
    return Array.isArray(parsed) ? parsed : (MOCK_TASKS as MockTaskRow[]);
  } catch {
    return MOCK_TASKS as MockTaskRow[];
  }
}

export function setStoredMockTasks(rows: MockTaskRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}
