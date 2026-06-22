import { useRecordContext } from "ra-core";
import { Show } from "@/components/admin/show";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { type Nocnok, operacionLabel, formatPrecio } from "./types";

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

/** A labelled clickable link; hidden when the value is empty. */
const LinkRow = ({ label, value }: { label: string; value?: unknown }) => {
  if (!value || typeof value !== "string") return null;
  return (
    <div className="flex flex-col py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary underline truncate"
      >
        {value}
      </a>
    </div>
  );
};

const NocnokShowContent = () => {
  const record = useRecordContext<Nocnok>();
  if (!record) return null;

  const precio = formatPrecio(record.precio);
  const mapsUrl =
    record.lat && record.lon
      ? `https://maps.google.com/?q=${record.lat},${record.lon}`
      : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h2 className="text-lg font-semibold">
              {record.title ?? record.codigo}
            </h2>
            <Badge
              variant={record.operacion === "Rent" ? "secondary" : "default"}
            >
              {operacionLabel(record.operacion)}
            </Badge>
          </div>
          <Row
            label="Precio"
            value={
              precio
                ? `${precio}${record.operacion === "Rent" ? "/mes" : ""}`
                : undefined
            }
          />
          <Row label="Tipo" value={record.type_text} />
          <Row label="Recámaras" value={record.recamaras} />
          <Row label="Baños completos" value={record.full_bathrooms} />
          <Row label="Medios baños" value={record.half_bathrooms} />
          <Row label="m² construcción" value={record.m2} />
          <Row label="m² terreno" value={record.lot_size} />
          <Row label="Estacionamiento" value={record.estacionamiento} />
          <Row label="Año" value={record.year_built} />
          <Row label="Niveles" value={record.levels} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-md font-semibold mb-3">Ubicación</h3>
          <Row label="Colonia" value={record.colonia} />
          <Row label="Alcaldía" value={record.alcaldia} />
          <Row label="Estado" value={record.estado} />
          <Row label="C.P." value={record.cp} />
          <LinkRow label="📍 Mapa" value={mapsUrl} />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardContent className="pt-6">
          <h3 className="text-md font-semibold mb-3">
            Broker / bolsa compartida
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Row label="Broker" value={record.account_name} />
            <Row label="Comisión compartida" value={record.shared_commission} />
            <Row label="Tipo de compartición" value={record.share_type} />
            <Row label="Exclusiva" value={record.is_exclusive} />
            <Row label="Días en el mercado" value={record.status_days} />
            <Row label="Código" value={record.codigo} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            <LinkRow label="💬 WhatsApp broker" value={record.broker_wa} />
            <Row label="Teléfono broker" value={record.broker_tel} />
            <LinkRow label="📄 Ficha NocNok" value={record.url_ficha} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const NocnokShow = () => (
  <Show>
    <NocnokShowContent />
  </Show>
);
