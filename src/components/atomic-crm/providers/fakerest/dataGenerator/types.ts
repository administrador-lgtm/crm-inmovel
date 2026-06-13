import type {
  Anuncio,
  Contact,
  ContactNote,
  Conversacion,
  LeadPropiedad,
  Propiedad,
  Sale,
  Visita,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  contacts: Contact[];
  contact_notes: ContactNote[];
  propiedades: Propiedad[];
  visitas: Visita[];
  lead_propiedad: LeadPropiedad[];
  conversaciones: Conversacion[];
  anuncios: Anuncio[];
  sales: Sale[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
