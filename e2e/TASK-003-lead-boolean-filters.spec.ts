import { expect, test } from "./fixtures";

/**
 * Boolean lead-triage filters registered in `getLeadFilters`. Verifies the four
 * new Yes/No filters (`is_assigned`, `sin_contacto_asesor`, `sin_visita`,
 * `conversacion_activa`) are offered in the Contacts list "Add filter" drawer.
 *
 * The test only opens the filter menu and asserts the labels are present —
 * applying the filters is intentionally out of scope here, since the derived
 * `contacts_summary` boolean columns are produced by a separate migration round
 * and are not exercised by this frontend-only ticket.
 */
test.describe("lead boolean triage filters", () => {
  test.beforeEach(async ({ createSales, createContact }) => {
    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    await createContact({
      first_name: "Ana",
      last_name: "Lopez",
      sales_id: sales.id,
      stage: "S6",
      phone: "5551234567",
    });
  });

  test("offers the four boolean filters in the Add filter drawer", async ({
    page,
  }) => {
    await page.goto("http://localhost:5175/login");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.goto("http://localhost:5175/contacts");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Add filter" }).click();

    await expect(
      page.getByRole("menuitemcheckbox", { name: "Asignado" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Sin contacto del asesor" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Sin visita agendada" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Conversación activa" }),
    ).toBeVisible();
  });
});
