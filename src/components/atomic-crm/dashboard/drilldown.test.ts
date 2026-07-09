import { describe, expect, test } from "vitest";

import { contactsDrillHref } from "./drilldown";

const decodeFilter = (href: string): Record<string, unknown> =>
  JSON.parse(decodeURIComponent(href.split("?filter=")[1]));

describe("contactsDrillHref", () => {
  test("keeps only the base filter when advisor is 'all'", () => {
    // Arrange / Act
    const href = contactsDrillHref({ sin_contacto_asesor: true }, "all");

    // Assert
    expect(href.startsWith("/contacts?filter=")).toBe(true);
    expect(decodeFilter(href)).toEqual({ sin_contacto_asesor: true });
  });

  test("maps 'unassigned' to is_assigned=false", () => {
    const href = contactsDrillHref({ stage: "S4" }, "unassigned");

    expect(decodeFilter(href)).toEqual({ stage: "S4", is_assigned: false });
  });

  test("maps 'assigned' to is_assigned=true", () => {
    const href = contactsDrillHref({ sin_visita: true }, "assigned");

    expect(decodeFilter(href)).toEqual({ sin_visita: true, is_assigned: true });
  });

  test("maps a concrete advisor id to sales_id", () => {
    const href = contactsDrillHref({ stage: "S6" }, "12");

    expect(decodeFilter(href)).toEqual({ stage: "S6", sales_id: "12" });
  });

  test("returns an empty filter for 'all' with an empty base", () => {
    const href = contactsDrillHref({}, "all");

    expect(decodeFilter(href)).toEqual({});
  });

  test("does not mutate the base filter object", () => {
    const base: Record<string, unknown> = { sin_visita: true };

    contactsDrillHref(base, "unassigned");

    expect(base).toEqual({ sin_visita: true });
  });
});
