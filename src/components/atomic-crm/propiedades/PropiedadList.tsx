import { useRecordContext } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";
import type { Propiedad } from "../types";

const filters = [<SearchInput source="q" alwaysOn />];

const PropiedadListActions = () => <TopToolbar />;

/** Currency-formatted price; rent vs sale share the same column. */
const PrecioField = () => {
  const record = useRecordContext<Propiedad>();
  if (!record?.precio) return null;
  const formatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(record.precio);
  return <span>{formatted}</span>;
};

const TipoField = () => {
  const record = useRecordContext<Propiedad>();
  if (!record) return null;
  return (
    <Badge variant={record.tipo === "propia" ? "default" : "outline"}>
      {record.tipo}
    </Badge>
  );
};

const ActivaField = () => {
  const record = useRecordContext<Propiedad>();
  if (!record) return null;
  return (
    <Badge variant={record.activa ? "default" : "secondary"}>
      {record.activa ? "Activa" : "Inactiva"}
    </Badge>
  );
};

export function PropiedadList() {
  return (
    <List
      filters={filters}
      actions={<PropiedadListActions />}
      sort={{ field: "orden", order: "ASC" }}
      perPage={25}
    >
      <DataTable>
        <DataTable.Col source="nombre" />
        <DataTable.Col label="Tipo">
          <TipoField />
        </DataTable.Col>
        <DataTable.Col source="operacion" />
        <DataTable.Col source="colonia" />
        <DataTable.Col source="recamaras" />
        <DataTable.Col label="Precio">
          <PrecioField />
        </DataTable.Col>
        <DataTable.Col source="fuente" />
        <DataTable.Col source="broker_nombre" />
        <DataTable.Col label="Estado">
          <ActivaField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}
