import { useGetList, useRecordContext } from "ra-core";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { Contact, AdvisorMessage } from "../types";

const formatTime = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

/**
 * Read-only transcript of the real advisor↔lead WhatsApp conversation, captured
 * by the Baileys listener and exposed via public.advisor_conversation (joined to
 * the lead, RLS-scoped). Only advisors with the Baileys companion produce data,
 * so this card is HIDDEN when there are no messages (most leads, for now) and
 * fills in automatically as the listener matures / more advisors onboard.
 */
export const AdvisorConversacionLog = () => {
  const lead = useRecordContext<Contact>();

  const { data: mensajes } = useGetList<AdvisorMessage>("advisor_conversation", {
    filter: { lead_id: lead?.id },
    sort: { field: "sent_at", order: "ASC" },
    pagination: { page: 1, perPage: 200 },
  });

  if (!lead || !mensajes || mensajes.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <h3 className="text-md font-semibold mb-3">Conversación del asesor</h3>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {mensajes.map((mensaje) => {
            const fromAdvisor = mensaje.from_advisor;
            return (
              <div
                key={mensaje.id}
                className={cn(
                  "flex flex-col max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  fromAdvisor
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted",
                )}
              >
                <span>{mensaje.text}</span>
                <span
                  className={cn(
                    "text-[10px] mt-1",
                    fromAdvisor
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {formatTime(mensaje.sent_at)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
