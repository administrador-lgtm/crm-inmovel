import { useState } from "react";
import { useGetList, useRecordContext, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { Contact, Propiedad, Visita } from "../types";
import { AgendarVisitaDialog } from "./AgendarVisitaDialog";

const formatDate = (value: string, locale: string) =>
  new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * Visits for a lead: a read-only list + the "Agendar visita" journey (which
 * creates the Google Calendar event — the source of truth — and mirrors it
 * here). Visits are scheduled only through that journey; there is no manual
 * "record a visit" path (it would create a calendar-less orphan visit).
 */
export const VisitasPanel = () => {
  const lead = useRecordContext<Contact>();
  const translate = useTranslate();
  const [agendarOpen, setAgendarOpen] = useState(false);

  const { data: visitas } = useGetList<Visita>("visitas", {
    filter: { lead_id: lead?.id },
    sort: { field: "fecha", order: "DESC" },
    pagination: { page: 1, perPage: 50 },
  });

  const { data: propiedades } = useGetList<Propiedad>("propiedades", {
    sort: { field: "nombre", order: "ASC" },
    pagination: { page: 1, perPage: 300 },
  });

  if (!lead) return null;

  const propiedadName = (visita: Visita) =>
    // Own properties resolve via propiedades; external "URL libre" visits carry
    // their title as a snapshot on the visit itself.
    visita.propiedad_nombre ||
    propiedades?.find((p) => p.id === visita.propiedad_id)?.nombre ||
    visita.propiedad_id ||
    "";

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-semibold">
            {translate("crm.visitas.title", { _: "Visitas" })}
          </h3>
          <Button size="sm" onClick={() => setAgendarOpen(true)}>
            {translate("crm.visitas.schedule", { _: "Agendar visita" })}
          </Button>
        </div>

        <AgendarVisitaDialog open={agendarOpen} onOpenChange={setAgendarOpen} />

        {visitas && visitas.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visitas.map((visita) => (
              <li
                key={visita.id}
                className="border rounded-md p-2 text-sm flex flex-col"
              >
                <span className="font-medium">{propiedadName(visita)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(visita.fecha, "es-MX")}
                  {visita.estado && visita.estado !== "confirmada"
                    ? ` · ${visita.estado}`
                    : ""}
                  {visita.resultado ? ` · ${visita.resultado}` : ""}
                </span>
                {visita.notas && <span className="mt-1">{visita.notas}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.visitas.empty", { _: "Sin visitas registradas." })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
