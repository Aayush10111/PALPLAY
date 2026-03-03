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
    <AppShellNav
      links={[
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/transactions", label: "Transactions" },
        { href: "/admin/leaderboards", label: "Leaderboards" },
        { href: "/admin/workers", label: "Workers Report" },
        { href: "/admin/tasks", label: "Tasks" },
      ]}
      rightSlot={<LogoutButton />}
      role="admin"
      subtitle="Global analytics, team performance, and workflow control."
      title="ShiftOps Admin Console"
    >
      {children}
    </AppShellNav>
  );
}

