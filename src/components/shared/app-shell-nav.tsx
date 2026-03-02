"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

interface AppShellNavProps {
  title: string;
  subtitle: string;
  links: NavLink[];
  rightSlot?: React.ReactNode;
  tone?: "worker" | "admin";
}

export function AppShellNav({
  title,
  subtitle,
  links,
  rightSlot,
  tone = "worker",
}: Readonly<AppShellNavProps>) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-gradient-to-r from-orange-100/90 via-teal-100/85 to-cyan-100/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-primary/90">PAL PAY HUSTEL</p>
            <p className="text-base font-semibold tracking-tight sm:text-lg">{title}</p>
            <p className="text-xs text-muted-foreground md:text-sm">{subtitle}</p>
          </div>
          <div className="shrink-0 self-start sm:self-auto">{rightSlot}</div>
        </div>
        <nav className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {links.map((link) => {
            const isActive =
              pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? tone === "admin"
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-emerald-600 bg-emerald-600 text-white"
                    : "border-border bg-card text-card-foreground hover:bg-muted",
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
  );
}


