import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center p-4 sm:p-6 md:p-10">
      <Card className="w-full border-2 shadow-sm">
        <CardHeader className="space-y-4">
          <p className="w-fit rounded-full border border-orange-500/40 bg-orange-200/50 px-3 py-1 text-xs font-medium text-orange-800">
            PAL PAY HUSTEL
          </p>
          <CardTitle className="text-3xl leading-tight md:text-4xl">
            Daily report, worker operations, and admin analytics in one place.
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm md:text-base">
            Workers can clock shifts, add income/cashout entries, view personal reports, and complete tasks.
            Admin can monitor global KPIs, leaderboards, trends, and export data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/login">Open Login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}


