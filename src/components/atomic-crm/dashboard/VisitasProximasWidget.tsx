import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGetList } from "ra-core";
import { CalendarDays } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { VisitaAgenda } from "../types";

const ymd = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Monday…Sunday of the current week, as YYYY-MM-DD. */
const currentWeek = (): { desde: string; hasta: string } => {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { desde: ymd(start), hasta: ymd(end) };
};

/** ② Visitas — visits in a selectable date range, grouped by advisor. */
export const VisitasProximasWidget = () => {
  const week = useMemo(currentWeek, []);
  const [desde, setDesde] = useState<string>(week.desde);
  const [hasta, setHasta] = useState<string>(week.hasta);

  // Query over the inclusive [desde, hasta] range (hasta covered through 23:59).
  const startIso = new Date(`${desde}T00:00:00`).toISOString();
  const endIso = new Date(`${hasta}T23:59:59`).toISOString();

  const { data: visitas } = useGetList<VisitaAgenda>("visitas_agenda", {
    filter: { "fecha@gte": startIso, "fecha@lte": endIso },
    sort: { field: "fecha", order: "ASC" },
    pagination: { page: 1, perPage: 500 },
  });

  const byAsesor = useMemo(() => {
    const m = new Map<string, number>();
    (visitas ?? []).forEach((v) => {
      const key = v.asesor_name || "Sin asesor";
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visitas]);

  const total = visitas?.length ?? 0;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Visitas ({total})
          </h2>
          <Link to="/visitas" className="ml-auto text-xs text-primary">
            ver agenda
          </Link>
        </div>

        <div className="mb-3 flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="vis_desde" className="text-[11px]">
              Desde
            </Label>
            <Input
              id="vis_desde"
              type="date"
              className="h-8 text-xs"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="vis_hasta" className="text-[11px]">
              Hasta
            </Label>
            <Input
              id="vis_hasta"
              type="date"
              className="h-8 text-xs"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
        </div>

        {byAsesor.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {byAsesor.map(([asesor, n]) => (
              <li
                key={asesor}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">{asesor}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin visitas en este rango.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
