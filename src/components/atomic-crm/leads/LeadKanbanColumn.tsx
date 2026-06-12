import { Droppable } from "@hello-pangea/dnd";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import { LeadKanbanCard } from "./LeadKanbanCard";
import { findLeadStageLabel, isStageEditable } from "./stages";

export const LeadKanbanColumn = ({
  stage,
  leads,
}: {
  stage: string;
  leads: Contact[];
}) => {
  const { leadStages } = useConfigurationContext();
  const label = findLeadStageLabel(leadStages, stage) ?? stage;
  const editable = isStageEditable(stage);

  return (
    <div className="flex-1 pb-8 min-w-44">
      <div className="flex flex-col items-center">
        <h3 className="text-base font-medium text-center">{label}</h3>
        <p className="text-sm text-muted-foreground">
          {leads.length}
          {!editable ? " · solo lectura" : ""}
        </p>
      </div>
      {/* Read-only (sync-owned) columns never accept drops. */}
      <Droppable droppableId={stage} isDropDisabled={!editable}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col rounded-2xl mt-2 gap-2 min-h-12 ${
              snapshot.isDraggingOver && editable ? "bg-muted" : ""
            } ${!editable ? "opacity-75" : ""}`}
          >
            {leads.map((lead, index) => (
              <LeadKanbanCard key={lead.id} lead={lead} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
