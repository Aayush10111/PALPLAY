"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isMockMode } from "@/lib/env";
import { MOCK_TASKS, MOCK_USERS } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigned_to?: string | null;
  status: "todo" | "in_progress" | "done";
  due_at: string | null;
  completed_at: string | null;
};

const statusCycle: Record<TaskRow["status"], TaskRow["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "done",
};

export default function WorkerTasksPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [mockTasks, setMockTasks] = useState<TaskRow[]>(MOCK_TASKS as TaskRow[]);

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      if (isMockMode()) {
        const userId = MOCK_USERS.workers[0].id;
        setTasks(mockTasks.filter((task) => task.assigned_to === userId));
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks((data ?? []) as TaskRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [mockTasks]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const moveTaskForward = async (task: TaskRow) => {
    try {
      const nextStatus = statusCycle[task.status];
      const completedAt = nextStatus === "done" ? new Date().toISOString() : null;
      if (isMockMode()) {
        setMockTasks((prev) =>
          prev.map((item) =>
            item.id === task.id ? { ...item, status: nextStatus, completed_at: completedAt } : item,
          ),
        );
        toast.success("Task updated (mock).");
        await loadTasks();
        return;
      }

      const supabase = createClient();

      const { error } = await supabase
        .from("tasks")
        .update({
          status: nextStatus,
          completed_at: completedAt,
        })
        .eq("id", task.id);

      if (error) throw error;
      toast.success("Task updated.");
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task update failed.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">Move assigned tasks from todo to done as you complete work.</p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Assigned Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned tasks.</p>
          ) : (
            tasks.map((task) => (
              <div className="space-y-2 rounded-md border bg-card p-3" key={task.id}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{task.title}</h3>
                  <Badge>{task.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{task.description ?? "No description."}</p>
                <div className="text-xs text-muted-foreground">
                  <p>Due: {task.due_at ? format(new Date(task.due_at), "PPpp") : "Not set"}</p>
                  <p>Completed: {task.completed_at ? format(new Date(task.completed_at), "PPpp") : "Not completed"}</p>
                </div>
                <Button
                  disabled={task.status === "done"}
                  onClick={() => moveTaskForward(task)}
                  size="sm"
                  variant="outline"
                >
                  {task.status === "todo" ? "Start Task" : task.status === "in_progress" ? "Mark Done" : "Completed"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

