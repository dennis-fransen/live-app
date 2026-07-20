import { timingSafeEqual } from "node:crypto";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createRecipeFromPayload,
  findRecipesByTitle,
  listRecipesBrief,
} from "@/lib/recipes-import";

// The MCP server for the recipe box. Lets an agent (Claude) read a recipe off
// any website and store it in OUR format via `create_recipe`. The agent does
// the fetching + translation; these tools just persist and query. Bypasses RLS
// via the service-role client, so the whole endpoint is behind a bearer token
// (see withMcpAuth below) and only exposes these few recipe tools.

export const runtime = "nodejs";
export const maxDuration = 60;

function householdId(): string {
  const id = process.env.HOUSEHOLD_ID;
  if (!id) {
    throw new Error(
      "HOUSEHOLD_ID is not set — the MCP server needs to know which household to write to.",
    );
  }
  return id;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function recipeUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return base ? `${base}/recipes#${id}` : `(open the Recipes tab) — id ${id}`;
}

const baseHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "create_recipe",
      {
        title: "Create a recipe",
        description:
          "Add a recipe to the household recipe box, in the app's own format. " +
          "Read the source page yourself and map it into these fields. Keep the " +
          "original units and language unless the user asks you to convert/translate. " +
          "Put the page URL (or book reference) in `source`. `ingredients` is an " +
          "ordered list of { amount, name } (amount optional, e.g. amount:'500 g', " +
          "name:'flour'); `steps` is an ordered list of plain-text instructions, one " +
          "per step. Tip: call find_recipe first so you don't create a duplicate.",
        inputSchema: {
          title: z.string().min(1).describe("Recipe name, e.g. 'Sourdough loaf'"),
          category: z
            .string()
            .optional()
            .describe("e.g. 'Bread', 'Jelly & preserves', 'Main'"),
          yield: z.string().optional().describe("e.g. '2 loaves', '6 jars'"),
          prep_minutes: z.number().int().min(0).optional(),
          cook_minutes: z.number().int().min(0).optional(),
          source: z
            .string()
            .optional()
            .describe("Where it came from — the page URL or a book reference"),
          description: z
            .string()
            .optional()
            .describe("Optional blurb, notes, tips"),
          ingredients: z
            .array(
              z.object({
                amount: z.string().optional().describe("e.g. '500 g', '2 tbsp'"),
                name: z.string().min(1).describe("e.g. 'flour', 'sugar'"),
              }),
            )
            .describe("Ordered ingredient lines"),
          steps: z
            .array(z.string().min(1))
            .describe("Ordered instruction steps, one string per step"),
        },
      },
      async (args) => {
        const supabase = createServiceClient();
        const created = await createRecipeFromPayload(supabase, householdId(), {
          title: args.title,
          category: args.category,
          recipe_yield: args.yield,
          prep_minutes: args.prep_minutes,
          cook_minutes: args.cook_minutes,
          source: args.source,
          description: args.description,
          ingredients: args.ingredients,
          steps: args.steps,
        });
        return textResult(
          `Added "${created.title}" — ${created.ingredientCount} ingredient(s), ` +
            `${created.stepCount} step(s).\n${recipeUrl(created.id)}`,
        );
      },
    );

    server.registerTool(
      "find_recipe",
      {
        title: "Find recipes by title",
        description:
          "Case-insensitive search of existing recipe titles. Use before " +
          "create_recipe to avoid adding a duplicate.",
        inputSchema: { query: z.string().min(1) },
      },
      async ({ query }) => {
        const supabase = createServiceClient();
        const rows = await findRecipesByTitle(supabase, householdId(), query);
        if (rows.length === 0) return textResult(`No recipes match "${query}".`);
        return textResult(
          `Found ${rows.length}:\n` +
            rows
              .map((r) => `- ${r.title}${r.category ? ` [${r.category}]` : ""}`)
              .join("\n"),
        );
      },
    );

    server.registerTool(
      "list_recipes",
      {
        title: "List recipes",
        description: "List all recipes currently in the box (id, title, category).",
      },
      async () => {
        const supabase = createServiceClient();
        const rows = await listRecipesBrief(supabase, householdId());
        if (rows.length === 0) return textResult("The recipe box is empty.");
        return textResult(
          rows
            .map((r) => `- ${r.title}${r.category ? ` [${r.category}]` : ""}`)
            .join("\n"),
        );
      },
    );
  },
  {},
  { basePath: "/api" },
);

// ---- Auth: a shared bearer token guards the whole endpoint ------------------
// Set MCP_AUTH_TOKEN to a long random secret and send it as
// `Authorization: Bearer <token>` from the MCP client. Fails closed if the
// token is unset, so the endpoint is never open by accident.
function tokenIsValid(provided: string | undefined): boolean {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function verifyToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!tokenIsValid(bearerToken)) return undefined;
  return { token: bearerToken!, clientId: "household", scopes: [] };
}

const handler = withMcpAuth(baseHandler, verifyToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };
