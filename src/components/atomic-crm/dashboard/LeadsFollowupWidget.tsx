import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGetList } from "ra-core";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Sale } from "../types";

type FollowupRow = {
  id: number;
  asesor_id: number | null;
  lead_name: string | null;
  stage: string;
  sin_contacto: boolean;
  sin_visita: boolean;
};

/** ③ Leads que requieren acción — sin contacto (Baileys) y sin visita. Filtro por asesor. */
export const LeadsFollowupWidget = () => {
  const [asesor, setAsesor] = useState<string>("all");
  const { data: rows } = useGetList<FollowupRow>("dashboard_followup", {
    pagination: { page: 1, perPage: 1000 },
  });
  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "first_name", order: "ASC" },
  });

  const { sinContacto, sinVisita } = useMemo(() => {
    let sc = 0;
    let sv = 0;
    (rows ?? []).forEach((r) => {
      const ok =
        asesor === "all"
          ? true
          : asesor === "unassigned"
            ? r.asesor_id == null
            : asesor === "assigned"
              ? r.asesor_id != null
              : String(r.asesor_id ?? "") === asesor;
      if (!ok) return;
      if (r.sin_contacto) sc += 1;
      if (r.sin_visita) sv += 1;
    });
    return { sinContacto: sc, sinVisita: sv };
  }, [rows, asesor]);

  // Only use filter sources the contacts list registers (sales_id), so the
  // applied filter is a visible, removable chip — never a hidden sticky one.
  // "Sin contacto"/"sin visita" aren't registered filters, so the drill lands on
  // the advisor's leads; the exact number lives in the card.
  const href = () => {
    const filter: Record<string, unknown> = {};
    if (asesor !== "all" && asesor !== "unassigned" && asesor !== "assigned")
      filter.sales_id = asesor;
    return `/contacts?filter=${encodeURIComponent(JSON.stringify(filter))}`;
  };

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Leads asignados
          </h2>
          <Select value={asesor} onValueChange={setAsesor}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (asignados + sin asignar)</SelectItem>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              <SelectItem value="assigned">Asignados (todos)</SelectItem>
              {sales?.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.first_name} {s.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={href()}
            className="flex flex-col rounded-md border border-red-300 bg-red-50 p-3 hover:bg-red-100"
          >
            <span className="text-2xl font-semibold tabular-nums text-red-700">
              {sinContacto}
            </span>
            <span className="text-xs text-red-700">Sin contacto del asesor</span>
          </Link>
          <Link
            to={href()}
            className="flex flex-col rounded-md border border-amber-300 bg-amber-50 p-3 hover:bg-amber-100"
          >
            <span className="text-2xl font-semibold tabular-nums text-amber-700">
              {sinVisita}
            </span>
            <span className="text-xs text-amber-700">Sin visita agendada</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
