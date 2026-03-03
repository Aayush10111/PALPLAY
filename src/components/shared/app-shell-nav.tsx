"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clock3,
  LayoutDashboard,
  ListChecks,
  ReceiptText,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

interface AppShellNavProps {
  title: string;
  subtitle?: string;
  links: NavLink[];
  rightSlot?: React.ReactNode;
  role: "worker" | "admin";
  children: React.ReactNode;
}

export function AppShellNav({
  title,
  subtitle,
  links,
  rightSlot,
  role,
  children,
}: Readonly<AppShellNavProps>) {
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const activeLabel =
    links.find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))?.label ?? title;

  const iconForLink = (href: string) => {
    if (href.includes("dashboard")) return LayoutDashboard;
    if (href.includes("transactions")) return ReceiptText;
    if (href.includes("leaderboards")) return Trophy;
    if (href.includes("workers")) return Users;
    if (href.includes("tasks")) return ListChecks;
    if (href.includes("shifts")) return Clock3;
    if (href.includes("reports")) return BarChart3;
    return LayoutDashboard;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-sidebar/95 p-4 md:flex md:flex-col">
        <div className="mb-6 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            <p className="text-lg font-semibold tracking-tight">ShiftOps</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Premium operations console</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1.5">
          {links.map((link) => {
            const isActive =
              pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            const Icon = iconForLink(link.href);
            return (
              <Link
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                )}
                href={link.href}
                key={link.href}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col md:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-primary">SHIFTOPS</p>
                <h1 className="text-2xl font-semibold tracking-tight">{activeLabel}</h1>
                {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border border-border bg-secondary text-secondary-foreground" variant="outline">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {role}
                </Badge>
                {rightSlot}
              </div>
            </div>

            <nav className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
              {links.map((link) => {
                const isActive =
                  pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
                return (
                  <Link
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 md:px-6">{children}</main>

        <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground sm:px-6">
          &copy; {year} ShiftOps. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
