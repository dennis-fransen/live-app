"use client";

import Link from "next/link";
import { ActiveMemberProvider, MemberPicker } from "@/components/ActiveMember";
import { SignOutButton } from "@/components/SignOutButton";
import type { HouseholdContext } from "@/lib/types";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/all", label: "All" },
  { href: "/projects", label: "Projects" },
  { href: "/manage", label: "Manage" },
] as const;

export function AppShell({
  ctx,
  active,
  children,
}: {
  ctx: HouseholdContext;
  active: (typeof NAV)[number]["href"];
  children: React.ReactNode;
}) {
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
          <nav className="flex gap-1 px-2">
            {NAV.map((item) => {
              const isActive = item.href === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-t-lg px-4 py-2 text-sm font-medium transition"
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
        </header>
        <main className="flex-1 px-4 py-4">{children}</main>
      </div>
    </ActiveMemberProvider>
  );
}
