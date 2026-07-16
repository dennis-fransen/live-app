import { AppShell } from "@/components/AppShell";
import { ShoppingList } from "@/components/ShoppingList";
import { getHouseholdContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const ctx = await getHouseholdContext();
  return (
    <AppShell ctx={ctx} active="/shopping">
      <ShoppingList householdId={ctx.household.id} />
    </AppShell>
  );
}
