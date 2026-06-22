/** A shared-inventory listing from the NocNok feed (the `nocnok` view). */
export interface Nocnok {
  id: string;
  codigo: string;
  title?: string;
  operacion?: "Sale" | "Rent" | "Sale+Rent" | string;
  type_text?: string;
  precio?: number;
  recamaras?: number;
  full_bathrooms?: number;
  half_bathrooms?: number;
  m2?: number;
  lot_size?: number;
  colonia?: string;
  alcaldia?: string;
  estado?: string;
  cp?: string;
  estacionamiento?: number;
  year_built?: string;
  levels?: string;
  url_ficha?: string;
  lat?: string;
  lon?: string;
  account_name?: string;
  shared_commission?: string;
  is_exclusive?: boolean;
  share_type?: string;
  status_days?: string;
  status_date?: string;
  fotos?: number;
  broker_tel?: string;
  broker_wa?: string;
}

/** Display the operation in Spanish. */
export const operacionLabel = (operacion?: string): string => {
  switch (operacion) {
    case "Sale":
      return "Venta";
    case "Rent":
      return "Renta";
    case "Sale+Rent":
      return "Venta/Renta";
    default:
      return operacion ?? "";
  }
};

/** Format a price as MXN currency (rent prices are monthly). */
export const formatPrecio = (precio?: number): string | undefined => {
  if (precio == null || Number.isNaN(Number(precio))) return undefined;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(precio));
};
