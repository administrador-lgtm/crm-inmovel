/**
 * Build a `/contacts` drill-down URL for dashboard widgets.
 *
 * Only filter sources registered in `getLeadFilters` are allowed here, so
 * every applied filter surfaces as a visible, removable chip — never a hidden
 * sticky one (see commit 656f1d5). The advisor selector's special values map
 * onto the registered `is_assigned` boolean; a concrete advisor id maps to
 * `sales_id`.
 */
export const contactsDrillHref = (
  base: Record<string, unknown>,
  asesor: string,
): string => {
  const filter: Record<string, unknown> = { ...base };
  if (asesor === "unassigned") filter.is_assigned = false;
  else if (asesor === "assigned") filter.is_assigned = true;
  else if (asesor !== "all") filter.sales_id = asesor;
  return `/contacts?filter=${encodeURIComponent(JSON.stringify(filter))}`;
};
