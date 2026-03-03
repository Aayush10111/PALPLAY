import { AppShellNav } from "@/components/shared/app-shell-nav";
import { LogoutButton } from "@/components/shared/logout-button";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export default async function WorkerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole("worker");

  return (
    <AppShellNav
      links={[
        { href: "/worker/dashboard", label: "Dashboard" },
        { href: "/worker/transactions", label: "Transactions" },
        { href: "/worker/shifts", label: "Shifts" },
        { href: "/worker/reports", label: "Reports" },
        { href: "/worker/tasks", label: "My Tasks" },
      ]}
      rightSlot={<LogoutButton />}
      role="worker"
      subtitle="Clock in, record transactions, and monitor your performance."
      title="ShiftOps Worker Console"
    >
      {children}
    </AppShellNav>
  );
}

