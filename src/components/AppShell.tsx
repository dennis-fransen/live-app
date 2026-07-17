"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActiveMemberProvider, MemberPicker } from "@/components/ActiveMember";
import { SignOutButton } from "@/components/SignOutButton";
import type { HouseholdContext } from "@/lib/types";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; children: readonly NavLink[] };
type NavItem = NavLink | NavGroup;

const NAV: readonly NavItem[] = [
  {
    label: "Tasks",
    children: [
      { href: "/today", label: "Today" },
      { href: "/upcoming", label: "Upcoming" },
      { href: "/all", label: "All" },
    ],
  },
  { href: "/projects", label: "Projects" },
  { href: "/shopping", label: "Shopping" },
  { href: "/manage", label: "Manage" },
] as const;

type NavHref =
  | "/today"
  | "/upcoming"
  | "/all"
  | "/projects"
  | "/shopping"
  | "/manage";

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

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
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openGroup) return;
    function handlePointerDown(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenGroup(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openGroup]);

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
          <nav ref={navRef} className="flex gap-1 overflow-x-auto px-2">
            {NAV.map((item) => {
              if (isGroup(item)) {
                const groupActive = item.children.some(
                  (child) => child.href === active,
                );
                const isOpen = openGroup === item.label;
                return (
                  <div key={item.label} className="relative shrink-0">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenGroup(isOpen ? null : item.label)
                      }
                      className={`${tabClass} flex items-center gap-1`}
                      style={{
                        borderBottom: groupActive
                          ? "2px solid var(--accent)"
                          : "2px solid transparent",
                        color:
                          groupActive || isOpen
                            ? "var(--text)"
                            : "var(--muted)",
                      }}
                    >
                      {item.label}
                      <span
                        aria-hidden
                        className="text-xs transition-transform"
                        style={{
                          transform: isOpen ? "rotate(180deg)" : "none",
                        }}
                      >
                        ▾
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        role="menu"
                        className="absolute left-0 top-full z-20 mt-1 min-w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg"
                      >
                        {item.children.map((child) => {
                          const childActive = child.href === active;
                          return (
                            <Link
                              key={child.href}
                              role="menuitem"
                              href={child.href}
                              onClick={() => setOpenGroup(null)}
                              className="block px-4 py-2 text-sm font-medium transition hover:bg-[var(--border)]/40"
                              style={{
                                color: childActive
                                  ? "var(--text)"
                                  : "var(--muted)",
                                borderLeft: childActive
                                  ? "2px solid var(--accent)"
                                  : "2px solid transparent",
                              }}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = item.href === active;
              return (
                <Link
                  key={item.href}
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
        </header>
        <main className="flex-1 px-4 py-4">{children}</main>
      </div>
    </ActiveMemberProvider>
  );
}
