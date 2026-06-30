import type * as React from "react";
import { Draggable } from "@hello-pangea/dnd";
import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { useRedirect, RecordContextProvider } from "ra-core";
import { Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { Contact } from "../types";

/** Display name for a lead (contact). */
const getLeadName = (lead: Contact): string =>
  [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();

/**
 * Compact "time in current stage" badge (e.g. "5d", "3h"). Computed on render
 * (no live ticking). Colour escalates as the lead sits longer in the stage:
 * muted < 3d, amber 3–6d, red ≥ 7d (likely stuck).
 */
const getStageAge = (
  since?: string,
): { text: string; className: string } | null => {
  if (!since) return null;
  const ms = Date.now() - new Date(since).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const text = days >= 1 ? `${days}d` : `${Math.floor(ms / 3_600_000)}h`;
  const className =
    days >= 7
      ? "text-red-600"
      : days >= 3
        ? "text-amber-600"
        : "text-muted-foreground";
  return { text, className };
};

export const LeadKanbanCard = ({
  lead,
  index,
}: {
  lead: Contact;
  index: number;
}) => {
  if (!lead) return null;

  return (
    <Draggable draggableId={String(lead.id)} index={index}>
      {(provided, snapshot) => (
        <LeadKanbanCardContent
          provided={provided}
          snapshot={snapshot}
          lead={lead}
        />
      )}
    </Draggable>
  );
};

export const LeadKanbanCardContent = ({
  provided,
  snapshot,
  lead,
}: {
  provided?: DraggableProvided;
  snapshot?: DraggableStateSnapshot;
  lead: Contact;
}) => {
  const redirect = useRedirect();
  const stageAge = getStageAge(lead.stage_changed_at);
  // Property Matcher: contacts_summary already carries match_count, so the
  // badge is purely presentational — no extra fetch (see TASK-001 / TASK-003).
  // Counts run into the hundreds for popular zones, so the badge caps at "9+"
  // — it signals "has suggestions", not an exact count.
  const matchCount = lead.match_count ?? 0;
  const matchLabel = matchCount > 9 ? "9+" : String(matchCount);

  const handleClick = () => {
    redirect(`/contacts/${lead.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...(provided?.draggableProps as unknown as React.HTMLAttributes<HTMLDivElement>)}
      {...(provided?.dragHandleProps as unknown as React.HTMLAttributes<HTMLDivElement>)}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={lead}>
        <Card
          className={`py-3 transition-all duration-200 ${
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
        >
          <CardContent className="px-3 flex flex-col gap-1">
            <p className="text-sm font-medium">{getLeadName(lead)}</p>
            {lead.asesor_nombre ? (
              <Badge
                variant="outline"
                className="w-fit text-xs font-normal max-w-full truncate"
                title="Asesor asignado"
              >
                👤 {lead.asesor_nombre}
              </Badge>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0">
                {lead.desarrollo_activo_nombre ? (
                  <Badge
                    variant="outline"
                    className="w-fit text-xs font-normal max-w-[70%] truncate"
                    title="Propiedad de interés"
                  >
                    🏠 {lead.desarrollo_activo_nombre}
                  </Badge>
                ) : null}
                {matchCount >= 1 ? (
                  <Badge
                    variant="outline"
                    className="w-fit text-xs font-normal shrink-0 gap-1"
                    title="Propiedades sugeridas para este lead"
                  >
                    <Home className="size-3" aria-hidden="true" />
                    {matchLabel}
                  </Badge>
                ) : null}
              </div>
              {stageAge ? (
                <span
                  className={`text-xs font-medium tabular-nums ${stageAge.className}`}
                  title="Tiempo en esta etapa"
                >
                  🕐 {stageAge.text}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
