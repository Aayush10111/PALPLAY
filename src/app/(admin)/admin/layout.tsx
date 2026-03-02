import { AppShellNav } from "@/components/shared/app-shell-nav";
import { LogoutButton } from "@/components/shared/logout-button";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("admin");

  return (
    <div className="min-h-screen">
      <AppShellNav
        links={[
          { href: "/admin/dashboard", label: "Dashboard" },
          { href: "/admin/transactions", label: "Transactions" },
          { href: "/admin/leaderboards", label: "Leaderboards" },
          { href: "/admin/workers", label: "Workers Report" },
          { href: "/admin/tasks", label: "Tasks" },
        ]}
        rightSlot={<LogoutButton />}
        subtitle="Analytics, monthly transactions, leaderboards, worker reports, and tasks."
        title="PAL PAY HUSTEL Admin Analytics"
        tone="admin"
      />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">{children}</main>
    </div>
  );
}

