import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultCurrency = "MXN";

export const defaultTitle = "Inmovel CRM";

// Inmovel lead pipeline stages (S1..S10 + descartado). The stage lives on the
// lead (a contact); S1..S5 are sync-owned and read-only in the CRM.
export const defaultLeadStages = [
  { value: "S1", label: "Contacto" },
  { value: "S2", label: "En conversación" },
  { value: "S3", label: "Perfilando" },
  { value: "S4", label: "Handoff ready" },
  { value: "S5", label: "Handoff enviado" },
  { value: "S6", label: "Asesor aceptó" },
  { value: "S7", label: "Visita solicitada" },
  { value: "S8", label: "Visita realizada" },
  { value: "S9", label: "Negociación" },
  { value: "S10", label: "Cierre" },
  { value: "descartado", label: "Descartado" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

export const defaultConfiguration: ConfigurationContextValue = {
  currency: defaultCurrency,
  leadStages: defaultLeadStages,
  noteStatuses: defaultNoteStatuses,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
