import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * "Propiedades sugeridas" section on the lead ficha (ContactShow).
 * Verifies the section reads the lead_property_matches view: a matchable lead
 * (one with a lead_match_profile that lands on a seeded own property) shows a
 * tier-grouped suggestion card with a working listing link, while a lead with
 * no profile falls back to the compact empty-state instead of erroring.
 */
test.describe("property match ficha section", () => {
  let matchableLeadId: string | number;
  let plainLeadId: string | number;

  test.beforeEach(
    async ({
      createSales,
      createContact,
      createPropiedad,
      createLeadMatchProfile,
    }) => {
      const sales = await createSales({
        first_name: "Sofia",
        last_name: "Reyes",
        email: "sofia@reyes.com",
        password: "password",
      });

      // Own property whose price (1.9M) sits inside the lead's ±15% band around
      // a 2M ceiling, with a colonia that contains the lead's "Roma" zona.
      await createPropiedad({
        id: "prop-roma-1",
        nombre: "Departamento Roma Norte",
        operacion: "venta",
        precio: 1900000,
        colonia: "Roma Norte",
        alcaldia: "Cuauhtemoc",
        recamaras: 2,
        url_ficha: "https://example.com/prop-roma-1",
      });

      const matchable = await createContact({
        first_name: "Lead",
        last_name: "Conmatch",
        sales_id: sales.id,
        stage: "S6",
        phone: "5551112222",
      });
      matchableLeadId = matchable.id;

      await createLeadMatchProfile({
        leadId: matchable.id,
        operacion: "venta",
        zonas: ["Roma"],
        presupuestoMax: 2000000,
        recamaras: 2,
        tipo: "departamento",
      });

      // A lead with no match profile — not in the matchable set.
      const plain = await createContact({
        first_name: "Lead",
        last_name: "Sinmatch",
        sales_id: sales.id,
        stage: "S6",
        phone: "5553334444",
      });
      plainLeadId = plain.id;
    },
  );

  const login = async (page: Page) => {
    await page.goto("http://localhost:5175/login");
    await page.getByLabel("Email").fill("sofia@reyes.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);
  };

  // On mobile the ficha buries the section in the "Actividad" tab; open it.
  const revealOnMobile = async (page: Page, isMobile: boolean) => {
    if (isMobile) {
      await page.getByRole("tab", { name: "Actividad" }).click();
    }
  };

  test("shows tier-grouped suggestions with a working listing link", async ({
    page,
    isMobile,
  }) => {
    await login(page);
    await page.goto(
      `http://localhost:5175/contacts/${matchableLeadId}/show`,
    );
    await page.waitForLoadState("networkidle");
    await revealOnMobile(page, isMobile);

    await expect(
      page.getByRole("heading", { name: "Propiedades sugeridas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Propias" }),
    ).toBeVisible();

    const link = page.getByRole("link", { name: /Departamento Roma Norte/ });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
  });

  test("shows the empty-state for a lead with no match profile", async ({
    page,
    isMobile,
  }) => {
    await login(page);
    await page.goto(`http://localhost:5175/contacts/${plainLeadId}/show`);
    await page.waitForLoadState("networkidle");
    await revealOnMobile(page, isMobile);

    await expect(
      page.getByRole("heading", { name: "Propiedades sugeridas" }),
    ).toBeVisible();
    await expect(
      page.getByText("Sin propiedades sugeridas."),
    ).toBeVisible();
  });
});
