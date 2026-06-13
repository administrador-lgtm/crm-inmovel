import { useRecordContext, useTranslate } from "ra-core";

import type { Contact } from "../types";

/** A single read-only field row; renders nothing when the value is empty. */
const Field = ({ label, value }: { label: string; value?: unknown }) => {
  if (value === null || value === undefined || value === "") return null;
  const display =
    typeof value === "boolean" ? (value ? "Sí" : "No") : String(value);
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{display}</span>
    </div>
  );
};

/**
 * Read-only panel for the lead's bot-qualified data. Every field here is
 * sync-owned (written by the Sheet sync), so the CRM never edits it — it is
 * shown for the advisor to read while working the lead.
 */
export const LeadInfo = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();
  if (!record) return null;

  const t = (key: string, fallback: string) => translate(key, { _: fallback });

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={t("crm.leads.fields.zona_interes", "Zona de interés")}
        value={record.zona_interes}
      />
      <Field
        label={t("crm.leads.fields.presupuesto", "Presupuesto")}
        value={record.presupuesto}
      />
      <Field
        label={t("crm.leads.fields.tipo_busqueda", "Operación")}
        value={record.tipo_busqueda}
      />
      <Field
        label={t("crm.leads.fields.ventana_compra", "Ventana de compra")}
        value={record.ventana_compra}
      />
      <Field
        label={t("crm.leads.fields.forma_compra", "Forma de compra")}
        value={record.forma_compra}
      />
      <Field
        label={t("crm.leads.fields.credito_status", "Estatus de crédito")}
        value={record.credito_status}
      />
      <Field
        label={t("crm.leads.fields.canal", "Canal")}
        value={record.canal}
      />
      <Field
        label={t("crm.leads.fields.fuente", "Fuente")}
        value={record.fuente}
      />
      <Field
        label={t("crm.leads.fields.total_mensajes", "Mensajes")}
        value={record.total_mensajes}
      />
      <Field
        label={t("crm.leads.fields.resumen_sales", "Resumen")}
        value={record.resumen_sales}
      />
    </div>
  );
};
