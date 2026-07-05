import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGetList } from "ra-core";
import { UserPlus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HandoffRow = {
  id: number;
  lead_name: string | null;
  stage: string;
  operacion: string | null;
  desarrollo_activo: string | null;
  zona_interes: string | null;
  presupuesto: string | null;
  telefono: string | null;
  first_seen: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  S4: "Handoff ready",
  S5: "Handoff enviado",
};

const DISPLAY_CAP = 50;

const distinct = (rows: HandoffRow[], key: keyof HandoffRow): string[] =>
  [
    ...new Set(
      rows.map((r) => (r[key] ?? "").toString().trim()).filter(Boolean),
    ),
  ].sort();

const fmtEntry = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};

/**
 * ⑤ Handoff-ready leads not yet claimed by an advisor (S4/S5, no asesor). Ordered
 * by entry date (oldest waiting first), filterable by operation / property / zone,
 * scroll-capped at 50. RLS makes this effectively an admin/revops worklist.
 */
export const HandoffUnassignedWidget = () => {
  const [op, setOp] = useState<string>("all");
  const [prop, setProp] = useState<string>("all");
  const [zona, setZona] = useState<string>("all");

  const { data } = useGetList<HandoffRow>("dashboard_handoff_unassigned", {
    sort: { field: "first_seen", order: "ASC" }, // oldest waiting first
    pagination: { page: 1, perPage: 500 },
  });
  const rows = useMemo(() => data ?? [], [data]);

  const opts = useMemo(
    () => ({
      ops: distinct(rows, "operacion"),
      props: distinct(rows, "desarrollo_activo"),
      zonas: distinct(rows, "zona_interes"),
    }),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (op === "all" || (r.operacion ?? "") === op) &&
          (prop === "all" || (r.desarrollo_activo ?? "") === prop) &&
          (zona === "all" || (r.zona_interes ?? "") === zona),
      ),
    [rows, op, prop, zona],
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Handoff-ready sin asignar
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} en cola
          </span>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <Select value={op} onValueChange={setOp}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Operación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Operación</SelectItem>
              {opts.ops.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prop} onValueChange={setProp}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Propiedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Propiedad</SelectItem>
              {opts.props.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={zona} onValueChange={setZona}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Zona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Zona</SelectItem>
              {opts.zonas.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length > 0 ? (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {filtered.slice(0, DISPLAY_CAP).map((r) => (
              <li key={r.id}>
                <Link
                  to={`/contacts/${r.id}/show`}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.lead_name || `#${r.id}`}
                  </span>
                  {r.zona_interes ? (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                      {r.zona_interes}
                    </span>
                  ) : null}
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {fmtEntry(r.first_seen)}
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
            Nada pendiente con esos filtros.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
