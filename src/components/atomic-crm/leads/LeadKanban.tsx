import { useGetIdentity } from "ra-core";
import { List } from "@/components/admin/list";
import { FilterButton } from "@/components/admin/filter-form";
import { SortButton } from "@/components/admin/sort-button";

import { TopToolbar } from "../layout/TopToolbar";
import { LeadKanbanContent } from "./LeadKanbanContent";
import { getLeadFilters } from "./leadFilters";
import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * Lead pipeline kanban board.
 *
 * Retargeted from the former deal board: it reads the `contacts` resource
 * (a contact IS the lead/opportunity in Inmovel) and groups leads by their
 * pipeline `stage`. Mounted as a custom route at `/leads/kanban`.
 *
 * See adr/ADR-TASK-003-deal-to-lead-kanban-retarget.md
 */
const LeadKanban = () => {
  const { identity } = useGetIdentity();
  const { leadStages } = useConfigurationContext();
  if (!identity) return null;

  return (
    <List
      resource="contacts"
      // Distinct storeKey so the kanban's filters are independent from the
      // Contacts list (both read `contacts`). Without it they share
      // `contacts.listParams` and a filter set on one leaks into the other.
      storeKey="leadKanban"
      perPage={200}
      title="resources.contacts.name"
      sort={{ field: "last_seen", order: "DESC" }}
      filters={getLeadFilters(leadStages, { asesorAlwaysOn: true })}
      actions={<LeadKanbanActions />}
      pagination={null}
    >
      <div className="w-full">
        <LeadKanbanContent />
      </div>
    </List>
  );
};

const LeadKanbanActions = () => (
  <TopToolbar>
    <FilterButton />
    <SortButton
      fields={[
        "last_seen",
        "first_seen",
        "presupuesto_num",
        "total_mensajes",
        "stage",
      ]}
    />
  </TopToolbar>
);

export default LeadKanban;
