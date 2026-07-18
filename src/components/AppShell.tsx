"use client";

import Link from "next/link";
import { ActiveMemberProvider, MemberPicker } from "@/components/ActiveMember";
import { SignOutButton } from "@/components/SignOutButton";
import type { HouseholdContext } from "@/lib/types";

type NavHref =
  | "/today"
  | "/upcoming"
  | "/all"
  | "/projects"
  | "/shopping"
  | "/manage";

type NavLink = { href: NavHref; label: string };

// The default task view the primary "Tasks" tab links to.
const TASKS_DEFAULT: NavHref = "/today";

const TASK_VIEWS: readonly NavLink[] = [
  { href: "/today", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/all", label: "All" },
] as const;

const TASK_HREFS = TASK_VIEWS.map((v) => v.href) as readonly NavHref[];

const PRIMARY_NAV: readonly NavLink[] = [
  { href: TASKS_DEFAULT, label: "Tasks" },
  { href: "/projects", label: "Projects" },
  { href: "/shopping", label: "Shopping" },
  { href: "/manage", label: "Manage" },
] as const;

const tabClass =
  "shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition";

export function AppShell({
  ctx,
  active,
  children,
}: {
  ctx: HouseholdContext;
  active: NavHref;
  children: React.ReactNode;
}) {
  const tasksActive = TASK_HREFS.includes(active);

  return (
    <ActiveMemberProvider members={ctx.members}>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="text-lg font-semibold">{ctx.household.name}</div>
            <SignOutButton />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-2">
            <MemberPicker />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2">
            {PRIMARY_NAV.map((item) => {
              const isActive =
                item.label === "Tasks" ? tasksActive : item.href === active;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={tabClass}
                  style={{
                    borderBottom: isActive
                      ? "2px solid var(--accent)"
                      : "2px solid transparent",
                    color: isActive ? "var(--text)" : "var(--muted)",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {tasksActive && (
            <nav className="flex gap-2 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg)]/60 px-4 py-2">
              {TASK_VIEWS.map((view) => {
                const isActive = view.href === active;
                return (
                  <Link
                    key={view.href}
                    href={view.href}
                    className="shrink-0 rounded-full px-3 py-1 text-sm font-medium transition"
                    style={{
                      backgroundColor: isActive
                        ? "var(--accent)"
                        : "transparent",
                      color: isActive ? "var(--bg)" : "var(--muted)",
                      border: isActive
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                    }}
                  >
                    {view.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>
        <main className="flex-1 px-4 py-4">{children}</main>
      </div>
    </ActiveMemberProvider>
  );
}
