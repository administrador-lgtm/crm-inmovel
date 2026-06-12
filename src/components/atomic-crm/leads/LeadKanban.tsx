import { useGetIdentity } from "ra-core";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";

import { TopToolbar } from "../layout/TopToolbar";
import { LeadKanbanContent } from "./LeadKanbanContent";

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
  if (!identity) return null;

  const leadFilters = [<SearchInput source="q" alwaysOn />];

  return (
    <List
      resource="contacts"
      perPage={200}
      title="resources.contacts.name"
      sort={{ field: "last_seen", order: "DESC" }}
      filters={leadFilters}
      actions={<LeadKanbanActions />}
      pagination={null}
    >
      <div className="w-full">
        <LeadKanbanContent />
      </div>
    </List>
  );
};

const LeadKanbanActions = () => <TopToolbar />;

export default LeadKanban;
