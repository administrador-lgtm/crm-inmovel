import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
  useTranslate,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";

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
    data: recentLeads,
    isPending,
    refetch,
    filterValues,
  } = useListContext<Contact>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const translate = useTranslate();

  // CRM-owned stages (Asesor aceptó onward) always have an advisor, so they must
  // be shown in FULL: the board's 200-by-recency cap exists for the high-volume
  // sync-owned funnel (S1..S5) and would otherwise hide older advisor-committed
  // leads. A separate query fetches every CRM-owned lead (RLS still scopes it to
  // the viewer, and any active advisor/search filter is preserved); it is
  // skipped when the user is explicitly filtering by stage.
  const crmOwnedStages = leadStages
    .map((stage) => stage.value)
    .filter((value) => isStageEditable(value));
  const { stage: _stageFilter, ...filtersWithoutStage } = filterValues ?? {};
  const hasStageFilter = filterValues != null && "stage" in filterValues;
  const { data: crmOwnedLeads } = useGetList<Contact>(
    "contacts",
    {
      filter: {
        ...filtersWithoutStage,
        "stage@in": `(${crmOwnedStages.join(",")})`,
      },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "last_seen", order: "DESC" },
    },
    { enabled: !hasStageFilter },
  );

  // The full CRM-owned set wins for S6+ columns; the recency list fills the
  // sync-owned funnel columns (and any lead not already present).
  const allLeads = useMemo(() => {
    const byId = new Map<Contact["id"], Contact>();
    (crmOwnedLeads ?? []).forEach((lead) => byId.set(lead.id, lead));
    (recentLeads ?? []).forEach((lead) => {
      if (!byId.has(lead.id)) byId.set(lead.id, lead);
    });
    return [...byId.values()];
  }, [recentLeads, crmOwnedLeads]);

  const [leadsByStage, setLeadsByStage] = useState<LeadsByStage>(
    getLeadsByStage([], leadStages),
  );

  useEffect(() => {
    const next = getLeadsByStage(allLeads, leadStages);
    if (!isEqual(next, leadsByStage)) {
      setLeadsByStage(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLeads]);

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
