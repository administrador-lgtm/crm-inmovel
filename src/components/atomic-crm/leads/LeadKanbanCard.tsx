import type * as React from "react";
import { Draggable } from "@hello-pangea/dnd";
import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { useRedirect, RecordContextProvider } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import { findLeadStageLabel } from "./stages";

/** First non-empty phone number on the lead, if any. */
const getLeadPhone = (lead: Contact): string | undefined =>
  lead.phone_jsonb?.find((entry) => entry.number)?.number;

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
  const { leadStages } = useConfigurationContext();
  const redirect = useRedirect();
  const phone = getLeadPhone(lead);
  const stageLabel = findLeadStageLabel(leadStages, lead.stage ?? "");
  const stageAge = getStageAge(lead.stage_changed_at);

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
            {phone ? (
              <p className="text-xs text-muted-foreground">{phone}</p>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              {stageLabel ? (
                <Badge variant="outline" className="w-fit text-xs">
                  {stageLabel}
                </Badge>
              ) : (
                <span />
              )}
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
