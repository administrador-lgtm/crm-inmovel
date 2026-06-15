import { InfiniteListBase, useGetIdentity, useListContext } from "ra-core";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { BulkDeleteButton } from "@/components/admin/bulk-delete-button";
import { CreateButton } from "@/components/admin/create-button";
import { FilterButton } from "@/components/admin/filter-form";
import { List } from "@/components/admin/list";
import { SelectAllButton } from "@/components/admin/select-all-button";
import { SortButton } from "@/components/admin/sort-button";
import { Card } from "@/components/ui/card";

import { ContactEmpty } from "./ContactEmpty";
import {
  ContactListContent,
  ContactListContentMobile,
} from "./ContactListContent";
import {
  ContactListFilterSummary,
  ContactListFilter,
} from "./ContactListFilter";
import { getLeadFilters } from "../leads/leadFilters";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { InfinitePagination } from "../misc/InfinitePagination";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";

export const ContactList = () => {
  const { identity } = useGetIdentity();
  const { leadStages } = useConfigurationContext();

  if (!identity) return null;

  return (
    <List
      title={false}
      actions={<ContactListActions />}
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      filters={getLeadFilters(leadStages)}
    >
      <ContactListLayoutDesktop />
    </List>
  );
};

const ContactListLayoutDesktop = () => {
  const { data, isPending, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div className="flex flex-row gap-8">
      <ContactListFilter />
      <div className="w-full flex flex-col gap-4">
        <Card className="py-0">
          <ContactListContent />
        </Card>
      </div>
      <BulkActionsToolbar>
        <ContactBulkActionButtons />
      </BulkActionsToolbar>
    </div>
  );
};

const ContactBulkActionButtons = () => (
  <>
    <SelectAllButton />
    <BulkDeleteButton />
  </>
);

const ContactListActions = () => (
  <TopToolbar>
    <FilterButton />
    <SortButton
      fields={[
        "first_name",
        "last_seen",
        "first_seen",
        "presupuesto_num",
        "total_mensajes",
        "stage",
      ]}
    />
    <CreateButton />
  </TopToolbar>
);

export const ContactListMobile = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <InfiniteListBase
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      queryOptions={{
        onError: () => {
          /* Disable error notification as ContactListLayoutMobile handles it */
        },
      }}
    >
      <ContactListLayoutMobile />
    </InfiniteListBase>
  );
};

const ContactListLayoutMobile = () => {
  const { isPending, data, error, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (!isPending && !data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div>
      <MobileHeader>
        <ContactListFilter />
      </MobileHeader>
      <MobileContent>
        <ContactListFilterSummary />
        <ContactListContentMobile />
        {!error && (
          <div className="flex justify-center">
            <InfinitePagination />
          </div>
        )}
      </MobileContent>
    </div>
  );
};
