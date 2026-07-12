"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Member } from "@/lib/types";

interface ActiveMemberState {
  members: Member[];
  activeId: string | null;
  setActiveId: (id: string) => void;
  active: Member | null;
}

const Ctx = createContext<ActiveMemberState | null>(null);
const STORAGE_KEY = "life-app.activeMember";

export function ActiveMemberProvider({
  members,
  children,
}: {
  members: Member[];
  children: React.ReactNode;
}) {
  const [activeId, setActiveIdState] = useState<string | null>(null);

  // Restore the "who am I" choice from the previous session on this device.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && members.some((m) => m.id === stored)) {
      setActiveIdState(stored);
    } else if (members.length > 0) {
      setActiveIdState(members[0].id);
    }
  }, [members]);

  function setActiveId(id: string) {
    setActiveIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const value = useMemo<ActiveMemberState>(
    () => ({
      members,
      activeId,
      setActiveId,
      active: members.find((m) => m.id === activeId) ?? null,
    }),
    [members, activeId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveMember() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveMember must be used within provider");
  return ctx;
}

export function MemberChip({
  member,
  size = 32,
}: {
  member: Member;
  size?: number;
}) {
  const initials = member.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      title={member.name}
      style={{
        width: size,
        height: size,
        background: member.color ?? "#64748b",
        fontSize: size * 0.4,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    >
      {initials}
    </span>
  );
}

// The tap-to-pick control for the mounted tablet.
export function MemberPicker() {
  const { members, activeId, setActiveId } = useActiveMember();
  return (
    <div className="flex items-center gap-2">
      {members.map((m) => {
        const isActive = m.id === activeId;
        return (
          <button
            key={m.id}
            onClick={() => setActiveId(m.id)}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-1 transition"
            style={{
              outline: isActive ? `2px solid ${m.color ?? "#2563eb"}` : "none",
              opacity: isActive ? 1 : 0.55,
            }}
          >
            <MemberChip member={m} size={36} />
          </button>
        );
      })}
    </div>
  );
}
