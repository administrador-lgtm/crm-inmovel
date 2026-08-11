import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import {
  PropiedadEditCrmOwned,
  PropiedadEditSheetOrigin,
} from "./PropiedadEdit.stories";

describe("PropiedadEdit", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("shows a read-only notice instead of the form for sheet-origin rows", async () => {
    // Arrange + Act
    const screen = await render(<PropiedadEditSheetOrigin silent />);

    // Assert — notice visible, no editable form
    await expect
      .element(screen.getByText(/se administra desde el Sheet/i))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save$/i }).query()).toBeNull();
    expect(screen.getByLabelText(/^nombre/i).query()).toBeNull();
  });

  it("renders the editable form with lifecycle selector for CRM-owned rows", async () => {
    // Arrange + Act
    const screen = await render(<PropiedadEditCrmOwned silent />);

    // Assert — form loaded with the record and the CRM status selector
    await expect
      .element(screen.getByLabelText(/^nombre/i))
      .toHaveValue("Depto CRM Roma");
    await expect.element(screen.getByText("Estatus CRM")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /^save$/i }))
      .toBeInTheDocument();
  });
});
