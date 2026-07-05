import { useMemo, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";

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

const pad2 = (n: number) => String(n).padStart(2, "0");
const toLocalString = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** "2026-06-28T17:00" for a datetime-local input, from an ISO/date string. */
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return toLocalString(d);
};

/** Default slot when the lead has no proposed date: today, next full hour. */
const defaultVisitLocal = (): string => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalString(d);
};

const formatHuman = (local: string): string => {
  if (!local) return "—";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
};

/**
 * Pull an external listing code out of a pasted URL or a bare code.
 * NocNok/Lamudi fichas end in "...-id-nn-gwa527"; a bare "NN-GWA527" is also fine.
 */
const extractCodigo = (raw: string): string => {
  const t = raw.trim();
  const m = t.match(/id-([a-z0-9-]+)\/?(?:[?#].*)?$/i);
  if (m) return m[1].toUpperCase();
  return t.toUpperCase();
};

/** External inventory row shape (from the `inventario_externo` view). */
type InventarioExterno = {
  id: string | number;
  codigo?: string | null;
  title?: string | null;
  colonia?: string | null;
  alcaldia?: string | null;
  url_ficha?: string | null;
  lat_num?: number | null;
  lng_num?: number | null;
};

type Mode = "propia" | "url";
type MatchState = "idle" | "searching" | "found" | "notfound";

/**
 * "Agendar visita" journey: the advisor confirms property / date / time and sees
 * a live preview of the calendar invite AND the WhatsApp confirmation the lead
 * will get. The property can be an OWN one (dropdown) or ANY external listing via
 * "URL libre" — paste the URL/code and it auto-fills from inventario_externo (or
 * type the title by hand). On confirm the `agendar_visita` edge function creates
 * the Calendar event + optional WA and mirrors it into `visitas`.
 */
export const AgendarVisitaDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const lead = useRecordContext<Contact>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [submitting, setSubmitting] = useState(false);

  const { data: propiedades } = useGetList<Propiedad>("propiedades", {
    sort: { field: "nombre", order: "ASC" },
    pagination: { page: 1, perPage: 300 },
  });

  const [mode, setMode] = useState<Mode>("propia");
  const [propiedadId, setPropiedadId] = useState<string>(
    lead?.desarrollo_activo ?? "",
  );

  // "URL libre" state — the pasted input, the lookup status, and the resolved
  // (auto-filled or manually entered) snapshot fields.
  const [urlInput, setUrlInput] = useState<string>("");
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [extNombre, setExtNombre] = useState<string>("");
  const [extDireccion, setExtDireccion] = useState<string>("");
  const [extUrlMaps, setExtUrlMaps] = useState<string>("");
  const [extCodigo, setExtCodigo] = useState<string>("");

  const [fecha, setFecha] = useState<string>(
    toLocalInput(lead?.fecha_visita_propuesta) || defaultVisitLocal(),
  );
  const [duracion, setDuracion] = useState<string>("60");
  const [enviarConfirmacion, setEnviarConfirmacion] = useState<boolean>(true);

  const propiedad = useMemo(
    () => propiedades?.find((p) => p.id === propiedadId),
    [propiedades, propiedadId],
  );

  const lookupExterna = async () => {
    const raw = urlInput.trim();
    if (!raw) return;
    setMatchState("searching");
    const codigo = extractCodigo(raw);
    try {
      const { data } = await dataProvider.getList<InventarioExterno>(
        "inventario_externo",
        {
          filter: { "codigo@eq": codigo },
          sort: { field: "title", order: "ASC" },
          pagination: { page: 1, perPage: 1 },
        },
      );
      const row = data?.[0];
      if (row) {
        const zona = [row.colonia, row.alcaldia].filter(Boolean).join(", ");
        setExtNombre(row.title || `Anuncio ${codigo}`);
        setExtDireccion(zona);
        setExtCodigo(String(row.codigo || codigo));
        setExtUrlMaps(
          row.lat_num != null && row.lng_num != null
            ? `https://maps.google.com/?q=${row.lat_num},${row.lng_num}`
            : zona
              ? `https://maps.google.com/?q=${encodeURIComponent(zona)}`
              : "",
        );
        setMatchState("found");
      } else {
        // Not in our inventory — still schedulable; advisor types the title.
        setExtCodigo(codigo);
        setMatchState("notfound");
      }
    } catch {
      setExtCodigo(codigo);
      setMatchState("notfound");
    }
  };

  if (!lead) return null;

  const leadName = lead.nombre || lead.first_name || "el lead";
  const asesor = lead.asesor_nombre || "tu asesor";
  const hasPhone = Boolean(leadPhone(lead));

  // Unified selected-property view for preview + submit.
  const selNombre = mode === "propia" ? propiedad?.nombre : extNombre;
  const selDireccion = mode === "propia" ? propiedad?.direccion : extDireccion;
  const selReady =
    mode === "propia" ? Boolean(propiedadId) : Boolean(urlInput && extNombre);
  const ready = Boolean(selReady && fecha);
  const willNotify = enviarConfirmacion && hasPhone;

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    const body =
      mode === "propia"
        ? {
            lead_id: lead.id,
            propiedad_id: propiedadId,
            fecha: new Date(fecha).toISOString(),
            duracion: Number(duracion),
            enviar_confirmacion: willNotify,
          }
        : {
            lead_id: lead.id,
            propiedad_id: extCodigo || urlInput,
            fuente: "externa",
            propiedad_nombre: extNombre,
            propiedad_direccion: extDireccion || undefined,
            propiedad_url_maps: extUrlMaps || undefined,
            propiedad_url: urlInput,
            fecha: new Date(fecha).toISOString(),
            duracion: Number(duracion),
            enviar_confirmacion: willNotify,
          };
    const { data, error } = await getSupabaseClient().functions.invoke(
      "agendar_visita",
      { body },
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
          {/* Property source toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "propia" ? "default" : "outline"}
              onClick={() => setMode("propia")}
            >
              Propia
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "url" ? "default" : "outline"}
              onClick={() => setMode("url")}
            >
              Otra (URL)
            </Button>
          </div>

          {/* Property — own dropdown */}
          {mode === "propia" ? (
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
          ) : (
            /* Property — external "URL libre" */
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ext_url">URL o código del anuncio</Label>
                <div className="flex gap-2">
                  <Input
                    id="ext_url"
                    placeholder="https://app.nocnok.com/… o NN-GWA527"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setMatchState("idle");
                    }}
                    onBlur={lookupExterna}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={lookupExterna}
                    disabled={!urlInput || matchState === "searching"}
                  >
                    Buscar
                  </Button>
                </div>
                {matchState === "found" ? (
                  <p className="text-xs text-green-600">
                    ✓ Encontrada{extDireccion ? ` · ${extDireccion}` : ""}
                  </p>
                ) : matchState === "notfound" ? (
                  <p className="text-xs text-amber-600">
                    No está en nuestro inventario — escribe el título abajo.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ext_nombre">Título de la propiedad</Label>
                <Input
                  id="ext_nombre"
                  placeholder="Ej. Depto en venta, Narvarte"
                  value={extNombre}
                  onChange={(e) => setExtNombre(e.target.value)}
                />
              </div>
            </div>
          )}

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
                Visita — {leadName} — {selNombre || "(elige propiedad)"}
              </p>
              <p>📅 {formatHuman(fecha)}</p>
              <p className={cn(!selDireccion && "text-muted-foreground")}>
                📍 {selDireccion || "(sin dirección)"}
              </p>
              <p>👤 Te atiende: {asesor}</p>
            </div>
            <div className="mt-3 border-t pt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                WhatsApp al lead
              </p>
              <p className="text-muted-foreground">
                ¡Hola {leadName}! 👋 Confirmamos tu visita: 🏠 {""}
                {selNombre || "…"} · {formatHuman(fecha)} · 👤 {asesor}.
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
