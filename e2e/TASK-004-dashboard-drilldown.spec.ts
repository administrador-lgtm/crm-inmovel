import { expect, test } from "./fixtures";

/**
 * Dashboard drill-downs land on the Contacts list with the card's own
 * registered filter encoded in the URL (`sin_contacto_asesor` / `sin_visita`
 * from the follow-up cards, `stage` from the pipeline boxes), so the list
 * shows the exact set the card counts and the filter is a removable chip.
 *
 * Asserting the URL (not the fetched rows) keeps the test independent from
 * the migration round that materializes the contacts_summary boolean columns.
 */
test.describe("dashboard drill-downs", () => {
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

  test("'Sin contacto del asesor' card links to contacts filtered by sin_contacto_asesor", async ({
    page,
  }) => {
    await page.goto("http://localhost:5175/login");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.getByRole("link", { name: /Sin contacto del asesor/ }).click();

    await expect(page).toHaveURL(/\/contacts/);
    await expect(page).toHaveURL(/sin_contacto_asesor/);
  });

  test("'Sin visita agendada' card links to contacts filtered by sin_visita", async ({
    page,
  }) => {
    await page.goto("http://localhost:5175/login");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.getByRole("link", { name: /Sin visita agendada/ }).click();

    await expect(page).toHaveURL(/\/contacts/);
    await expect(page).toHaveURL(/sin_visita/);
  });
});
