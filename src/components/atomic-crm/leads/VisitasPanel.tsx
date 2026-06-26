import { useState } from "react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Contact, Propiedad, Visita } from "../types";
import { AgendarVisitaDialog } from "./AgendarVisitaDialog";

const formatDate = (value: string, locale: string) =>
  new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * Advisor-recorded visits for a lead: a read-only list plus a create dialog.
 * Visits are CRM-owned (never touched by the sheet sync).
 */
export const VisitasPanel = () => {
  const lead = useRecordContext<Contact>();
  const translate = useTranslate();
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const [create] = useCreate();
  const [open, setOpen] = useState(false);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [propiedadId, setPropiedadId] = useState("");
  const [fecha, setFecha] = useState("");
  const [resultado, setResultado] = useState("");
  const [notas, setNotas] = useState("");

  const { data: visitas } = useGetList<Visita>("visitas", {
    filter: { lead_id: lead?.id },
    sort: { field: "fecha", order: "DESC" },
    pagination: { page: 1, perPage: 50 },
  });

  const { data: propiedades } = useGetList<Propiedad>("propiedades", {
    sort: { field: "nombre", order: "ASC" },
    pagination: { page: 1, perPage: 200 },
  });

  if (!lead) return null;

  const reset = () => {
    setPropiedadId("");
    setFecha("");
    setResultado("");
    setNotas("");
  };

  const submit = () => {
    if (!fecha) return;
    create(
      "visitas",
      {
        data: {
          lead_id: lead.id,
          propiedad_id: propiedadId || null,
          fecha: new Date(fecha).toISOString(),
          resultado: resultado || null,
          notas: notas || null,
          asesor_id: lead.asesor_asignado ?? identity?.id,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
          notify("crm.visitas.created", {
            type: "info",
            messageArgs: { _: "Visita registrada" },
          });
        },
        onError: () => notify("ra.notification.http_error", { type: "error" }),
      },
    );
  };

  const propiedadName = (id?: string | null) =>
    propiedades?.find((p) => p.id === id)?.nombre ?? id ?? "";

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-md font-semibold">
            {translate("crm.visitas.title", { _: "Visitas" })}
          </h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAgendarOpen(true)}>
              {translate("crm.visitas.schedule", { _: "Agendar visita" })}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
            >
              {translate("crm.visitas.add", { _: "Registrar" })}
            </Button>
          </div>
        </div>

        <AgendarVisitaDialog open={agendarOpen} onOpenChange={setAgendarOpen} />

        {visitas && visitas.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visitas.map((visita) => (
              <li
                key={visita.id}
                className="border rounded-md p-2 text-sm flex flex-col"
              >
                <span className="font-medium">
                  {propiedadName(visita.propiedad_id)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(visita.fecha, "es-MX")}
                  {visita.resultado ? ` · ${visita.resultado}` : ""}
                </span>
                {visita.notas && <span className="mt-1">{visita.notas}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.visitas.empty", { _: "Sin visitas registradas." })}
          </p>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {translate("crm.visitas.add", { _: "Registrar visita" })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>
                {translate("crm.visitas.propiedad", { _: "Propiedad" })}
              </Label>
              <Select value={propiedadId} onValueChange={setPropiedadId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={translate("crm.visitas.propiedad", {
                      _: "Propiedad",
                    })}
                  />
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="visita_fecha">
                {translate("crm.visitas.fecha", { _: "Fecha" })}
              </Label>
              <Input
                id="visita_fecha"
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="visita_resultado">
                {translate("crm.visitas.resultado", { _: "Resultado" })}
              </Label>
              <Input
                id="visita_resultado"
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="visita_notas">
                {translate("crm.visitas.notas", { _: "Notas" })}
              </Label>
              <Textarea
                id="visita_notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {translate("ra.action.cancel", { _: "Cancelar" })}
            </Button>
            <Button onClick={submit} disabled={!fecha}>
              {translate("ra.action.save", { _: "Guardar" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
