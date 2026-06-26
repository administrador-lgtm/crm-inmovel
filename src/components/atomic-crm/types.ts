import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type { CONTACT_CREATED, CONTACT_NOTE_CREATED } from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type SalesFormData = {
  avatar?: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled: boolean;
  telefono?: string | null;
  calendario?: string | null;
  linea_negocio?: "exclusiva" | "compartida" | null;
  activo?: boolean | null;
  manager_id?: Identifier | null;
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;

  // Inmovel asesor fields (synced from the Sheet Asesores tab)
  telefono?: string | null;
  calendario?: string | null;
  linea_negocio?: "exclusiva" | "compartida" | null;
  activo?: boolean | null;
  /** Manager this advisor reports to; drives manager team-scope RLS. */
  manager_id?: Identifier | null;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name: string;
  title: string;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  gender: string;
  sales_id?: Identifier;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];

  /**
   * Lead pipeline stage (S1..S10 or "descartado"). A contact IS the lead in
   * Inmovel, so the pipeline stage lives here, not on a separate deal entity.
   * Owned by the bot sync while in S1..S5; advisor-set from S6 onward.
   */
  stage?: string;
  /** When the lead last entered its current stage (drives the kanban timer). */
  stage_changed_at?: string;

  // Inmovel lead fields mirrored from the Sheet Leads tab. Sync-owned:
  // written only by the sheet sync, rendered read-only in the CRM UI.
  canal?: string;
  fuente?: string;
  nombre?: string;
  nombre_completo?: string;
  telefono?: string;
  estado?: string;
  desarrollos?: string[];
  desarrollo_activo?: string;
  /** Readable name of the active property of interest (from contacts_summary). */
  desarrollo_activo_nombre?: string;
  ad_id?: string;
  zona_interes?: string;
  presupuesto?: string;
  tipo_busqueda?: string;
  total_mensajes?: number;
  historial_json?: unknown[];
  ventana_compra?: string;
  forma_compra?: string;
  credito_status?: string;
  fecha_visita_propuesta?: string;
  intencion_visita?: boolean;
  /** Advisor (sales id) owning this lead; RLS keys off this column. */
  asesor_asignado?: Identifier | null;
  mensajes_post_handoff?: number;
  resumen_sales?: string;
  renta_seleccion_pendiente?: number;
  renta_seleccion_confirmada?: boolean;
  propiedad_interes?: Record<string, unknown>;
  asesor_externo?: string;
  asesor_externo_tel?: string;
  alerta_broker_externo_enviada?: boolean;
  fecha_transicion_consultor?: string;
  fecha_ultimo_contacto?: string;

  // CRM-owned lead fields (never touched by the sheet sync)
  handoff_trigger?: "perfil_completo" | "visita_detectada" | null;
  /** Required (enforced in the UI layer) when stage = "descartado". */
  motivo_descarte?: string;
  /** Sheet lead id; the one-way sync keys upserts on this. */
  sheet_id?: string | null;
  /** Advisor name from the Sheet (display-only; RLS uses asesor_asignado). */
  asesor_nombre?: string | null;
} & Pick<RaRecord, "id">;

export type Propiedad = {
  /** Sheet/external id, e.g. "P-001" or a NocNok code. */
  id: string;
  tipo: "propia" | "compartida";
  nombre: string;
  estatus?: string;
  operacion?: "venta" | "renta";
  direccion?: string;
  colonia?: string;
  alcaldia?: string;
  precio?: number;
  metros?: number;
  recamaras?: number;
  banos?: number;
  estacionamiento?: number;
  pet_friendly?: string;
  argumento1?: string;
  argumento2?: string;
  argumento3?: string;
  lista_precios?: string;
  url_anuncio?: string;
  url_maps?: string;
  // Dossier fields (advisor-facing sales material)
  tipos_unidades?: string;
  precios_por_tipo?: string;
  caracteristicas?: string;
  amenidades?: string;
  argumentos_zona?: string;
  esquema_pago?: string;
  creditos?: string;
  objeciones?: string;
  precio_desde?: number;
  precio_hasta?: number;
  m2_desde?: number;
  m2_hasta?: number;
  recamaras_min?: number;
  recamaras_max?: number;
  unidades_disponibles?: string;
  fecha_entrega?: string;
  enganche_minimo_pct?: string;
  // Shared/broker listing fields
  features?: string;
  destacado?: string;
  url_ficha?: string;
  /** Drive folder with marketing material (own) or GDC CLIENTES EXTERNOS subfolder. */
  material_url?: string;
  codigo_fuente?: string;
  fuente?: "manual" | "nocnok" | "broker_directo" | "bolsa";
  broker_nombre?: string;
  broker_telefono?: string;
  broker_wa?: string;
  comision?: string;
  activa?: boolean;
  orden?: number;
  fecha_carga?: string;
  // NocNok metadata (external broker feed)
  account_name?: string;
  account_id?: string;
  shared_commission?: string;
  status_days?: string;
  is_exclusive?: boolean;
  share_type?: string;
};

export type Visita = {
  lead_id: Identifier;
  propiedad_id?: string | null;
  fecha: string;
  resultado?: string | null;
  notas?: string | null;
  asesor_id?: Identifier | null;
  created_at?: string;
  /** Google Calendar event id (Calendar is the source of truth for visits). */
  gcal_event_id?: string | null;
  /** confirmada | cancelada — mirrored from the calendar event status. */
  estado?: string | null;
} & Pick<RaRecord, "id">;

export type LeadPropiedad = {
  lead_id: Identifier;
  propiedad_id: string;
  relacion: "match_bot" | "pregunto" | "visito";
} & Pick<RaRecord, "id">;

export type Conversacion = {
  lead_id: Identifier;
  rol: "lead" | "bot";
  texto: string;
  timestamp: string;
  nombre_lead?: string | null;
} & Pick<RaRecord, "id">;

/**
 * One captured advisor↔lead WhatsApp message (Baileys listener), exposed via the
 * public.advisor_conversation view. `from_advisor` gives the bubble side.
 */
export type AdvisorMessage = {
  lead_id: Identifier;
  from_advisor: boolean;
  text: string;
  sent_at: string;
  advisor_sales_id?: number | null;
} & Pick<RaRecord, "id">;

export type Anuncio = {
  /** Meta ad id (primary key). */
  id: string;
  ad_name?: string | null;
  propiedad_id?: string | null;
  activo?: boolean;
  created_at?: string | null;
};

/**
 * In Inmovel a lead IS a contact (1 lead = 1 person = 1 opportunity), so the
 * Lead type is the extended Contact. Exported for UI components that speak
 * the domain language.
 */
export type Lead = Contact;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
  /** sales ids to notify about this note (in-app + WhatsApp). */
  mentions?: Identifier[];
} & Pick<RaRecord, "id">;

/** A per-recipient notification spawned from a note @mention. */
export type NoteMention = {
  id: Identifier;
  note_id: Identifier;
  contact_id: Identifier;
  recipient_id: Identifier;
  sender_id: Identifier;
  created_at: string;
  read_at?: string | null;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  sales_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  sales_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type Activity = RaRecord &
  (ActivityContactCreated | ActivityContactNoteCreated);

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export type LeadStage = LabeledValue;

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}
