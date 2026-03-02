"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isMockMode } from "@/lib/env";
import { getMockProfiles } from "@/lib/mock-data";
import { getStoredMockTasks, setStoredMockTasks, type MockTaskRow } from "@/lib/mock-task-store";
import { createClient } from "@/lib/supabase/client";

type TaskStatus = "todo" | "in_progress" | "done";

type TaskRow = MockTaskRow;

type WorkerRow = {
  id: string;
  full_name: string;
  role: "admin" | "worker";
};

export default function AdminTasksPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_at: "",
    status: "todo" as TaskStatus,
  });

  const workerMap = useMemo(
    () => Object.fromEntries(workers.map((worker) => [worker.id, worker.full_name])),
    [workers],
  );

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (isMockMode()) {
        const profiles = getMockProfiles().filter((profile) => profile.role === "worker");
        setTasks(getStoredMockTasks());
        setWorkers(profiles as WorkerRow[]);
        return;
      }

      const supabase = createClient();
      const [tasksRes, workersRes] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,role").eq("role", "worker").eq("is_active", true),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (workersRes.error) throw workersRes.error;

      setTasks((tasksRes.data ?? []) as TaskRow[]);
      setWorkers((workersRes.data ?? []) as WorkerRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tasks.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const createTask = async () => {
    try {
      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.assigned_to) throw new Error("Assigned worker is required.");

      if (isMockMode()) {
        const newTask: TaskRow = {
          id: `task-${Date.now()}`,
          title: form.title.trim(),
          description: form.description.trim() || null,
          assigned_to: form.assigned_to,
          status: form.status,
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          completed_at: form.status === "done" ? new Date().toISOString() : null,
          created_by: "mock-admin",
        };

        const next = [newTask, ...getStoredMockTasks()];
        setStoredMockTasks(next);
        setTasks(next);
        toast.success("Task created.");
      } else {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Not authenticated.");

        const { error } = await supabase.from("tasks").insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          assigned_to: form.assigned_to,
          status: form.status,
          due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
          completed_at: form.status === "done" ? new Date().toISOString() : null,
          created_by: user.id,
        });

        if (error) throw error;

        toast.success("Task created.");
        await loadData();
      }

      setForm({
        title: "",
        description: "",
        assigned_to: "",
        due_at: "",
        status: "todo",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task.");
    }
  };

  const updateTaskStatus = async (task: TaskRow, status: TaskStatus) => {
    try {
      if (isMockMode()) {
        const next = getStoredMockTasks().map((item) =>
          item.id === task.id
            ? { ...item, status, completed_at: status === "done" ? new Date().toISOString() : null }
            : item,
        );
        setStoredMockTasks(next);
        setTasks(next);
        toast.success("Task updated.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update({
          status,
          completed_at: status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", task.id);

      if (error) throw error;
      toast.success("Task updated.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task.");
    }
  };

  const grouped = {
    todo: tasks.filter((task) => task.status === "todo"),
    in_progress: tasks.filter((task) => task.status === "in_progress"),
    done: tasks.filter((task) => task.status === "done"),
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Task Management</h1>
        <p className="text-sm text-muted-foreground">Create, assign, and track worker tasks by status.</p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Create Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Task title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <Textarea
            placeholder="Task description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />

          <div className="grid gap-2 md:grid-cols-3">
            <Select value={form.assigned_to} onValueChange={(value) => setForm((prev) => ({ ...prev, assigned_to: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Assign worker" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="datetime-local"
              value={form.due_at}
              onChange={(event) => setForm((prev) => ({ ...prev, due_at: event.target.value }))}
            />

            <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as TaskStatus }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">todo</SelectItem>
                <SelectItem value="in_progress">in_progress</SelectItem>
                <SelectItem value="done">done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={createTask}>Create Task</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {(["todo", "in_progress", "done"] as const).map((statusKey) => (
          <Card key={statusKey}>
            <CardHeader>
              <CardTitle>{statusKey}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : grouped[statusKey].length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks.</p>
              ) : (
                grouped[statusKey].map((task) => (
                  <div className="space-y-2 rounded-md border bg-card p-3" key={task.id}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{task.title}</p>
                      <Badge>{task.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{task.description ?? "No description."}</p>
                    <p className="text-xs text-muted-foreground">
                      Assigned: {task.assigned_to ? workerMap[task.assigned_to] ?? task.assigned_to : "Unassigned"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due: {task.due_at ? format(new Date(task.due_at), "PPpp") : "Not set"}
                    </p>
                    <div className="flex gap-1">
                      <Button onClick={() => updateTaskStatus(task, "todo")} size="sm" variant="outline">
                        todo
                      </Button>
                      <Button onClick={() => updateTaskStatus(task, "in_progress")} size="sm" variant="outline">
                        in_progress
                      </Button>
                      <Button onClick={() => updateTaskStatus(task, "done")} size="sm" variant="outline">
                        done
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
