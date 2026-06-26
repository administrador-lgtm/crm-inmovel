import { useMemo, useState } from "react";
import { useGetList, useNotify, useRecordContext, useRefresh } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { Contact, Propiedad } from "../types";
import { getSupabaseClient } from "../providers/supabase/supabase";

/** Lead's first non-empty phone (jsonb or the synced `telefono`). */
const leadPhone = (lead: Contact): string | undefined =>
  lead.phone_jsonb?.find((p) => p.number)?.number ||
  (lead as unknown as { telefono?: string }).telefono ||
  undefined;

/** "2026-06-28T17:00" for a datetime-local input, from an ISO/date string. */
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatHuman = (local: string): string => {
  if (!local) return "—";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
};

/**
 * "Agendar visita" journey: the advisor confirms property / date / time and sees
 * a live preview of the calendar invite AND the WhatsApp confirmation the lead
 * will get — both composed from the confirmed fields. On confirm it creates the
 * `visitas` row (CRM mirror). Creating the actual Calendar event + the WA send is
 * wired in the next step. See docs/VISITAS-CALENDAR.md.
 */
export const AgendarVisitaDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const lead = useRecordContext<Contact>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [submitting, setSubmitting] = useState(false);

  const { data: propiedades } = useGetList<Propiedad>("propiedades", {
    sort: { field: "nombre", order: "ASC" },
    pagination: { page: 1, perPage: 300 },
  });

  const [propiedadId, setPropiedadId] = useState<string>(
    lead?.desarrollo_activo ?? "",
  );
  const [fecha, setFecha] = useState<string>(
    toLocalInput(lead?.fecha_visita_propuesta),
  );
  const [duracion, setDuracion] = useState<string>("60");
  const [enviarConfirmacion, setEnviarConfirmacion] = useState<boolean>(true);

  const propiedad = useMemo(
    () => propiedades?.find((p) => p.id === propiedadId),
    [propiedades, propiedadId],
  );

  if (!lead) return null;

  const leadName = lead.nombre || lead.first_name || "el lead";
  const asesor = lead.asesor_nombre || "tu asesor";
  const direccion = propiedad?.direccion;
  const hasPhone = Boolean(leadPhone(lead));
  const ready = Boolean(propiedadId && fecha);
  // Whether to fire the WhatsApp confirmation (only possible with a phone). The
  // actual WABA send is wired with the `visita_confirmada` template; this captures
  // the advisor's choice at confirm time.
  const willNotify = enviarConfirmacion && hasPhone;

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    const { data, error } = await getSupabaseClient().functions.invoke(
      "agendar_visita",
      {
        body: {
          lead_id: lead.id,
          propiedad_id: propiedadId,
          fecha: new Date(fecha).toISOString(),
          duracion: Number(duracion),
          enviar_confirmacion: willNotify,
        },
      },
    );
    setSubmitting(false);
    if (error || (data && (data as { error?: string }).error)) {
      notify("No se pudo agendar la visita", { type: "error" });
      return;
    }
    onOpenChange(false);
    notify("Visita agendada", { type: "info" });
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar visita</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Property */}
          <div className="flex flex-col gap-1">
            <Label>Propiedad</Label>
            <Select value={propiedadId} onValueChange={setPropiedadId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige la propiedad" />
              </SelectTrigger>
              <SelectContent>
                {propiedades?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date + time */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="agendar_fecha">Fecha y hora</Label>
            <Input
              id="agendar_fecha"
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-1">
            <Label>Duración</Label>
            <Select value={duracion} onValueChange={setDuracion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1 hora 30 min</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Live preview */}
          <div className="mt-1 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Vista previa
            </p>
            <div className="space-y-1">
              <p>
                🗓️ <span className="font-medium">Invite (calendario):</span>{" "}
                Visita — {leadName} — {propiedad?.nombre ?? "(elige propiedad)"}
              </p>
              <p>📅 {formatHuman(fecha)}</p>
              <p className={cn(!direccion && "text-muted-foreground")}>
                📍 {direccion ?? "(la propiedad no tiene dirección)"}
              </p>
              <p>👤 Te atiende: {asesor}</p>
            </div>
            <div className="mt-3 border-t pt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                WhatsApp al lead
              </p>
              <p className="text-muted-foreground">
                ¡Hola {leadName}! 👋 Confirmamos tu visita: 🏠 {""}
                {propiedad?.nombre ?? "…"} · {formatHuman(fecha)} · 👤 {asesor}.
                {leadPhone(lead)
                  ? ""
                  : " (el lead no tiene teléfono — no se enviará WhatsApp)"}
              </p>
            </div>
          </div>

          {/* Send confirmation to the lead? (fires the WhatsApp confirmation) */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="enviar_wa" className="text-sm">
              ¿Enviar confirmación al prospecto por WhatsApp?
            </Label>
            <Switch
              id="enviar_wa"
              checked={willNotify}
              disabled={!hasPhone}
              onCheckedChange={setEnviarConfirmacion}
            />
          </div>
          {!hasPhone ? (
            <p className="-mt-1 text-xs text-muted-foreground">
              El lead no tiene teléfono — no se enviará confirmación.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!ready || submitting}>
            Confirmar y agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
