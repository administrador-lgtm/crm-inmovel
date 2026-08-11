import type { Meta } from "@storybook/react-vite";
import type { DataProvider } from "ra-core";

import { PropiedadEdit } from "./PropiedadEdit";
import { StoryWrapper } from "@/test/StoryWrapper";
import type { Propiedad } from "../types";

const meta = {
  title: "Atomic CRM/Propiedades/Propiedad Edit",
  parameters: {
    layout: "fullscreen",
  },
  globals: {
    viewport: { value: "responsive", isRotated: false },
  },
} satisfies Meta;

export default meta;

const sheetPropiedad: Propiedad = {
  id: "SHEET-1",
  tipo: "propia",
  nombre: "Torre Sheet",
  operacion: "venta",
  colonia: "Del Valle Centro",
  precio: 3_000_000,
  activa: true,
  lifecycle_status: "consultor_active",
  crm_owned: false,
};

const crmPropiedad: Propiedad = {
  id: "CRM-1",
  tipo: "propia",
  nombre: "Depto CRM Roma",
  operacion: "venta",
  colonia: "Roma Norte",
  precio: 2_500_000,
  activa: true,
  lifecycle_status: "draft",
  crm_owned: true,
};

interface PropiedadEditStoryProps {
  dataProvider?: Partial<DataProvider>;
  silent?: boolean;
}

/** Edit page on a Sheet-origin row: renders the read-only notice. */
export const PropiedadEditSheetOrigin = ({
  dataProvider = {},
  silent,
}: PropiedadEditStoryProps) => (
  <StoryWrapper
    initialEntries={["/propiedades/SHEET-1"]}
    data={{ propiedades: [sheetPropiedad] }}
    dataProvider={dataProvider}
    silent={silent}
  >
    <PropiedadEdit />
  </StoryWrapper>
);

/** Edit page on a CRM-owned row: renders the full form. */
export const PropiedadEditCrmOwned = ({
  dataProvider = {},
  silent,
}: PropiedadEditStoryProps) => (
  <StoryWrapper
    initialEntries={["/propiedades/CRM-1"]}
    data={{ propiedades: [crmPropiedad] }}
    dataProvider={dataProvider}
    silent={silent}
  >
    <PropiedadEdit />
  </StoryWrapper>
);
