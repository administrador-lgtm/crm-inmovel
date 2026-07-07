import {
  company as fakerCompany,
  internet,
  lorem,
  name,
  phone,
  random,
} from "faker/locale/en_US";

import {
  defaultLeadStages,
  defaultNoteStatuses,
} from "../../../root/defaultConfiguration";
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

    const stage = random.arrayElement(defaultLeadStages).value;
    const stageRank = defaultLeadStages.findIndex((s) => s.value === stage);
    const isPostHandoff = stageRank >= 5 || stage === "descartado";
    const telefono = phone_jsonb[0].number;

    // Advisor-owned leads that the advisor has never contacted (no Baileys
    // outbound) are flagged red on the kanban. In demo data, roughly half of
    // post-handoff leads have an advisor contact; the rest stay null (red).
    const advisor_last_contact_at =
      isPostHandoff && stage !== "descartado" && weightedBoolean(50)
        ? last_seen
        : null;

    // Boolean triage flags derived in `contacts_summary` (production). Faked
    // here so the demo list/kanban boolean filters return coherent results.
    // `is_assigned` mirrors `asesor_asignado` being set (post-handoff leads).
    const is_assigned = isPostHandoff;
    // Advisor owns the lead (S6+) but has never messaged it.
    const sin_contacto_asesor =
      stageRank >= 5 &&
      stage !== "descartado" &&
      advisor_last_contact_at === null;
    // Assigned lead just accepted (S6) with no visit scheduled yet.
    const sin_visita = is_assigned && stage === "S6" && weightedBoolean(50);
    // Post-handoff lead with an ongoing two-way conversation (weighted).
    const conversacion_activa =
      isPostHandoff && stage !== "descartado" && weightedBoolean(40);

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
      stage,
      stage_changed_at: randomDate(new Date(first_seen)).toISOString(),
      sales_id: sale.id,
      linkedin_url: null,
      // Inmovel lead fields (sync-owned in production, faked for the demo)
      canal: "whatsapp",
      fuente: random.arrayElement(["meta_ads", "organico", "referido"]),
      nombre: first_name,
      nombre_completo: `${first_name} ${last_name}`,
      telefono,
      estado: "nuevo",
      desarrollos: [],
      desarrollo_activo: "",
      desarrollo_activo_nombre: "",
      ad_id: weightedBoolean(60)
        ? `ad_${random.number({ min: 1000, max: 9999 })}`
        : "",
      zona_interes: random.arrayElement([
        "Del Valle",
        "Narvarte",
        "Roma Norte",
        "Condesa",
        "Coyoacán",
        "Nápoles",
        "Portales",
        "Benito Juárez",
      ]),
      presupuesto: random.arrayElement([
        "2-3 MDP",
        "3-4 MDP",
        "4-6 MDP",
        "6+ MDP",
      ]),
      tipo_busqueda: random.arrayElement(["venta", "venta", "venta", "renta"]),
      total_mensajes: random.number({ min: 2, max: 60 }),
      historial_json: [],
      ventana_compra: random.arrayElement([
        "0-3 meses",
        "3-6 meses",
        "6-12 meses",
      ]),
      forma_compra: random.arrayElement([
        "credito",
        "contado",
        "credito+contado",
      ]),
      credito_status: random.arrayElement([
        "preaprobado",
        "en_tramite",
        "sin_iniciar",
        "",
      ]),
      fecha_visita_propuesta: isPostHandoff
        ? randomDate(new Date(first_seen)).toISOString()
        : "",
      intencion_visita: isPostHandoff || weightedBoolean(20),
      asesor_asignado: isPostHandoff ? sale.id : null,
      mensajes_post_handoff: isPostHandoff
        ? random.number({ min: 0, max: 20 })
        : -1,
      resumen_sales: isPostHandoff ? lorem.sentences(2) : "",
      renta_seleccion_pendiente: -1,
      renta_seleccion_confirmada: false,
      propiedad_interes: {},
      asesor_externo: "",
      asesor_externo_tel: "",
      alerta_broker_externo_enviada: false,
      fecha_transicion_consultor: "",
      fecha_ultimo_contacto: last_seen,
      sheet_id: `L-${id}`,
      asesor_nombre: isPostHandoff
        ? sale.first_name + " " + sale.last_name
        : null,
      handoff_trigger: isPostHandoff
        ? random.arrayElement(["perfil_completo", "visita_detectada"] as const)
        : null,
      motivo_descarte:
        stage === "descartado"
          ? random.arrayElement([
              "sin respuesta",
              "presupuesto insuficiente",
              "compró con otro",
              "pausa por ahora",
            ])
          : "",
      // Property Matcher count (real value comes from contacts_summary). Most
      // leads have no matches (~70%); the rest get a small handful.
      match_count: weightedBoolean(70) ? 0 : random.number({ min: 1, max: 8 }),
      advisor_last_contact_at,
      // Boolean triage flags (derived from `contacts_summary` in production).
      is_assigned,
      sin_contacto_asesor,
      sin_visita,
      conversacion_activa,
    };
  });
};
