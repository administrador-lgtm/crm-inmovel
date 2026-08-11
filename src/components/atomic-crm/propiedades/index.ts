import type { Propiedad } from "../types";
import { PropiedadList } from "./PropiedadList";
import { PropiedadShow } from "./PropiedadShow";
import { PropiedadCreate } from "./PropiedadCreate";
import { PropiedadEdit } from "./PropiedadEdit";

export default {
  list: PropiedadList,
  show: PropiedadShow,
  create: PropiedadCreate,
  edit: PropiedadEdit,
  recordRepresentation: (record: Propiedad) => record?.nombre ?? record?.id,
};
