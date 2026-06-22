import { Building } from "lucide-react";
import { NocnokList } from "./NocnokList";
import { NocnokShow } from "./NocnokShow";
import type { Nocnok } from "./types";

export default {
  list: NocnokList,
  show: NocnokShow,
  icon: Building,
  recordRepresentation: (record: Nocnok) => record?.title ?? record?.codigo,
};
