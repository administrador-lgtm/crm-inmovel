import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useGetList } from "ra-core";
import { CalendarDays } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { VisitaAgenda } from "../types";

/** Monday 00:00 of the current week, and the following Monday. */
const weekBounds = (): { start: string; end: string } => {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
};

/** ② Visitas próximas — this week's visits grouped by advisor. */
export const VisitasProximasWidget = () => {
  const { start, end } = useMemo(weekBounds, []);
  const { data: visitas } = useGetList<VisitaAgenda>("visitas_agenda", {
    filter: { "fecha@gte": start, "fecha@lt": end },
    sort: { field: "fecha", order: "ASC" },
    pagination: { page: 1, perPage: 300 },
  });

  const byAsesor = useMemo(() => {
    const m = new Map<string, number>();
    (visitas ?? []).forEach((v) => {
      const key = v.asesor_name || "Sin asesor";
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visitas]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Visitas de la semana
          </h2>
          <Link to="/visitas" className="ml-auto text-xs text-primary">
            ver agenda
          </Link>
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
            Sin visitas esta semana.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
