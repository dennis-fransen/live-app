import { AppShell } from "@/components/AppShell";
import { TaskBoard } from "@/components/TaskBoard";
import { getHouseholdContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function UpcomingPage() {
  const ctx = await getHouseholdContext();
  return (
    <AppShell ctx={ctx} active="/upcoming">
      <TaskBoard
        householdId={ctx.household.id}
        timezone={ctx.household.timezone}
        members={ctx.members}
        categories={ctx.categories}
        view="upcoming"
      />
    </AppShell>
  );
}
