"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WorkerOption {
  id: string;
  label: string;
}

interface FiltersBarProps {
  from: string;
  to: string;
  workerId: string;
  game: string;
  paymentTag: string;
  workers: WorkerOption[];
  games: string[];
  paymentTags: string[];
  isLoading?: boolean;
  onChange: (next: {
    from?: string;
    to?: string;
    workerId?: string;
    game?: string;
    paymentTag?: string;
  }) => void;
  onPreset: (preset: "today" | "7d" | "30d") => void;
}

export function FiltersBar({
  from,
  to,
  workerId,
  game,
  paymentTag,
  workers,
  games,
  paymentTags,
  isLoading,
  onChange,
  onPreset,
}: Readonly<FiltersBarProps>) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <Button disabled={isLoading} onClick={() => onPreset("today")} size="sm" variant="outline">
          Today
        </Button>
        <Button disabled={isLoading} onClick={() => onPreset("7d")} size="sm" variant="outline">
          Last 7 Days
        </Button>
        <Button disabled={isLoading} onClick={() => onPreset("30d")} size="sm" variant="outline">
          Last 30 Days
        </Button>
      </div>

      <div className="grid gap-2 lg:grid-cols-5">
        <Input type="date" value={from} onChange={(event) => onChange({ from: event.target.value })} />
        <Input type="date" value={to} onChange={(event) => onChange({ to: event.target.value })} />

        <Select onValueChange={(value) => onChange({ workerId: value })} value={workerId}>
          <SelectTrigger>
            <SelectValue placeholder="All workers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workers</SelectItem>
            {workers.map((worker) => (
              <SelectItem key={worker.id} value={worker.id}>
                {worker.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(value) => onChange({ game: value })} value={game}>
          <SelectTrigger>
            <SelectValue placeholder="All games" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            {games.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(value) => onChange({ paymentTag: value })} value={paymentTag}>
          <SelectTrigger>
            <SelectValue placeholder="All payment tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment accounts</SelectItem>
            {paymentTags.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
