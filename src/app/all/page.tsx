import { AppShell } from "@/components/AppShell";
import { TaskBoard } from "@/components/TaskBoard";
import { getHouseholdContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function AllPage() {
  const ctx = await getHouseholdContext();
  return (
    <AppShell ctx={ctx} active="/all">
      <TaskBoard
        householdId={ctx.household.id}
        timezone={ctx.household.timezone}
        members={ctx.members}
        categories={ctx.categories}
        view="all"
      />
    </AppShell>
  );
}
