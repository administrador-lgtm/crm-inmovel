import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { PropiedadCreateBasic } from "./PropiedadCreate.stories";

describe("PropiedadCreate", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("does not submit when required fields are missing", async () => {
    // Arrange
    const createMock = vi.fn().mockResolvedValue({ data: {} });
    const screen = await render(
      <PropiedadCreateBasic silent dataProvider={{ create: createMock }} />,
    );
    await expect.element(screen.getByLabelText(/^nombre/i)).toBeInTheDocument();

    // Act — save with nombre/colonia/precio still empty
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert
    await expect.element(screen.getByLabelText(/^nombre/i)).toBeInTheDocument();
    expect(createMock).not.toBeCalled();
  });

  it("stamps crm_owned, draft lifecycle and creator on submit", async () => {
    // Arrange
    const createMock = vi
      .fn()
      .mockImplementation(
        async (_resource: string, params: { data: Record<string, unknown> }) =>
          ({ data: { id: "CRM-NEW", ...params.data } }) as never,
      );
    const screen = await render(
      <PropiedadCreateBasic silent dataProvider={{ create: createMock }} />,
    );
    await expect.element(screen.getByLabelText(/^nombre/i)).toBeInTheDocument();

    // Act — fill the minimal required fields and save
    await screen.getByLabelText(/^nombre/i).fill("Depto CRM Roma");
    await screen.getByLabelText(/^colonia/i).fill("Roma Norte");
    await screen.getByLabelText(/^precio/i).fill("2500000");
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert — transform stamped the CRM ownership fields
    await expect.poll(() => createMock).toBeCalledTimes(1);
    expect(createMock).toBeCalledWith(
      "propiedades",
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: "Depto CRM Roma",
          colonia: "Roma Norte",
          precio: 2500000,
          tipo: "propia",
          operacion: "venta",
          crm_owned: true,
          lifecycle_status: "draft",
          created_by: 0,
          fuente: "crm",
        }),
      }),
    );
  });
});
