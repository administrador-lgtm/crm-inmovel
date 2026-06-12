import {
  company as fakerCompany,
  internet,
  lorem,
  name,
  phone,
  random,
} from "faker/locale/en_US";

import { defaultNoteStatuses } from "../../../root/defaultConfiguration";
import { contactGender } from "../../../contacts/contactModel";
import type { Contact } from "../../../types";
import type { Db } from "./types";
import { randomDate, weightedBoolean } from "./utils";

const getRandomContactDetailsType = () =>
  random.arrayElement(["Work", "Home", "Other"]) as "Work" | "Home" | "Other";

export const generateContacts = (db: Db, size = 500): Required<Contact>[] => {
  const nbAvailblePictures = 223;
  let numberOfContacts = 0;

  return Array.from(Array(size).keys()).map((id) => {
    const has_avatar =
      weightedBoolean(25) && numberOfContacts < nbAvailblePictures;
    const gender = random.arrayElement(contactGender).value;
    const first_name = name.firstName(gender as any);
    const last_name = name.lastName();
    const email_jsonb = [
      {
        email: internet.email(first_name, last_name),
        type: getRandomContactDetailsType(),
      },
    ];
    const phone_jsonb = [
      {
        number: phone.phoneNumber(),
        type: getRandomContactDetailsType(),
      },
      {
        number: phone.phoneNumber(),
        type: getRandomContactDetailsType(),
      },
    ];
    const avatar = {
      src: has_avatar
        ? "https://marmelab.com/posters/avatar-" +
          (223 - numberOfContacts) +
          ".jpeg"
        : undefined,
    };
    const title = fakerCompany.bsAdjective();

    if (has_avatar) {
      numberOfContacts++;
    }

    const sale = random.arrayElement(db.sales);

    const first_seen = randomDate().toISOString();
    const last_seen = first_seen;

    return {
      id,
      first_name,
      last_name,
      gender,
      title: title.charAt(0).toUpperCase() + title.substr(1),
      email_jsonb,
      phone_jsonb,
      background: lorem.sentence(),
      acquisition: random.arrayElement(["inbound", "outbound"]),
      avatar,
      first_seen: first_seen,
      last_seen: last_seen,
      has_newsletter: weightedBoolean(30),
      status: random.arrayElement(defaultNoteStatuses).value,
      tags: random
        .arrayElements(db.tags, random.arrayElement([0, 0, 0, 1, 1, 2]))
        .map((tag) => tag.id), // finalize
      sales_id: sale.id,
      linkedin_url: null,
    };
  });
};
