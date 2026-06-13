import { lorem, random } from "faker/locale/en_US";

import type { Conversacion, LeadPropiedad, Visita } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

// Stage ranks at or beyond "S7 Visita agendada" get visit records.
const VISIT_STAGES = ["S7", "S8", "S9", "S10"];

const LEAD_LINES = [
  "Hola, vi el anuncio del depto",
  "¿Cuál es el precio?",
  "¿Aceptan crédito Infonavit?",
  "Me interesa agendar una visita",
  "¿En qué colonia está?",
  "¿Tiene estacionamiento?",
];

const BOT_LINES = [
  "¡Hola! Con gusto te comparto la información.",
  "El precio de lista es el publicado, ¿te gustaría agendar una visita?",
  "Sí, aceptamos crédito bancario, Infonavit y Fovissste.",
  "Perfecto, ¿qué día te acomoda?",
  "Se encuentra muy cerca del Metro.",
  "Cuenta con un cajón de estacionamiento.",
];

export const generateVisitas = (db: Db): Visita[] => {
  const visitas: Visita[] = [];
  let id = 0;
  db.contacts
    .filter((lead) => VISIT_STAGES.includes(lead.stage ?? ""))
    .forEach((lead) => {
      const count = random.number({ min: 1, max: 3 });
      for (let i = 0; i < count; i++) {
        const propiedad = random.arrayElement(db.propiedades);
        visitas.push({
          id: id++,
          lead_id: lead.id,
          propiedad_id: propiedad.id,
          fecha: randomDate(new Date(lead.first_seen)).toISOString(),
          resultado: random.arrayElement([
            "le gustó",
            "lo está pensando",
            "no le convenció",
            "pendiente",
          ]),
          notas: lorem.sentence(),
          asesor_id: lead.asesor_asignado ?? lead.sales_id,
          created_at: lead.first_seen,
        });
      }
    });
  return visitas;
};

export const generateLeadPropiedades = (db: Db): LeadPropiedad[] => {
  const relations: LeadPropiedad[] = [];
  let id = 0;
  db.contacts.forEach((lead) => {
    const count = random.number({ min: 1, max: 4 });
    const propiedades = random.arrayElements(db.propiedades, count);
    propiedades.forEach((propiedad, index) => {
      relations.push({
        id: id++,
        lead_id: lead.id,
        propiedad_id: propiedad.id,
        relacion:
          index === 0
            ? "match_bot"
            : random.arrayElement(["pregunto", "visito"] as const),
      });
    });
  });
  return relations;
};

export const generateConversaciones = (db: Db): Conversacion[] => {
  const mensajes: Conversacion[] = [];
  let id = 0;
  db.contacts.forEach((lead) => {
    const count = random.number({ min: 6, max: 24 });
    const start = new Date(lead.first_seen).getTime();
    for (let i = 0; i < count; i++) {
      const fromLead = i % 2 === 0;
      mensajes.push({
        id: id++,
        lead_id: lead.id,
        rol: fromLead ? "lead" : "bot",
        texto: fromLead
          ? random.arrayElement(LEAD_LINES)
          : random.arrayElement(BOT_LINES),
        timestamp: new Date(start + i * 90_000).toISOString(),
        nombre_lead: lead.nombre_completo,
      });
    }
  });
  return mensajes;
};
