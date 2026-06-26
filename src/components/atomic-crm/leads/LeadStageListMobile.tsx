import { useState } from "react";
import { useGetList } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { cn } from "@/lib/utils";
import type { Contact } from "../types";
import { LeadKanbanCardContent } from "./LeadKanbanCard";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";

/**
 * Mobile pipeline view: a horizontally-scrollable row of stage chips on top, a
 * vertical list of that stage's leads below. The desktop drag-and-drop kanban
 * doesn't fit a phone, so mobile gets this list+chips pattern (see
 * docs/MOBILE-STAGES-UX.md). RLS scopes the list to the viewer's leads.
 */
export default function LeadStageListMobile() {
  const { leadStages } = useConfigurationContext();
  // Default to the first advisor-owned stage (Asesor aceptó) — that's where an
  // advisor's working pipeline begins.
  const [stage, setStage] = useState("S6");

  const { data, isPending } = useGetList<Contact>("contacts", {
    filter: { stage },
    sort: { field: "last_seen", order: "DESC" },
    pagination: { page: 1, perPage: 100 },
  });

  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold">Leads</h1>
      </MobileHeader>
      <MobileContent>
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {leadStages.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStage(s.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                stage === s.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : !data?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin leads en esta etapa
            </p>
          ) : (
            data.map((lead) => (
              <LeadKanbanCardContent key={lead.id} lead={lead} />
            ))
          )}
        </div>
      </MobileContent>
    </>
  );
}
