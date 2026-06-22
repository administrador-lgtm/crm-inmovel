import { useRecordContext } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { FilterButton } from "@/components/admin/filter-form";
import { SortButton } from "@/components/admin/sort-button";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";
import { type Nocnok, operacionLabel, formatPrecio } from "./types";

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

// Operators follow the ra-data-postgrest convention (`field@operator`); the
// adapter auto-wraps `ilike` with wildcards, so text inputs behave as "contains".
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
  <SelectInput source="alcaldia" label="Alcaldía" choices={ALCALDIA_CHOICES} />,
  <TextInput source="colonia@ilike" label="Colonia" />,
  <SelectInput source="type_text" label="Tipo" choices={TIPO_CHOICES} />,
  <NumberInput source="precio@gte" label="Precio desde" />,
  <NumberInput source="precio@lte" label="Precio hasta" />,
  <NumberInput source="recamaras@gte" label="Recámaras (mín)" />,
  <NumberInput source="full_bathrooms@gte" label="Baños (mín)" />,
  <NumberInput source="estacionamiento@gte" label="Estac. (mín)" />,
];

const NocnokListActions = () => (
  <TopToolbar>
    <FilterButton />
    <SortButton fields={["precio", "m2", "recamaras", "status_date"]} />
  </TopToolbar>
);

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
  return (
    <List
      filters={filters}
      actions={<NocnokListActions />}
      sort={{ field: "status_date", order: "DESC" }}
      perPage={25}
    >
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
    </List>
  );
}
