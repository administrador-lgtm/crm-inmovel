import { InfiniteListBase } from "ra-core";

import { ActivityLogContext } from "./ActivityLogContext";
import { ActivityLogIterator } from "./ActivityLogIterator";

type ActivityLogProps = {
  pageSize?: number;
  context?: "contact" | "deal" | "all";
};

export function ActivityLog({ pageSize = 20, context = "all" }: ActivityLogProps) {
  return (
    <ActivityLogContext.Provider value={context}>
      <InfiniteListBase
        resource="activity_log"
        filter={{}}
        sort={{ field: "date", order: "DESC" }}
        perPage={pageSize}
        disableSyncWithLocation
      >
        <ActivityLogIterator />
      </InfiniteListBase>
    </ActivityLogContext.Provider>
  );
}
