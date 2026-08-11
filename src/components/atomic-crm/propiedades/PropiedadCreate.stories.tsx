import type { Meta } from "@storybook/react-vite";
import type { DataProvider } from "ra-core";

import { PropiedadCreate } from "./PropiedadCreate";
import { StoryWrapper } from "@/test/StoryWrapper";

const meta = {
  title: "Atomic CRM/Propiedades/Propiedad Create",
  parameters: {
    layout: "fullscreen",
  },
  globals: {
    viewport: { value: "responsive", isRotated: false },
  },
} satisfies Meta;

export default meta;

export const PropiedadCreateBasic = ({
  dataProvider = {},
  silent,
}: {
  dataProvider?: Partial<DataProvider>;
  silent?: boolean;
}) => (
  <StoryWrapper
    initialEntries={["/propiedades/create"]}
    data={{ propiedades: [] }}
    dataProvider={dataProvider}
    silent={silent}
  >
    <PropiedadCreate />
  </StoryWrapper>
);
