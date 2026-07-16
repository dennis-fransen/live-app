import { AppShell } from "@/components/AppShell";
import { ProjectsBoard } from "@/components/ProjectsBoard";
import { getHouseholdContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const ctx = await getHouseholdContext();
  return (
    <AppShell ctx={ctx} active="/projects">
      <ProjectsBoard householdId={ctx.household.id} />
    </AppShell>
  );
}
