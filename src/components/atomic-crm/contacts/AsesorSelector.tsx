import { useGetList, useNotify, useRecordContext, useUpdate } from "ra-core";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Contact, Sale } from "../types";

const UNASSIGNED = "__none__";

/**
 * Assign / reassign the lead's advisor from the ficha. Writes `sales_id` (the
 * canonical column); the sync_advisor_id trigger mirrors it to `asesor_asignado`
 * (what RLS reads). CRM assignment is sticky — the sheet sync only assigns a lead
 * that has none yet.
 */
export const AsesorSelector = () => {
  const record = useRecordContext<Contact>();
  const [update] = useUpdate<Contact>();
  const notify = useNotify();
  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "first_name", order: "ASC" },
  });

  if (!record) return null;

  const current =
    record.sales_id != null ? String(record.sales_id) : UNASSIGNED;

  const onChange = (v: string) => {
    const next = v === UNASSIGNED ? null : Number(v);
    if (String(record.sales_id ?? "") === String(next ?? "")) return;
    update(
      "contacts",
      {
        id: record.id,
        // null clears the assignment (unassign) — the column is nullable in the DB.
        data: { sales_id: next } as unknown as Partial<Contact>,
        previousData: record,
      },
      {
        mutationMode: "optimistic",
        onSuccess: () =>
          notify(next == null ? "Asesor removido" : "Asesor asignado", {
            type: "info",
          }),
        onError: (error) =>
          notify(
            typeof error === "string"
              ? error
              : error?.message || "ra.notification.http_error",
            { type: "error" },
          ),
      },
    );
  };

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Sin asignar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
        {sales?.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            {s.first_name} {s.last_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
