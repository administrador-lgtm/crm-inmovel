import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import {
  useDataProvider,
  useListContext,
  useNotify,
  useTranslate,
} from "ra-core";
import { useEffect, useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import { LeadKanbanColumn } from "./LeadKanbanColumn";
import { getLeadsByStage, type LeadsByStage } from "./leadsByStage";
import { isStageEditable } from "./stages";

/**
 * The kanban board body: groups leads by stage and persists stage changes on
 * drag. Unlike the former deal board there is no intra-column ordering — a
 * lead is its own opportunity, so the only mutation is `stage`. Dragging into a
 * read-only column (S1..S5, sync-owned) is blocked with a user-facing notice.
 */
export const LeadKanbanContent = () => {
  const { leadStages } = useConfigurationContext();
  const {
    data: unorderedLeads,
    isPending,
    refetch,
  } = useListContext<Contact>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const translate = useTranslate();

  const [leadsByStage, setLeadsByStage] = useState<LeadsByStage>(
    getLeadsByStage([], leadStages),
  );

  useEffect(() => {
    if (unorderedLeads) {
      const next = getLeadsByStage(unorderedLeads, leadStages);
      if (!isEqual(next, leadsByStage)) {
        setLeadsByStage(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedLeads]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) return;

    const sourceStage = source.droppableId;
    const destinationStage = destination.droppableId;

    if (sourceStage === destinationStage) return;

    // S1..S5 are owned by the bot sync — block advisor moves into them.
    if (!isStageEditable(destinationStage)) {
      notify(
        translate("crm.leads.stage_read_only", {
          _: "Esta etapa la gestiona el sistema y no se puede modificar manualmente.",
        }),
        { type: "warning" },
      );
      return;
    }

    const movedLead = leadsByStage[sourceStage]?.[source.index];
    if (!movedLead) return;

    // Optimistic local update.
    setLeadsByStage(
      moveLeadLocal(movedLead, sourceStage, destinationStage, leadsByStage),
    );

    dataProvider
      .update("contacts", {
        id: movedLead.id,
        data: { stage: destinationStage },
        previousData: movedLead,
      })
      .then(() => {
        refetch();
      })
      .catch(() => {
        notify(translate("ra.notification.http_error"), { type: "error" });
        refetch();
      });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto">
        {leadStages.map((stage) => (
          <LeadKanbanColumn
            stage={stage.value}
            leads={leadsByStage[stage.value] ?? []}
            key={stage.value}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

/** Move a lead between columns in local board state (immutably). */
const moveLeadLocal = (
  lead: Contact,
  sourceStage: string,
  destinationStage: string,
  leadsByStage: LeadsByStage,
): LeadsByStage => ({
  ...leadsByStage,
  [sourceStage]: leadsByStage[sourceStage].filter((l) => l.id !== lead.id),
  [destinationStage]: [
    { ...lead, stage: destinationStage },
    ...leadsByStage[destinationStage],
  ],
});
