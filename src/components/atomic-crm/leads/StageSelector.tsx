import { useRecordContext, useUpdate, useNotify } from "ra-core";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { isStageEditable } from "./stages";
import type { Contact } from "../types";

/**
 * Per-lead stage picker for the lead detail (mobile-first; the desktop kanban is
 * the drag-and-drop equivalent). Gated to advisor-owned stages: S1..S5 are
 * sync-owned (read-only), so for those we only show the label. Only editable
 * stages (S6 onward + descartado) are offered as targets, so a change never
 * fights the next sync.
 */
export const StageSelector = () => {
  const record = useRecordContext<Contact>();
  const { leadStages } = useConfigurationContext();
  const notify = useNotify();
  const [update, { isPending }] = useUpdate();

  if (!record?.stage) return null;

  const currentLabel =
    leadStages.find((s) => s.value === record.stage)?.label ?? record.stage;

  if (!isStageEditable(record.stage)) {
    return (
      <p className="text-sm text-muted-foreground">
        {currentLabel} · controlada por el sistema
      </p>
    );
  }

  const editableStages = leadStages.filter((s) => isStageEditable(s.value));

  const handleChange = (value: string) => {
    if (value === record.stage) return;
    update(
      "contacts",
      { id: record.id, data: { stage: value }, previousData: record },
      {
        onSuccess: () => notify("Etapa actualizada", { type: "info" }),
        onError: () =>
          notify("No se pudo actualizar la etapa", { type: "error" }),
      },
    );
  };

  return (
    <Select
      value={record.stage}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {editableStages.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
