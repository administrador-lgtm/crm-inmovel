import { Link } from "react-router-dom";
import { useGetList } from "ra-core";
import { UserPlus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type HandoffRow = {
  id: number;
  lead_name: string | null;
  stage: string;
  zona_interes: string | null;
  presupuesto: string | null;
  telefono: string | null;
  stage_changed_at: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  S4: "Handoff ready",
  S5: "Handoff enviado",
};

/**
 * ⑤ Handoff-ready leads not yet claimed by an advisor (S4/S5, no asesor). Scroll
 * list capped at 50, newest first. RLS makes this effectively an admin worklist.
 */
export const HandoffUnassignedWidget = () => {
  const { data: rows, total } = useGetList<HandoffRow>(
    "dashboard_handoff_unassigned",
    {
      sort: { field: "stage_changed_at", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Handoff-ready sin asignar
          </h2>
          {total != null ? (
            <span className="ml-auto text-xs text-muted-foreground">
              {total} en cola
            </span>
          ) : null}
        </div>
        {rows && rows.length > 0 ? (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/contacts/${r.id}/show`}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.lead_name || `#${r.id}`}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.zona_interes || ""}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {STAGE_LABEL[r.stage] ?? r.stage}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nada pendiente por asignar.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
