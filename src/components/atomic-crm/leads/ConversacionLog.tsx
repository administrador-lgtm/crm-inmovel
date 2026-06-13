import { useGetList, useRecordContext, useTranslate } from "ra-core";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { Contact, Conversacion } from "../types";

const formatTime = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

/**
 * Read-only transcript of the bot conversation for a lead. Append-only data
 * synced from the Sheet; the CRM never writes here.
 */
export const ConversacionLog = () => {
  const lead = useRecordContext<Contact>();
  const translate = useTranslate();

  const { data: mensajes } = useGetList<Conversacion>("conversaciones", {
    filter: { lead_id: lead?.id },
    sort: { field: "timestamp", order: "ASC" },
    pagination: { page: 1, perPage: 200 },
  });

  if (!lead) return null;

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <h3 className="text-md font-semibold mb-3">
          {translate("crm.conversaciones.title", { _: "Conversación del bot" })}
        </h3>
        {mensajes && mensajes.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {mensajes.map((mensaje) => {
              const fromLead = mensaje.rol === "lead";
              return (
                <div
                  key={mensaje.id}
                  className={cn(
                    "flex flex-col max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    fromLead
                      ? "self-start bg-muted"
                      : "self-end bg-primary text-primary-foreground",
                  )}
                >
                  <span>{mensaje.texto}</span>
                  <span
                    className={cn(
                      "text-[10px] mt-1",
                      fromLead
                        ? "text-muted-foreground"
                        : "text-primary-foreground/70",
                    )}
                  >
                    {formatTime(mensaje.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.conversaciones.empty", {
              _: "Sin mensajes registrados.",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
