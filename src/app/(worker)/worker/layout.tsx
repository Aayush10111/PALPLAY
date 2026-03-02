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
    <div className="min-h-screen">
      <AppShellNav
        links={[
          { href: "/worker/dashboard", label: "Dashboard" },
        ]}
        rightSlot={<LogoutButton />}
        subtitle="All worker actions in one place."
        title="PAL PAY HUSTEL Worker Console"
        tone="worker"
      />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">{children}</main>
    </div>
  );
}

