import { Draggable } from "@hello-pangea/dnd";
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
  provided?: {
    draggableProps: Record<string, unknown>;
    dragHandleProps: Record<string, unknown> | null | undefined;
    innerRef: (element: HTMLElement | null) => void;
  };
  snapshot?: { isDragging: boolean };
  lead: Contact;
}) => {
  const { leadStages } = useConfigurationContext();
  const redirect = useRedirect();
  const phone = getLeadPhone(lead);
  const stageLabel = findLeadStageLabel(leadStages, lead.stage ?? "");

  const handleClick = () => {
    redirect(`/contacts/${lead.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
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
            {stageLabel ? (
              <Badge variant="outline" className="w-fit text-xs">
                {stageLabel}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
