import { useGetList } from "ra-core";
import { MessagesSquare } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type Row = {
  id: number;
  asesor_id: number | null;
  asesor_name: string | null;
  leads_asignados: number;
  activas: number;
};

/**
 * Conversaciones activas vs leads asignados, por asesor. "Activa" (v1) = al menos
 * 3 mensajes del asesor y 3 del lead en los últimos 7 días (hilo de Baileys).
 */
export const ConversacionesActivasWidget = () => {
  const { data } = useGetList<Row>("dashboard_conversaciones_activas", {
    sort: { field: "activas", order: "DESC" },
    pagination: { page: 1, perPage: 100 },
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            Conversaciones activas
          </h2>
          <span className="ml-auto text-[10px] text-muted-foreground">
            ≥3 de cada lado · 7 días
          </span>
        </div>

        {data && data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {data.map((r) => {
              const pct =
                r.leads_asignados > 0
                  ? Math.round((r.activas / r.leads_asignados) * 100)
                  : 0;
              return (
                <li key={r.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="truncate">
                      {r.asesor_name || "Sin asesor"}
                    </span>
                    <span className="tabular-nums">
                      <span className="font-semibold">{r.activas}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        / {r.leads_asignados} activas
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        )}
      </CardContent>
    </Card>
  );
};
