import type { DataProvider, Identifier } from "ra-core";

import {
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
} from "../../consts";
import type {
  Activity,
  Contact,
  ContactNote,
} from "../../types";

// FIXME: Requires 4 large queries to get the latest activities.
// Replace with a server-side view or a custom API endpoint.
export async function getActivityLog(
  dataProvider: DataProvider,
  salesId?: Identifier,
) {
  const filter = {} as any;
  if (salesId) {
    filter["sales_id@in"] = `(${salesId})`;
  }

  const newContactsAndNotes = await getNewContactsAndNotes(
    dataProvider,
    filter,
  );
  return (
    [...newContactsAndNotes]
      // sort by date desc
      .sort(
        (a, b) =>
          (a.date || new Date(0).toISOString()).localeCompare(
            b.date || new Date(0).toISOString(),
          ) * -1,
      )
      // limit to 250 activities
      .slice(0, 250)
  );
}

async function getNewContactsAndNotes(
  dataProvider: DataProvider,
  filter: any,
): Promise<Activity[]> {
  const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "first_seen", order: "DESC" },
  });

  const recentContactNotesFilter = {} as any;
  if (filter.sales_id) {
    recentContactNotesFilter.sales_id = filter.sales_id;
  }

  const { data: contactNotes } = await dataProvider.getList<ContactNote>(
    "contact_notes",
    {
      filter: recentContactNotesFilter,
      pagination: { page: 1, perPage: 250 },
      sort: { field: "date", order: "DESC" },
    },
  );

  const newContacts = contacts.map((contact) => ({
    id: `contact.${contact.id}.created`,
    type: CONTACT_CREATED,
    sales_id: contact.sales_id,
    contact,
    date: contact.first_seen,
  }));

  const newContactNotes = contactNotes.map((contactNote) => ({
    id: `contactNote.${contactNote.id}.created`,
    type: CONTACT_NOTE_CREATED,
    sales_id: contactNote.sales_id,
    contactNote,
    date: contactNote.date,
  }));

  return [...newContacts, ...newContactNotes];
}
