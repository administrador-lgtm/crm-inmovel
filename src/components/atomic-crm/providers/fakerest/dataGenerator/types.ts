import type {
  Contact,
  ContactNote,
  Sale,
  Tag,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  contacts: Contact[];
  contact_notes: ContactNote[];
  sales: Sale[];
  tags: Tag[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
