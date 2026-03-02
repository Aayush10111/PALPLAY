"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isMockMode } from "@/lib/env";
import { MOCK_SHIFTS, MOCK_USERS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getActiveShift, getHoursForLastDays, getRecentShifts } from "@/lib/queries/shifts";

type ShiftRow = {
  id: string;
  user_id?: string;
  clock_in_at: string;
  clock_out_at: string | null;
};

export default function WorkerShiftsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null);
  const [recentShifts, setRecentShifts] = useState<ShiftRow[]>([]);
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [mockShifts, setMockShifts] = useState<ShiftRow[]>(MOCK_SHIFTS as ShiftRow[]);

  const statusText = useMemo(() => (activeShift ? "Clocked In" : "Clocked Out"), [activeShift]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (isMockMode()) {
        const workerId = MOCK_USERS.workers[0].id;
        const rows = mockShifts.filter((s) => s.user_id === workerId);
        const active = rows.find((s) => !s.clock_out_at) ?? null;
        const hours = rows.reduce((sum, s) => {
          if (!s.clock_out_at) return sum;
          return sum + (new Date(s.clock_out_at).getTime() - new Date(s.clock_in_at).getTime()) / 3600000;
        }, 0);
        setActiveShift(active);
        setRecentShifts(rows.slice(0, 20));
        setTodayHours(hours);
        setWeekHours(hours);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated.");

      const [active, recent, today, week] = await Promise.all([
        getActiveShift(supabase, user.id),
        getRecentShifts(supabase, user.id),
        getHoursForLastDays(supabase, user.id, 1),
        getHoursForLastDays(supabase, user.id, 7),
      ]);

      setActiveShift(active);
      setRecentShifts(recent as ShiftRow[]);
      setTodayHours(today);
      setWeekHours(week);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load shifts.");
    } finally {
      setIsLoading(false);
    }
  }, [mockShifts]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleClockIn = async () => {
    try {
      setIsSaving(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated.");
      if (isMockMode()) {
        const workerId = MOCK_USERS.workers[0].id;
        if (activeShift) throw new Error("You already have an active shift.");
        setMockShifts((prev) => [
          { id: `sh-${Date.now()}`, user_id: workerId, clock_in_at: new Date().toISOString(), clock_out_at: null } as ShiftRow,
          ...prev,
        ]);
        toast.success("Clocked in (mock).");
        await loadData();
        return;
      }
      if (activeShift) throw new Error("You already have an active shift.");

      const { error } = await supabase.from("shifts").insert({
        user_id: user.id,
        clock_in_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast.success("Clocked in.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clock in failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setIsSaving(true);
      if (!activeShift) throw new Error("No active shift found.");
      if (isMockMode()) {
        setMockShifts((prev) =>
          prev.map((s) => (s.id === activeShift.id ? { ...s, clock_out_at: new Date().toISOString() } : s)),
        );
        toast.success("Clocked out (mock).");
        await loadData();
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("shifts")
        .update({ clock_out_at: new Date().toISOString() })
        .eq("id", activeShift.id);

      if (error) throw error;
      toast.success("Clocked out.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clock out failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          Track your working time with one active shift at a time.
        </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Current Shift Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Status: {statusText}</p>
          <div className="flex gap-2">
            <Button disabled={isSaving || !!activeShift || isLoading} onClick={handleClockIn}>
              Clock In
            </Button>
            <Button
              disabled={isSaving || !activeShift || isLoading}
              onClick={handleClockOut}
              variant="secondary"
            >
              Clock Out
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <p className="text-sm">Today Hours: {todayHours.toFixed(2)}</p>
            <p className="text-sm">Last 7 Days Hours: {weekHours.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Shifts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts found.</p>
          ) : (
            <div className="space-y-2">
              {recentShifts.map((shift) => (
                <div className="rounded-md border bg-card px-3 py-2 text-sm" key={shift.id}>
                  <p className="font-medium">In: {format(new Date(shift.clock_in_at), "PPpp")}</p>
                  <p className="text-muted-foreground">
                    Out: {shift.clock_out_at ? format(new Date(shift.clock_out_at), "PPpp") : "Active"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

