import type { Identifier, DataProvider } from "ra-core";

import type { Contact, ContactNote } from "../../types";

/**
 * Merge one contact (loser) into another contact (winner).
 *
 * This function copies properties from the loser to the winner contact,
 * transfers all associated data (notes) from the loser to the winner,
 * and deletes the loser contact.
 */
export const mergeContacts = async (
  loserId: Identifier,
  winnerId: Identifier,
  dataProvider: DataProvider,
) => {
  // Fetch both contacts using dataProvider to get fresh data
  const { data: winnerContact } = await dataProvider.getOne<Contact>(
    "contacts",
    { id: winnerId },
  );
  const { data: loserContact } = await dataProvider.getOne<Contact>(
    "contacts",
    { id: loserId },
  );

  if (!winnerContact || !loserContact) {
    throw new Error("Could not fetch contacts");
  }

  // 1. Reassign all notes from loser to winner
  const { data: loserNotes } = await dataProvider.getManyReference<ContactNote>(
    "contact_notes",
    {
      target: "contact_id",
      id: loserId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );

  const noteUpdates =
    loserNotes?.map((note) =>
      dataProvider.update<ContactNote>("contact_notes", {
        id: note.id,
        data: { contact_id: winnerId },
        previousData: note,
      }),
    ) || [];

  // 3. Update winner contact with loser data
  const mergedEmails = mergeObjectArraysUnique(
    winnerContact.email_jsonb || [],
    loserContact.email_jsonb || [],
    (email) => email.email,
  );

  const mergedPhones = mergeObjectArraysUnique(
    winnerContact.phone_jsonb || [],
    loserContact.phone_jsonb || [],
    (phone) => phone.number,
  );

  const winnerUpdate = dataProvider.update<Contact>("contacts", {
    id: winnerId,
    data: {
      avatar:
        winnerContact.avatar && winnerContact.avatar.src
          ? winnerContact.avatar
          : loserContact.avatar,
      gender: winnerContact.gender ?? loserContact.gender,
      first_name: winnerContact.first_name ?? loserContact.first_name,
      last_name: winnerContact.last_name ?? loserContact.last_name,
      title: winnerContact.title ?? loserContact.title,
      email_jsonb: mergedEmails,
      phone_jsonb: mergedPhones,
      linkedin_url: winnerContact.linkedin_url || loserContact.linkedin_url,
      background: winnerContact.background ?? loserContact.background,
      has_newsletter:
        winnerContact.has_newsletter ?? loserContact.has_newsletter,
      first_seen: winnerContact.first_seen ?? loserContact.first_seen,
      last_seen:
        winnerContact.last_seen > loserContact.last_seen
          ? winnerContact.last_seen
          : loserContact.last_seen,
      sales_id: winnerContact.sales_id ?? loserContact.sales_id,
    },
    previousData: winnerContact,
  });

  // Execute all updates
  await Promise.all([...noteUpdates, winnerUpdate]);

  // 4. Delete the loser contact
  await dataProvider.delete<Contact>("contacts", {
    id: loserId,
    previousData: loserContact,
  });
};

// Helper functions to merge arrays and remove duplicates

// For primitive arrays like tags

// For object arrays like emails and phones
function mergeObjectArraysUnique<T>(
  arr1: T[],
  arr2: T[],
  getKey: (item: T) => string,
): T[] {
  const map = new Map<string, T>();

  arr1.forEach((item) => {
    const key = getKey(item);
    if (key) map.set(key, item);
  });

  arr2.forEach((item) => {
    const key = getKey(item);
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
}
