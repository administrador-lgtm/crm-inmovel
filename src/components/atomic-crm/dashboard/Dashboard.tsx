import { useGetList } from "ra-core";

import type { Contact } from "../types";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { HotContacts } from "./HotContacts";
import { Welcome } from "./Welcome";

export const Dashboard = () => {
  const { isPending } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1 },
  });

  if (isPending) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-1">
      <div className="md:col-span-3">
        <div className="flex flex-col gap-4">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          <HotContacts />
        </div>
      </div>
      <div className="md:col-span-6">
        <div className="flex flex-col gap-6">
          <DashboardActivityLog />
        </div>
      </div>
    </div>
  );
};
