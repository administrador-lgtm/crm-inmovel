import { useEffect, useMemo, useState } from "react";
import {
  useCanAccess,
  useGetIdentity,
  useGetList,
  useTranslate,
} from "ra-core";
import { ChevronLeft, ChevronRight, MapPin, MessageCircle } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { VisitaAgenda } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { findLeadStageLabel } from "./stages";

const ADVISOR_COLORS = [
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#ca8a04",
  "#4f46e5",
];

const UNASSIGNED_KEY = "none";

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addDays = (d: Date, n: number): Date => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Local (not UTC) yyyy-mm-dd key, so day grouping matches the user's timezone. */
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const advisorKey = (id: VisitaAgenda["asesor_id"]): string =>
  id == null ? UNASSIGNED_KEY : String(id);

const waLink = (visita: VisitaAgenda): string | null => {
  const number = visita.lead_phone?.find((p) => p.number)?.number;
  if (!number) return null;
  return `https://wa.me/${number.replace(/\D/g, "")}`;
};

type Advisor = { key: string; name: string; color: string };

/**
 * Visits Agenda — a "day + timeline" view of scheduled visits.
 *
 * Reads the `visitas_agenda` view (visit joined with lead/advisor/property).
 * A day strip on top (with per-day counts) selects the day; the timeline below
 * lists that day's visits. Advisor "layers" are additive colored toggles —
 * admins start with all advisors on, a regular advisor starts with only their
 * own. Visits are scheduled from the lead ficha, not here (read-only screen).
 */
export const VisitasAgenda = () => {
  const translate = useTranslate();
  const { leadStages } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const { canAccess: isAdmin } = useCanAccess({
    resource: "sales",
    action: "list",
  });

  const [today] = useState(() => startOfDay(new Date()));
  const [stripStart, setStripStart] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [activeAdvisors, setActiveAdvisors] = useState<Set<string> | null>(
    null,
  );

  // Fetch a generous window once and group client-side — visit volume is low,
  // so this avoids a refetch on every day/week navigation.
  const windowStart = useMemo(() => addDays(today, -7), [today]);
  const windowEnd = useMemo(() => addDays(today, 120), [today]);

  const { data: visitas, isPending } = useGetList<VisitaAgenda>(
    "visitas_agenda",
    {
      filter: {
        "fecha@gte": windowStart.toISOString(),
        "fecha@lt": windowEnd.toISOString(),
      },
      sort: { field: "fecha", order: "ASC" },
      pagination: { page: 1, perPage: 500 },
    },
  );

  // Distinct advisors present in the window, sorted by name, each with a color.
  const advisors = useMemo<Advisor[]>(() => {
    const byKey = new Map<string, string>();
    (visitas ?? []).forEach((v) => {
      const key = advisorKey(v.asesor_id);
      if (!byKey.has(key)) {
        byKey.set(
          key,
          key === UNASSIGNED_KEY
            ? translate("crm.agenda.unassigned", { _: "Sin asesor" })
            : (v.asesor_name ?? `#${key}`),
        );
      }
    });
    return Array.from(byKey.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, name], i) => ({
        key,
        name,
        color: ADVISOR_COLORS[i % ADVISOR_COLORS.length],
      }));
  }, [visitas, translate]);

  // Seed the active advisor layers once data + identity are known.
  useEffect(() => {
    if (activeAdvisors != null || visitas == null || advisors.length === 0) {
      return;
    }
    if (isAdmin) {
      setActiveAdvisors(new Set(advisors.map((a) => a.key)));
    } else {
      const own = identity?.id != null ? String(identity.id) : null;
      setActiveAdvisors(new Set(own ? [own] : advisors.map((a) => a.key)));
    }
  }, [activeAdvisors, visitas, advisors, isAdmin, identity]);

  const colorByKey = useMemo(() => {
    const m = new Map<string, string>();
    advisors.forEach((a) => m.set(a.key, a.color));
    return m;
  }, [advisors]);

  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    (visitas ?? []).forEach((v) => {
      if (activeAdvisors && !activeAdvisors.has(advisorKey(v.asesor_id)))
        return;
      const key = dayKey(new Date(v.fecha));
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return m;
  }, [visitas, activeAdvisors]);

  const dayVisits = useMemo(() => {
    const selKey = dayKey(selectedDate);
    return (visitas ?? [])
      .filter((v) => dayKey(new Date(v.fecha)) === selKey)
      .filter(
        (v) => !activeAdvisors || activeAdvisors.has(advisorKey(v.asesor_id)),
      )
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [visitas, selectedDate, activeAdvisors]);

  const stripDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(stripStart, i)),
    [stripStart],
  );

  const toggleAdvisor = (key: string) => {
    setActiveAdvisors((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const goToday = () => {
    setStripStart(today);
    setSelectedDate(today);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          {translate("crm.navigation.visitas", { _: "Visitas" })}
        </h1>
        <Button variant="outline" size="sm" onClick={goToday}>
          {translate("crm.agenda.today", { _: "Hoy" })}
        </Button>
      </div>

      {/* Day strip */}
      <div className="flex items-center gap-1 mb-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate("crm.agenda.prev_week", {
            _: "Semana anterior",
          })}
          onClick={() => setStripStart((d) => addDays(d, -7))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {stripDays.map((d) => {
            const key = dayKey(d);
            const count = countByDay.get(key) ?? 0;
            const isSelected = key === dayKey(selectedDate);
            const isToday = key === dayKey(today);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "flex flex-col items-center rounded-md py-1.5 text-xs border transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted border-transparent",
                )}
              >
                <span className="capitalize">
                  {d.toLocaleDateString("es-MX", { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "text-base font-semibold leading-tight",
                    isToday && !isSelected && "text-primary",
                  )}
                >
                  {d.getDate()}
                </span>
                <span
                  className={cn(
                    "mt-0.5 min-h-4 rounded-full px-1.5 text-[0.65rem] leading-4",
                    count > 0
                      ? isSelected
                        ? "bg-primary-foreground/20"
                        : "bg-muted-foreground/15"
                      : "opacity-0",
                  )}
                >
                  {count > 0 ? count : "0"}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={translate("crm.agenda.next_week", {
            _: "Semana siguiente",
          })}
          onClick={() => setStripStart((d) => addDays(d, 7))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* Advisor layers */}
      {advisors.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {advisors.map((a) => {
            const on = !activeAdvisors || activeAdvisors.has(a.key);
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => toggleAdvisor(a.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity",
                  on ? "opacity-100" : "opacity-40",
                )}
                style={{ borderColor: a.color }}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: a.color }}
                />
                {a.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <h2 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
        {selectedDate.toLocaleDateString("es-MX", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </h2>

      {isPending ? (
        <p className="text-sm text-muted-foreground">
          {translate("ra.page.loading", { _: "Cargando…" })}
        </p>
      ) : dayVisits.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {translate("crm.agenda.empty", {
            _: "Sin visitas este día.",
          })}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dayVisits.map((v) => {
            const color = colorByKey.get(advisorKey(v.asesor_id)) ?? "#94a3b8";
            const wa = waLink(v);
            const stageLabel = v.stage
              ? (findLeadStageLabel(leadStages, v.stage) ?? v.stage)
              : null;
            return (
              <Card key={v.id} className="overflow-hidden">
                <CardContent className="flex gap-3 py-3">
                  <div className="flex flex-col items-center w-12 shrink-0">
                    <span className="text-sm font-semibold">
                      {new Date(v.fecha).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className="mt-1 h-full w-1 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/contacts/${v.lead_id}/show`}
                        className="font-medium truncate hover:underline"
                      >
                        {v.lead_name ?? `#${v.lead_id}`}
                      </Link>
                      {v.estado && v.estado !== "confirmada" && (
                        <span className="text-[0.65rem] rounded px-1.5 py-0.5 bg-destructive/10 text-destructive shrink-0">
                          {v.estado}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {v.propiedad_name ??
                        translate("crm.agenda.no_property", {
                          _: "Sin propiedad",
                        })}
                      {v.asesor_name ? ` · ${v.asesor_name}` : ""}
                      {stageLabel ? ` · ${stageLabel}` : ""}
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {v.url_maps && (
                        <a
                          href={v.url_maps}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <MapPin className="size-3.5" />
                          {translate("crm.agenda.maps", { _: "Maps" })}
                        </a>
                      )}
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <MessageCircle className="size-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default VisitasAgenda;
