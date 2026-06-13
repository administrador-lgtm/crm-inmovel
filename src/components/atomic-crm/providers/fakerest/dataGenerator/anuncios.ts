import type { Anuncio } from "../../../types";
import type { Db } from "./types";

export const generateAnuncios = (db: Db): Anuncio[] =>
  db.propiedades
    .filter((propiedad) => propiedad.tipo === "propia")
    .map((propiedad, index) => ({
      id: `ad_${1000 + index}`,
      ad_name: `Anuncio ${propiedad.nombre}`,
      propiedad_id: propiedad.id,
      activo: true,
      created_at: "2026-04-01T00:00:00.000Z",
    }));
