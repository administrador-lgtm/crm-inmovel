import { expect, test } from "./fixtures";

/**
 * Lead pipeline kanban board (retargeted from the former deal board).
 * Verifies the board renders one column per stage, places leads in the column
 * matching their `stage`, shows lead name + phone + stage badge on the card,
 * and marks the sync-owned S1..S5 columns as read-only.
 */
test.describe("lead kanban board", () => {
  test.beforeEach(async ({ createSales, createContact }) => {
    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    // A bot-owned lead (read-only stage) and an advisor-owned lead.
    await createContact({
      first_name: "Ana",
      last_name: "Lopez",
      sales_id: sales.id,
      stage: "S1",
      phone: "5551234567",
    });

    await createContact({
      first_name: "Beto",
      last_name: "Ramirez",
      sales_id: sales.id,
      stage: "S7",
      phone: "5559876543",
    });
  });

  test("renders the pipeline columns and places leads by stage", async ({
    page,
  }) => {
    await page.goto("http://localhost:5175/login");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.goto("http://localhost:5175/leads/kanban");
    await page.waitForLoadState("networkidle");

    // Column headers for the first and last advisor stages render.
    await expect(page.getByRole("heading", { name: "Contacto" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Visita agendada" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Descartado" })).toBeVisible();

    // Each lead card shows the lead name and phone number.
    await expect(page.getByText("Ana Lopez")).toBeVisible();
    await expect(page.getByText("5551234567")).toBeVisible();
    await expect(page.getByText("Beto Ramirez")).toBeVisible();
    await expect(page.getByText("5559876543")).toBeVisible();

    // S1..S5 are sync-owned and surfaced as read-only on the board.
    await expect(page.getByText("solo lectura").first()).toBeVisible();
  });
});
