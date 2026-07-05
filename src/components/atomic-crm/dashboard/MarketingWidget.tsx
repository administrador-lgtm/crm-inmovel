import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { getSupabaseClient } from "../providers/supabase/supabase";

type AdSet = {
  adset_id: string;
  name: string;
  spend: number;
  cpm: number;
  ctr: number;
  fr: number;
  cpl: number;
};
type Insights = {
  adsets: AdSet[];
  totals: { spend: number; fr: number; cpl: number };
  fetched_at?: string;
};

const PRESETS: { key: string; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

const money = (n: number) => `$${n.toLocaleString("es-MX")}`;

/** ④ Vista Marketing — live Meta ad insights (per ad set) with a Hoy/Semana/Mes toggle. */
export const MarketingWidget = () => {
  const [preset, setPreset] = useState<string>("today");
  const [data, setData] = useState<Insights | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    getSupabaseClient()
      .functions.invoke("meta_insights", { body: { preset } })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data || (data as { error?: string }).error) {
          setState("error");
          return;
        }
        setData(data as Insights);
        setState("ok");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [preset]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Vista Marketing
          </h2>
          <span className="ml-auto text-[10px] text-muted-foreground">
            Meta · live
          </span>
        </div>

        <div className="mb-3 flex gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {state === "loading" ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : state === "error" ? (
          <p className="text-sm text-muted-foreground">
            No se pudo cargar Meta.
          </p>
        ) : data && data.adsets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 text-left font-medium">Ad set</th>
                  <th className="py-1 text-right font-medium">Spend</th>
                  <th className="py-1 text-right font-medium">CPM</th>
                  <th className="py-1 text-right font-medium">CTR</th>
                  <th className="py-1 text-right font-medium">FR</th>
                  <th className="py-1 text-right font-medium">CPL</th>
                </tr>
              </thead>
              <tbody>
                {data.adsets.map((a) => (
                  <tr key={a.adset_id} className="border-t">
                    <td className="py-1 pr-2">{a.name}</td>
                    <td className="py-1 text-right tabular-nums">
                      {money(a.spend)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      ${a.cpm}
                    </td>
                    <td className="py-1 text-right tabular-nums">{a.ctr}%</td>
                    <td className="py-1 text-right tabular-nums">{a.fr}</td>
                    <td className="py-1 text-right font-medium tabular-nums">
                      {a.fr ? money(a.cpl) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold">
                  <td className="py-1 pr-2">Total</td>
                  <td className="py-1 text-right tabular-nums">
                    {money(data.totals.spend)}
                  </td>
                  <td />
                  <td />
                  <td className="py-1 text-right tabular-nums">
                    {data.totals.fr}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {data.totals.fr ? money(data.totals.cpl) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos en Meta.</p>
        )}
      </CardContent>
    </Card>
  );
};
