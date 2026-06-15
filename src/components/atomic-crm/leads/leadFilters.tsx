import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import type { RaRecord } from "ra-core";

import type { LeadStage } from "../types";

/**
 * Shared lead/contact metadata filter inputs, reused by both the contacts list
 * (`ContactList`) and the leads kanban (`LeadKanban`). A contact IS the lead in
 * Inmovel, so both views filter the same `contacts` resource over the
 * `contacts_summary` view fields.
 *
 * Operators follow the ra-data-postgrest convention (`field@operator`). The
 * adapter auto-wraps `ilike` values with wildcards, so text inputs behave as
 * "contains" without manual `%`. `presupuesto_num` is the numeric form of
 * `presupuesto` exposed by the view (free text → NULL), enabling a coherent
 * range filter — only meaningful once the operación filter is applied, since
 * the raw amounts mix monthly-rent and total-sale magnitudes.
 *
 * Labels are inline Spanish to match the existing list convention (see
 * `PropiedadList`); the app runs in Spanish for Inmovel advisors.
 */

const OPERACION_CHOICES = [
  { id: "venta", name: "Venta" },
  { id: "renta", name: "Renta" },
];

// `forma_compra` holds single values and combos ("bancario + contado"); the
// @ilike operator matches the option as a substring so combos are included.
const FORMA_COMPRA_CHOICES = [
  { id: "contado", name: "Contado" },
  { id: "bancario", name: "Bancario" },
  { id: "infonavit", name: "Infonavit" },
  { id: "fovissste", name: "Fovissste" },
];

const CANAL_CHOICES = [
  { id: "whatsapp", name: "WhatsApp" },
  { id: "messenger", name: "Messenger" },
];

const FUENTE_CHOICES = [{ id: "anuncio", name: "Anuncio" }];

const saleOptionText = (record?: RaRecord) =>
  record ? `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() : "";

/**
 * Build the filter-input array. `leadStages` comes from the configuration
 * context so the stage choices stay in sync with the configured pipeline.
 */
export const getLeadFilters = (leadStages: LeadStage[]) => [
  <SearchInput key="q" source="q" alwaysOn />,
  <SelectInput
    key="tipo_busqueda"
    source="tipo_busqueda"
    label="Operación"
    choices={OPERACION_CHOICES}
  />,
  <TextInput key="zona_interes" source="zona_interes@ilike" label="Zona" />,
  <NumberInput
    key="presupuesto_min"
    source="presupuesto_num@gte"
    label="Presupuesto mín."
    min={0}
  />,
  <NumberInput
    key="presupuesto_max"
    source="presupuesto_num@lte"
    label="Presupuesto máx."
    min={0}
  />,
  <SelectInput
    key="forma_compra"
    source="forma_compra@ilike"
    label="Forma de compra"
    choices={FORMA_COMPRA_CHOICES}
  />,
  <ReferenceInput key="sales_id" source="sales_id" reference="sales">
    <AutocompleteInput label="Asesor" optionText={saleOptionText} />
  </ReferenceInput>,
  <SelectInput
    key="stage"
    source="stage"
    label="Etapa"
    choices={leadStages.map((stage) => ({
      id: stage.value,
      name: stage.label,
    }))}
  />,
  <SelectInput
    key="canal"
    source="canal"
    label="Canal"
    choices={CANAL_CHOICES}
  />,
  <SelectInput
    key="fuente"
    source="fuente"
    label="Fuente"
    choices={FUENTE_CHOICES}
  />,
  <TextInput
    key="desarrollo_activo"
    source="desarrollo_activo@ilike"
    label="Desarrollo"
  />,
  <TextInput
    key="credito_status"
    source="credito_status@ilike"
    label="Estatus de crédito"
  />,
  <TextInput
    key="ventana_compra"
    source="ventana_compra@ilike"
    label="Ventana de compra"
  />,
  <TextInput
    key="motivo_descarte"
    source="motivo_descarte@ilike"
    label="Motivo de descarte"
  />,
];
