import { useGetList, useListContext, useRecordContext } from "ra-core";
import { useState } from "react";
import { List as ListIcon, MapPin, X } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { FilterButton } from "@/components/admin/filter-form";
import { SortButton } from "@/components/admin/sort-button";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { NumberInput } from "@/components/admin/number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { TopToolbar } from "../layout/TopToolbar";
import { NocnokMap } from "./NocnokMap";
import { type Nocnok, operacionLabel, formatPrecio } from "./types";

type ViewMode = "list" | "map";

const OPERACION_CHOICES = [
  { id: "Sale", name: "Venta" },
  { id: "Rent", name: "Renta" },
  { id: "Sale+Rent", name: "Venta/Renta" },
];

const TIPO_CHOICES = [
  { id: "Departamento", name: "Departamento" },
  { id: "Casa", name: "Casa" },
];

const ALCALDIA_CHOICES = [
  "Benito Juárez",
  "Cuauhtémoc",
  "Álvaro Obregón",
  "Miguel Hidalgo",
  "Coyoacán",
  "Cuernavaca",
].map((a) => ({ id: a, name: a }));

/**
 * Multi-select colonia filter. Lets the user stack several colonias (San Pedro,
 * then another, then another) — results match ANY selected colonia via
 * `colonia@in`. Choices come from the `nocnok_colonias` view (distinct colonias
 * of the current inventory, `id` = colonia so it maps straight to the filter).
 */
const ColoniaFilter = (props: { source?: string; alwaysOn?: boolean }) => {
  const { data } = useGetList("nocnok_colonias", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "colonia", order: "ASC" },
  });
  return (
    <AutocompleteArrayInput
      {...props}
      label="Colonia(s)"
      choices={data ?? []}
      optionText={(record) => `${record.colonia} (${record.n})`}
    />
  );
};

// Operators follow the ra-data-postgrest convention (`field@operator`). `@in`
// takes an array, so the alcaldía and colonia filters are multi-select: pick
// several zones and results match ANY of them.
const filters = [
  <SearchInput
    source="title@ilike"
    alwaysOn
    placeholder="Buscar título/zona"
  />,
  <SelectInput
    source="operacion"
    label="Operación"
    choices={OPERACION_CHOICES}
    alwaysOn
  />,
  <AutocompleteArrayInput
    source="alcaldia@in"
    label="Alcaldía(s)"
    choices={ALCALDIA_CHOICES}
  />,
  <ColoniaFilter source="colonia@in" />,
  <SelectInput source="type_text" label="Tipo" choices={TIPO_CHOICES} />,
  <NumberInput source="precio@gte" label="Precio desde" />,
  <NumberInput source="precio@lte" label="Precio hasta" />,
  <NumberInput source="recamaras@gte" label="Recámaras (mín)" />,
  <NumberInput source="full_bathrooms@gte" label="Baños (mín)" />,
  <NumberInput source="estacionamiento@gte" label="Estac. (mín)" />,
];

const NocnokListActions = ({
  mode,
  setMode,
}: {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
}) => (
  <TopToolbar>
    <FilterButton />
    {mode === "list" ? (
      <SortButton fields={["precio", "m2", "recamaras", "status_date"]} />
    ) : null}
    <div className="flex">
      <Button
        variant={mode === "list" ? "default" : "outline"}
        size="sm"
        onClick={() => setMode("list")}
      >
        <ListIcon className="size-4" /> Lista
      </Button>
      <Button
        variant={mode === "map" ? "default" : "outline"}
        size="sm"
        onClick={() => setMode("map")}
      >
        <MapPin className="size-4" /> Mapa
      </Button>
    </div>
  </TopToolbar>
);

const FILTER_LABELS: Record<string, string> = {
  "title@ilike": "Búsqueda",
  operacion: "Operación",
  "alcaldia@in": "Alcaldía",
  "colonia@in": "Colonia",
  type_text: "Tipo",
  "precio@gte": "Precio desde",
  "precio@lte": "Precio hasta",
  "recamaras@gte": "Recámaras ≥",
  "full_bathrooms@gte": "Baños ≥",
  "estacionamiento@gte": "Estac. ≥",
};

const opName = (id: string) =>
  OPERACION_CHOICES.find((c) => c.id === id)?.name ?? id;

const AREA_KEYS = ["lat_num@gte", "lat_num@lte", "lng_num@gte", "lng_num@lte"];
const SPATIAL_KEYS = [...AREA_KEYS, "codigo@in"];

/** Always-visible chips for every active filter, each removable with its ✕, so
 *  a stored filter can never silently narrow the results without being seen.
 *  Spatial selections (map area / drawn polygon) collapse into a single chip. */
const ActiveFilterChips = () => {
  const { filterValues, setFilters, displayedFilters } = useListContext();
  const fv = filterValues ?? {};

  const attrEntries = Object.entries(fv).filter(
    ([k, v]) =>
      !SPATIAL_KEYS.includes(k) &&
      v != null &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0),
  );
  const hasArea = AREA_KEYS.some((k) => fv[k] != null);
  const drawn = fv["codigo@in"];
  const hasPolygon =
    Array.isArray(drawn) && drawn.length >= 0 && "codigo@in" in fv;

  if (attrEntries.length === 0 && !hasArea && !hasPolygon) return null;

  const removeKeys = (keys: string[]) => {
    const next = { ...fv };
    keys.forEach((k) => delete next[k]);
    setFilters(next, displayedFilters);
  };

  const display = (key: string, value: unknown): string => {
    const arr = Array.isArray(value) ? value : [value];
    if (key === "operacion")
      return arr.map((v) => opName(String(v))).join(", ");
    return arr.map((v) => String(v)).join(", ");
  };

  const Chip = ({
    label,
    onRemove,
  }: {
    label: string;
    onRemove: () => void;
  }) => (
    <Badge variant="secondary" className="gap-1 pr-1">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${label}`}
        className="rounded-full hover:bg-muted-foreground/20 p-0.5"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-2">
      <span className="text-xs text-muted-foreground">Filtros activos:</span>
      {attrEntries.map(([key, value]) => (
        <Chip
          key={key}
          label={`${FILTER_LABELS[key] ?? key}: ${display(key, value)}`}
          onRemove={() => removeKeys([key])}
        />
      ))}
      {hasArea ? (
        <Chip label="📍 Área del mapa" onRemove={() => removeKeys(AREA_KEYS)} />
      ) : null}
      {hasPolygon ? (
        <Chip
          label={`✏️ Zona dibujada (${Array.isArray(drawn) ? drawn.length : 0})`}
          onRemove={() => removeKeys(["codigo@in"])}
        />
      ) : null}
      <button
        type="button"
        onClick={() => setFilters({}, displayedFilters)}
        className="text-xs text-primary underline"
      >
        Limpiar todo
      </button>
    </div>
  );
};

const OperacionField = () => {
  const record = useRecordContext<Nocnok>();
  if (!record) return null;
  return (
    <Badge variant={record.operacion === "Rent" ? "secondary" : "default"}>
      {operacionLabel(record.operacion)}
    </Badge>
  );
};

/** Currency-formatted price; rent listings are monthly. */
const PrecioField = () => {
  const record = useRecordContext<Nocnok>();
  const formatted = formatPrecio(record?.precio);
  if (!formatted) return null;
  return (
    <span className="whitespace-nowrap">
      {formatted}
      {record?.operacion === "Rent" ? "/mes" : ""}
    </span>
  );
};

/** WhatsApp the broker / open the NocNok ficha. Stops row-click navigation. */
const AccionesField = () => {
  const record = useRecordContext<Nocnok>();
  if (!record) return null;
  return (
    <div
      className="flex gap-3 whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
    >
      {record.broker_wa ? (
        <a
          href={record.broker_wa}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          💬 Broker
        </a>
      ) : null}
      {record.url_ficha ? (
        <a
          href={record.url_ficha}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          📄 Ficha
        </a>
      ) : null}
    </div>
  );
};

export function NocnokList() {
  const [mode, setMode] = useState<ViewMode>("list");
  return (
    <List
      filters={filters}
      actions={<NocnokListActions mode={mode} setMode={setMode} />}
      sort={{ field: "status_date", order: "DESC" }}
      perPage={25}
      pagination={mode === "map" ? null : undefined}
    >
      <ActiveFilterChips />
      {mode === "map" ? (
        <NocnokMap />
      ) : (
        <DataTable>
          <DataTable.Col source="title" label="Título" />
          <DataTable.Col source="type_text" label="Tipo" />
          <DataTable.Col label="Operación">
            <OperacionField />
          </DataTable.Col>
          <DataTable.Col source="colonia" label="Colonia" />
          <DataTable.Col source="alcaldia" label="Alcaldía" />
          <DataTable.Col label="Precio">
            <PrecioField />
          </DataTable.Col>
          <DataTable.Col source="recamaras" label="Rec." />
          <DataTable.Col source="m2" label="m²" />
          <DataTable.Col source="shared_commission" label="Comisión" />
          <DataTable.Col source="account_name" label="Broker" />
          <DataTable.Col label="Acciones">
            <AccionesField />
          </DataTable.Col>
        </DataTable>
      )}
    </List>
  );
}
