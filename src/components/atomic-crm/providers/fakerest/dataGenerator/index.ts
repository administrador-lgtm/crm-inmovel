import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generatePropiedades } from "./propiedades";
import { finalize } from "./finalize";
import { generateSales } from "./sales";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.contacts = generateContacts(db);
  db.propiedades = generatePropiedades(db);
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
