import { AppShell } from "@/components/AppShell";
import { RecipesBoard } from "@/components/RecipesBoard";
import { getHouseholdContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const ctx = await getHouseholdContext();
  return (
    <AppShell ctx={ctx} active="/recipes">
      <RecipesBoard householdId={ctx.household.id} />
    </AppShell>
  );
}
