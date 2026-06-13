import type { Propiedad } from "../types";
import { PropiedadList } from "./PropiedadList";
import { PropiedadShow } from "./PropiedadShow";

export default {
  list: PropiedadList,
  show: PropiedadShow,
  recordRepresentation: (record: Propiedad) => record?.nombre ?? record?.id,
};
