import type { Contact, ContactNote, Propiedad, Sale } from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  contacts: Contact[];
  contact_notes: ContactNote[];
  propiedades: Propiedad[];
  sales: Sale[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
