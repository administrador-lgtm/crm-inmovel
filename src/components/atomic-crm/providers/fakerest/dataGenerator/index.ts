import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generatePropiedades } from "./propiedades";
import { generateAnuncios } from "./anuncios";
import {
  generateConversaciones,
  generateLeadPropiedades,
  generateVisitas,
} from "./leadActivity";
import { finalize } from "./finalize";
import { generateSales } from "./sales";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.contacts = generateContacts(db);
  db.propiedades = generatePropiedades(db);
  db.visitas = generateVisitas(db);
  db.lead_propiedad = generateLeadPropiedades(db);
  db.conversaciones = generateConversaciones(db);
  db.anuncios = generateAnuncios(db);
  db.contact_notes = generateContactNotes(db);
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
