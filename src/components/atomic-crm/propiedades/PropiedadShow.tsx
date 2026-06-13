import { useRecordContext } from "ra-core";
import { Show } from "@/components/admin/show";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { Propiedad } from "../types";

/** One labelled read-only row; hidden when the value is empty. */
const Row = ({ label, value }: { label: string; value?: unknown }) => {
  if (value === null || value === undefined || value === "") return null;
  const display =
    typeof value === "boolean" ? (value ? "Sí" : "No") : String(value);
  return (
    <div className="flex flex-col py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{display}</span>
    </div>
  );
};

const PropiedadShowContent = () => {
  const record = useRecordContext<Propiedad>();
  if (!record) return null;

  const precio = record.precio
    ? new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
      }).format(record.precio)
    : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold">{record.nombre}</h2>
            <Badge variant={record.tipo === "propia" ? "default" : "outline"}>
              {record.tipo}
            </Badge>
          </div>
          <Row label="Operación" value={record.operacion} />
          <Row label="Precio" value={precio} />
          <Row label="Colonia" value={record.colonia} />
          <Row label="Alcaldía" value={record.alcaldia} />
          <Row label="Dirección" value={record.direccion} />
          <Row label="Metros" value={record.metros} />
          <Row label="Recámaras" value={record.recamaras} />
          <Row label="Baños" value={record.banos} />
          <Row label="Estacionamiento" value={record.estacionamiento} />
          <Row label="Pet friendly" value={record.pet_friendly} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-md font-semibold mb-3">Argumentos y dossier</h3>
          <Row label="Argumento 1" value={record.argumento1} />
          <Row label="Argumento 2" value={record.argumento2} />
          <Row label="Argumento 3" value={record.argumento3} />
          <Row label="Amenidades" value={record.amenidades} />
          <Row label="Argumentos de zona" value={record.argumentos_zona} />
          <Row label="Esquema de pago" value={record.esquema_pago} />
          <Row label="Créditos" value={record.creditos} />
          <Row label="Fecha de entrega" value={record.fecha_entrega} />
          <Row label="Enganche mínimo" value={record.enganche_minimo_pct} />
        </CardContent>
      </Card>

      {record.tipo === "compartida" && (
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <h3 className="text-md font-semibold mb-3">Broker / fuente</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Row label="Fuente" value={record.fuente} />
              <Row label="Broker" value={record.broker_nombre} />
              <Row label="Teléfono broker" value={record.broker_telefono} />
              <Row label="WhatsApp broker" value={record.broker_wa} />
              <Row label="Comisión" value={record.comision} />
              <Row
                label="Comisión compartida"
                value={record.shared_commission}
              />
              <Row label="Cuenta" value={record.account_name} />
              <Row label="Exclusiva" value={record.is_exclusive} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export const PropiedadShow = () => (
  <Show>
    <PropiedadShowContent />
  </Show>
);
