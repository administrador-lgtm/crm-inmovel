import type { Propiedad } from "../types";

export type LifecycleStatus = NonNullable<Propiedad["lifecycle_status"]>;

/**
 * CRM lifecycle vocabulary for propiedades. `consultor_active` is admin-gated
 * in the UI (Josafat is the gate for bot exposure); the other statuses are
 * self-service for advisors. See adr/ADR-propiedades-crm-owned-guard.md
 */
export const LIFECYCLE_CHOICES: Array<{ id: LifecycleStatus; name: string }> = [
  { id: "draft", name: "Borrador" },
  { id: "matchable", name: "Matchable" },
  { id: "consultor_active", name: "Consultor activo" },
  { id: "archived", name: "Archivada" },
];

/** Statuses any advisor can set; consultor_active stays admin-only. */
export const LIFECYCLE_CHOICES_NON_ADMIN = LIFECYCLE_CHOICES.filter(
  (choice) => choice.id !== "consultor_active",
);

export const lifecycleLabel = (status?: string): string =>
  LIFECYCLE_CHOICES.find((choice) => choice.id === status)?.name ??
  status ??
  "";

export const lifecycleBadgeVariant = (
  status?: string,
): "default" | "secondary" | "outline" => {
  if (status === "matchable" || status === "consultor_active") return "default";
  if (status === "archived") return "outline";
  return "secondary";
};
