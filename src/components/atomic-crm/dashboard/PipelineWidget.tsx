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

import { defaultLeadStages } from "../root/defaultConfiguration";
import type { Sale } from "../types";

type PipelineRow = {
  id: string;
  stage: string;
  asesor_id: number | null;
  leads: number;
};

/** Ordered funnel stages, excluding descartado (which the view already omits). */
const STAGES = defaultLeadStages.filter((s) => s.value !== "descartado");

const contactsFilterHref = (stage: string, asesorId: string): string => {
  const filter: Record<string, unknown> = { "stage@eq": stage };
  if (asesorId !== "all") filter["asesor_asignado@eq"] = asesorId;
  return `/contacts?filter=${encodeURIComponent(JSON.stringify(filter))}`;
};

/** ① Pipeline — lead count per stage (S1..S10). Clickable, filterable by advisor. */
export const PipelineWidget = () => {
  const [asesor, setAsesor] = useState<string>("all");
  const { data: rows } = useGetList<PipelineRow>("dashboard_pipeline", {
    pagination: { page: 1, perPage: 500 },
  });
  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "first_name", order: "ASC" },
  });

  const byStage = useMemo(() => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => {
      if (asesor !== "all" && String(r.asesor_id ?? "") !== asesor) return;
      m.set(r.stage, (m.get(r.stage) ?? 0) + r.leads);
    });
    return m;
  }, [rows, asesor]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Pipeline
          </h2>
          <Select value={asesor} onValueChange={setAsesor}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los asesores</SelectItem>
              {sales?.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.first_name} {s.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <Link
              key={s.value}
              to={contactsFilterHref(s.value, asesor)}
              className="flex min-w-[84px] flex-1 flex-col items-center rounded-md border p-2 hover:bg-accent"
            >
              <span className="text-xs text-muted-foreground">{s.value}</span>
              <span className="text-xl font-semibold tabular-nums">
                {byStage.get(s.value) ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {s.label}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
