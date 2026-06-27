import type { PartialCrmMessages } from "./englishCrmMessages";

/**
 * Spanish CRM catalog for Inmovel. Only the high-visibility domain strings are
 * translated here; everything else falls back to the English catalog (layered
 * underneath in i18nProvider) so no key is ever missing. The "contacts"
 * resource is labelled "Contactos" (matching the English "Contacts"); the
 * lead pipeline is the separate "Leads" kanban tab, so the two are distinct.
 */
export const spanishCrmMessages: PartialCrmMessages = {
  resources: {
    contacts: {
      name: "Contacto |||| Contactos",
      forcedCaseName: "Contacto",
      fields: {
        first_name: "Nombre",
        last_name: "Apellido",
        last_seen: "Último contacto",
        first_seen: "Primer contacto",
        presupuesto_num: "Presupuesto",
        total_mensajes: "Mensajes",
        stage: "Etapa",
        title: "Puesto",
        email_jsonb: "Correos",
        email: "Correo",
        phone_jsonb: "Teléfonos",
        phone_number: "Teléfono",
        linkedin_url: "LinkedIn",
        background: "Notas de contexto",
        has_newsletter: "Newsletter",
        sales_id: "Asesor",
      },
      action: {
        add: "Agregar lead",
        add_first: "Agrega tu primer lead",
        create: "Crear lead",
        edit: "Editar lead",
        new: "Nuevo lead",
        show: "Ver lead",
      },
      empty: {
        description: "Aún no tienes leads.",
        title: "Sin leads",
      },
      filters: {
        today: "Hoy",
        this_week: "Esta semana",
        before_this_week: "Antes de esta semana",
        before_this_month: "Antes de este mes",
        before_last_month: "Antes del mes pasado",
        managed_by_me: "Asignados a mí",
        search: "Buscar nombre, teléfono…",
      },
      hot: {
        title: "Leads calientes",
      },
    },
    notes: {
      name: "Nota |||| Notas",
      forcedCaseName: "Nota",
      action: {
        add: "Agregar nota",
        add_first: "Agrega tu primera nota",
        delete: "Eliminar nota",
        edit: "Editar nota",
        update: "Actualizar nota",
        add_this: "Agregar esta nota",
      },
      empty: "Aún no hay notas",
      added: "Nota agregada",
    },
    sales: {
      name: "Asesor |||| Asesores",
      fields: {
        first_name: "Nombre",
        last_name: "Apellido",
        email: "Correo",
        administrator: "Admin",
        disabled: "Deshabilitado",
      },
      action: {
        new: "Nuevo asesor",
      },
    },
    propiedades: {
      name: "Propiedad |||| Propiedades",
    },
  },
  crm: {
    navigation: {
      label: "Navegación",
      leads: "Leads",
      visitas: "Visitas",
    },
    agenda: {
      today: "Hoy",
      prev_week: "Semana anterior",
      next_week: "Semana siguiente",
      empty: "Sin visitas este día.",
      unassigned: "Sin asesor",
      no_property: "Sin propiedad",
      maps: "Maps",
    },
    leads: {
      stage: "Etapa del lead",
      activity: "Actividad",
      info: "Datos del lead",
      stage_read_only:
        "Esta etapa la gestiona el sistema y no se puede modificar manualmente.",
      accept_handoff: "Asesor aceptó",
      discard_title: "Descartar lead",
      discard_hint: "Indica el motivo del descarte. Es obligatorio.",
      discard_reason: "Motivo",
      discard_placeholder: "Ej. sin respuesta, presupuesto insuficiente…",
      discard_confirm: "Descartar",
      fields: {
        zona_interes: "Zona de interés",
        presupuesto: "Presupuesto",
        tipo_busqueda: "Operación",
        ventana_compra: "Ventana de compra",
        forma_compra: "Forma de compra",
        credito_status: "Estatus de crédito",
        canal: "Canal",
        fuente: "Fuente",
        total_mensajes: "Mensajes",
        resumen_sales: "Resumen",
        asesor_asignado: "Asesor",
      },
    },
    visitas: {
      title: "Visitas",
      add: "Registrar visita",
      empty: "Sin visitas registradas.",
      propiedad: "Propiedad",
      fecha: "Fecha",
      resultado: "Resultado",
      notas: "Notas",
      created: "Visita registrada",
    },
    conversaciones: {
      title: "Conversación del bot",
      empty: "Sin mensajes registrados.",
    },
  },
};
