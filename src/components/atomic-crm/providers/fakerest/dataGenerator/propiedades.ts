import { random } from "faker/locale/en_US";

import type { Propiedad } from "../../../types";
import type { Db } from "./types";

const COLONIAS: Array<{ colonia: string; alcaldia: string }> = [
  { colonia: "Del Valle Centro", alcaldia: "Benito Juárez" },
  { colonia: "Narvarte Poniente", alcaldia: "Benito Juárez" },
  { colonia: "Nápoles", alcaldia: "Benito Juárez" },
  { colonia: "Portales Sur", alcaldia: "Benito Juárez" },
  { colonia: "Roma Norte", alcaldia: "Cuauhtémoc" },
  { colonia: "Condesa", alcaldia: "Cuauhtémoc" },
  { colonia: "Coyoacán Centro", alcaldia: "Coyoacán" },
  { colonia: "Educación", alcaldia: "Coyoacán" },
];

const NOMBRES_PROPIA = [
  "Torre Gaia",
  "Residencial Mitla 390",
  "City Towers Green",
  "Punto Anáhuac",
  "Vértiz 1024",
  "Eje Central Lofts",
];

const AMENIDADES = [
  "Gimnasio, roof garden, salón de usos múltiples",
  "Alberca, pet zone, coworking",
  "Roof garden, ludoteca, seguridad 24h",
  "Gimnasio, cine privado, motor lobby",
];

export const generatePropiedades = (_db: Db, size = 24): Propiedad[] => {
  return Array.from(Array(size).keys()).map((index) => {
    const esPropia = index < NOMBRES_PROPIA.length;
    const operacion = esPropia
      ? "venta"
      : random.arrayElement(["venta", "venta", "renta"] as const);
    const ubicacion = random.arrayElement(COLONIAS);
    const precio =
      operacion === "venta"
        ? random.number({ min: 2_200_000, max: 9_500_000 })
        : random.number({ min: 14_000, max: 45_000 });
    const recamaras = random.number({ min: 1, max: 3 });

    return {
      id: esPropia ? `P-${index + 1}` : `NN-${1000 + index}`,
      tipo: esPropia ? "propia" : "compartida",
      nombre: esPropia
        ? NOMBRES_PROPIA[index]
        : `Depto ${recamaras} rec ${ubicacion.colonia}`,
      estatus: random.arrayElement(["disponible", "disponible", "apartado"]),
      operacion,
      direccion: `Calle ${random.number({ min: 1, max: 200 })} #${random.number({ min: 1, max: 999 })}`,
      colonia: ubicacion.colonia,
      alcaldia: ubicacion.alcaldia,
      precio,
      metros: random.number({ min: 55, max: 160 }),
      recamaras,
      banos: random.number({ min: 1, max: 3 }),
      estacionamiento: random.number({ min: 0, max: 2 }),
      pet_friendly: random.arrayElement(["si", "no", "consultar"]),
      argumento1: "Excelente ubicación y conectividad",
      argumento2: "Plusvalía sostenida en la zona",
      argumento3: "Amenidades completas",
      lista_precios: "",
      url_anuncio: "",
      url_maps: "",
      tipos_unidades: esPropia ? "1, 2 y 3 recámaras" : "",
      precios_por_tipo: "",
      caracteristicas: "Cocina integral, clósets, balcón",
      amenidades: random.arrayElement(AMENIDADES),
      argumentos_zona: "Cerca de Metro, parques y servicios",
      esquema_pago: esPropia ? "Apartado + enganche diferido" : "",
      creditos: "Infonavit, Fovissste, bancario",
      objeciones: "",
      precio_desde: esPropia ? precio : undefined,
      precio_hasta: esPropia ? Math.round(precio * 1.35) : undefined,
      m2_desde: esPropia ? 55 : undefined,
      m2_hasta: esPropia ? 120 : undefined,
      recamaras_min: esPropia ? 1 : undefined,
      recamaras_max: esPropia ? 3 : undefined,
      unidades_disponibles: esPropia
        ? String(random.number({ min: 3, max: 40 }))
        : "",
      fecha_entrega: esPropia ? "2027-06" : "",
      enganche_minimo_pct: esPropia ? "10%" : "",
      features: "",
      destacado: weighted(index),
      url_ficha: esPropia ? "" : "https://example.nocnok.com/ficha",
      codigo_fuente: esPropia ? "" : `NN${2000 + index}`,
      fuente: esPropia
        ? "manual"
        : random.arrayElement(["nocnok", "broker_directo", "bolsa"] as const),
      broker_nombre: esPropia ? "" : "Inmobiliaria Externa SA",
      broker_telefono: esPropia ? "" : "5511223344",
      broker_wa: esPropia ? "" : "5215511223344",
      comision: esPropia ? "" : random.arrayElement(["50/50", "60/40"]),
      activa: index % 9 !== 8,
      orden: index,
      fecha_carga: "2026-05-01",
      account_name: esPropia ? "" : "Broker Externo",
      account_id: esPropia ? "" : String(random.number({ min: 100, max: 999 })),
      shared_commission: esPropia ? "" : "50%",
      status_days: "",
      is_exclusive: false,
      share_type: esPropia ? "" : "Network",
    };
  });
};

const weighted = (index: number): string => (index % 5 === 0 ? "si" : "");
