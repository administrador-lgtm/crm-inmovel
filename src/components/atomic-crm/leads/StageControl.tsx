import { useState } from "react";
import {
  useGetIdentity,
  useNotify,
  useRecordContext,
  useTranslate,
  useUpdate,
} from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import {
  DEFAULT_LEAD_STAGE,
  findLeadStageLabel,
  isStageEditable,
} from "./stages";

const DISCARDED_STAGE = "descartado";
const CIERRE_STAGE = "S10";

/**
 * The stage-ownership frontier, surfaced on the lead show page:
 *  - Stages S1..S5 are sync-owned: rendered as a read-only badge, no editing.
 *  - At S5 an advisor accepts the handoff via the "Asesor aceptó" button
 *    (sets stage = S6), the only way to cross into CRM-owned territory.
 *  - Stages S6..S10 + Descartado are advisor-set via the dropdown (skipping
 *    allowed). Selecting "Descartado" requires a motivo_descarte.
 *  - Setting S10 (Cierre) is gated to admins/managers.
 */
export const StageControl = () => {
  const record = useRecordContext<Contact>();
  const { leadStages } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const notify = useNotify();
  const [update] = useUpdate<Contact>();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (!record) return null;

  const currentStage = record.stage ?? DEFAULT_LEAD_STAGE;
  const isAdmin = Boolean(identity?.administrator);

  const persist = (data: Partial<Contact>) =>
    update(
      "contacts",
      { id: record.id, data, previousData: record },
      {
        mutationMode: "optimistic",
        onError: (error) =>
          notify(
            typeof error === "string"
              ? error
              : error?.message || "ra.notification.http_error",
            { type: "error" },
          ),
      },
    );

  const handleStageChange = (next: string) => {
    if (next === currentStage) return;
    if (next === DISCARDED_STAGE) {
      setDiscardOpen(true);
      return;
    }
    persist({ stage: next });
  };

  const confirmDiscard = () => {
    if (!motivo.trim()) return;
    persist({ stage: DISCARDED_STAGE, motivo_descarte: motivo.trim() });
    setDiscardOpen(false);
    setMotivo("");
  };

  // S1..S5 — sync-owned, read-only badge.
  if (!isStageEditable(currentStage)) {
    const isHandoffSent = currentStage === "S5";
    return (
      <div className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          {findLeadStageLabel(leadStages, currentStage) ?? currentStage}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {translate("crm.leads.stage_read_only", {
            _: "Esta etapa la gestiona el sistema y no se puede modificar manualmente.",
          })}
        </span>
        {isHandoffSent && (
          <Button
            size="sm"
            className="w-fit"
            onClick={() => persist({ stage: "S6" })}
          >
            {translate("crm.leads.accept_handoff", { _: "Asesor aceptó" })}
          </Button>
        )}
      </div>
    );
  }

  // S6..S10 + Descartado — advisor-set dropdown. S10 hidden for non-admins.
  const selectableStages = leadStages.filter((stage) => {
    if (isStageEditable(stage.value) === false) return false;
    if (stage.value === CIERRE_STAGE && !isAdmin) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-2">
      <Select value={currentStage} onValueChange={handleStageChange}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {selectableStages.map((stage) => (
            <SelectItem key={stage.value} value={stage.value}>
              {stage.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentStage === DISCARDED_STAGE && record.motivo_descarte && (
        <span className="text-xs text-muted-foreground">
          {translate("crm.leads.discard_reason", { _: "Motivo" })}:{" "}
          {record.motivo_descarte}
        </span>
      )}

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {translate("crm.leads.discard_title", { _: "Descartar lead" })}
            </DialogTitle>
            <DialogDescription>
              {translate("crm.leads.discard_hint", {
                _: "Indica el motivo del descarte. Es obligatorio.",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo_descarte">
              {translate("crm.leads.discard_reason", { _: "Motivo" })}
            </Label>
            <Textarea
              id="motivo_descarte"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder={translate("crm.leads.discard_placeholder", {
                _: "Ej. sin respuesta, presupuesto insuficiente…",
              })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              {translate("ra.action.cancel", { _: "Cancelar" })}
            </Button>
            <Button onClick={confirmDiscard} disabled={!motivo.trim()}>
              {translate("crm.leads.discard_confirm", { _: "Descartar" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
