import type {
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Sale,
  Tag,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  sales: Sale[];
  tags: Tag[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
