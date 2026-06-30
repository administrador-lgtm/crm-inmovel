import { createClient } from "@supabase/supabase-js";
import { expect, test } from "./fixtures";

/**
 * Property Matcher badge on the lead kanban card.
 *
 * `contacts_summary.match_count` (TASK-001) counts the suggested properties for
 * a lead through the `lead_property_matches` view. The kanban card surfaces that
 * count as a 🏠 badge so advisors can see, at a glance, which leads already have
 * inventory waiting on the ficha. The badge must appear when match_count >= 1 and
 * stay hidden when it is 0.
 *
 * The matcher joins `lead_match_profile` (the lead's search intent) against the
 * own-inventory `propiedades` table on operacion + price band + zona containment,
 * so these tests seed all three to drive match_count deterministically.
 */

const adminSupabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341",
  process.env.SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const MATCH_BADGE_TITLE = "Propiedades sugeridas para este lead";

/**
 * Clear every inventory feed the matcher reads so leftover rows from prior runs
 * cannot inflate match_count. `contacts` / `lead_match_profile` are wiped by the
 * fixtures' auto resetDb (the latter cascades from contacts).
 */
async function resetInventory() {
  await adminSupabase.from("propiedades").delete().not("id", "is", null);
  await adminSupabase.from("nocnok_raw").delete().not("codigo", "is", null);
  await adminSupabase.from("lamudi_raw").delete().not("codigo", "is", null);
}

/** Seed N own properties that all satisfy a venta / Roma / ~1.5M search. */
async function seedMatchingProperties(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `e2e-match-prop-${i + 1}`,
    tipo: "departamento",
    nombre: `Depto Roma ${i + 1}`,
    operacion: "venta",
    precio: 1_500_000,
    colonia: "Roma Norte",
    alcaldia: "Cuauhtemoc",
    recamaras: 2,
    activa: true,
  }));
  const { error } = await adminSupabase.from("propiedades").insert(rows);
  if (error) throw new Error(`Failed to seed properties: ${error.message}`);
}

/** Give a lead a search profile that matches the seeded properties. */
async function seedMatchProfile(leadId: string | number) {
  const { error } = await adminSupabase.from("lead_match_profile").insert({
    lead_id: leadId,
    operacion: "venta",
    zonas: ["Roma"],
    presupuesto_min: 1_000_000,
    presupuesto_max: 2_000_000,
    recamaras: 2,
    tipo: "departamento",
  });
  if (error) throw new Error(`Failed to seed match profile: ${error.message}`);
}

async function signInAndOpenKanban(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("http://localhost:5175/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveTitle(/Atomic CRM/);

  await page.goto("http://localhost:5175/leads/kanban");
  await page.waitForLoadState("networkidle");
}

test.describe("property match badge on lead kanban card", () => {
  test.beforeEach(async () => {
    await resetInventory();
  });

  test("shows the match badge with the count when the lead has matches", async ({
    page,
    createSales,
    createContact,
  }) => {
    // Arrange: an advisor owning a lead whose profile matches 3 properties.
    const sales = await createSales({
      first_name: "Match",
      last_name: "Advisor",
      email: "match@advisor.com",
      password: "password",
    });
    const lead = await createContact({
      first_name: "Carla",
      last_name: "Match",
      sales_id: sales.id,
      stage: "S7",
      phone: "5550000003",
    });
    await seedMatchingProperties(3);
    await seedMatchProfile(lead.id);

    // Act
    await signInAndOpenKanban(page, "match@advisor.com", "password");

    // Assert: the badge renders and communicates the count of 3.
    await expect(page.getByText("Carla Match")).toBeVisible();
    const badge = page.getByTitle(MATCH_BADGE_TITLE);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/3/);
  });

  test("does not show the match badge when the lead has no matches", async ({
    page,
    createSales,
    createContact,
  }) => {
    // Arrange: an advisor owning a lead with no search profile -> match_count 0.
    const sales = await createSales({
      first_name: "Empty",
      last_name: "Advisor",
      email: "empty@advisor.com",
      password: "password",
    });
    await createContact({
      first_name: "Diego",
      last_name: "Nomatch",
      sales_id: sales.id,
      stage: "S7",
      phone: "5550000000",
    });

    // Act
    await signInAndOpenKanban(page, "empty@advisor.com", "password");

    // Assert: the card renders but the match badge is absent.
    await expect(page.getByText("Diego Nomatch")).toBeVisible();
    await expect(page.getByTitle(MATCH_BADGE_TITLE)).toHaveCount(0);
  });
});
