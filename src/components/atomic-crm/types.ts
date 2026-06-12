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
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;

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
  tags: number[];
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
} & Pick<RaRecord, "id">;

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
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

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
