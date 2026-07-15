import { AppShell } from "@/components/AppShell";
import { NewTaskForm } from "@/components/NewTaskForm";
import { MembersEditor } from "@/components/MembersEditor";
import { DefinitionsList } from "@/components/DefinitionsList";
import { getHouseholdContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const ctx = await getHouseholdContext();
  return (
    <AppShell ctx={ctx} active="/manage">
      <div className="flex flex-col gap-6">
        <NewTaskForm
          householdId={ctx.household.id}
          members={ctx.members}
          categories={ctx.categories}
        />
        <MembersEditor members={ctx.members} />
        <DefinitionsList householdId={ctx.household.id} />
      </div>
    </AppShell>
  );
}
