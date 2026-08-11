import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Propiedades CRUD: an advisor creates a property in the CRM (born as a
 * crm_owned draft), then publishes it to matchable from the Edit page.
 * Sheet-origin rows (crm_owned = false) stay read-only: no Edit action on the
 * show page and a notice instead of the form on the edit route.
 */
test.describe("propiedades CRUD", () => {
  test.beforeEach(async ({ createSales, createPropiedad }) => {
    await createSales({
      first_name: "Sofia",
      last_name: "Reyes",
      email: "sofia@reyes.com",
      password: "password",
    });

    // Sheet-origin row: crm_owned defaults to false in the DB.
    await createPropiedad({
      id: "sheet-p1",
      nombre: "Torre Sheet",
      operacion: "venta",
      precio: 3000000,
      colonia: "Del Valle Centro",
      alcaldia: "Benito Juarez",
      recamaras: 2,
    });
  });

  const login = async (page: Page) => {
    await page.goto("http://localhost:5175/login");
    await page.getByLabel("Email").fill("sofia@reyes.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);
  };

  test("advisor creates a draft property and publishes it to matchable", async ({
    page,
  }) => {
    await login(page);

    // Create from the list toolbar
    await page.goto("http://localhost:5175/propiedades");
    await expect(page.getByText("Torre Sheet")).toBeVisible();
    await page.getByRole("link", { name: /create/i }).click();

    await page.getByLabel(/^Nombre/).fill("Depto CRM Roma");
    await page.getByLabel(/^Colonia/).fill("Roma Norte");
    await page.getByLabel(/^Precio/).fill("2500000");
    await page.getByRole("button", { name: /save/i }).click();

    // Redirected to show: the new property is a draft and is editable
    await expect(
      page.getByRole("heading", { name: "Depto CRM Roma" }),
    ).toBeVisible();
    await expect(page.getByText("Borrador")).toBeVisible();
    const editLink = page.getByRole("link", { name: /edit/i });
    await expect(editLink).toBeVisible();

    // Publish: draft -> matchable from the Edit page
    await editLink.click();
    await page.getByRole("combobox", { name: /Estatus CRM/ }).click();
    await page.getByRole("option", { name: "Matchable" }).click();
    await page.getByRole("button", { name: /save/i }).click();

    await expect(
      page.getByRole("heading", { name: "Depto CRM Roma" }),
    ).toBeVisible();
    await expect(page.getByText("Matchable")).toBeVisible();
  });

  test("sheet-origin property stays read-only in the CRM", async ({ page }) => {
    await login(page);

    // Show page: no Edit action for a non-crm_owned row
    await page.goto("http://localhost:5175/propiedades/sheet-p1/show");
    await expect(
      page.getByRole("heading", { name: "Torre Sheet" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /edit/i })).toHaveCount(0);

    // Direct edit route: read-only notice instead of the form
    await page.goto("http://localhost:5175/propiedades/sheet-p1");
    await expect(page.getByText(/se administra desde el Sheet/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
  });
});
