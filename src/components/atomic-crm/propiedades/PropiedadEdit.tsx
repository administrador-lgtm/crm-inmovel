import { EditBase, Form, useEditContext } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import type { Propiedad } from "../types";
import { FormToolbar } from "../layout/FormToolbar";
import { PropiedadInputs } from "./PropiedadInputs";

export const PropiedadEdit = () => (
  <EditBase redirect="show">
    <PropiedadEditContent />
  </EditBase>
);

const PropiedadEditContent = () => {
  const { isPending, record } = useEditContext<Propiedad>();
  if (isPending || !record) return null;

  // Sheet-origin rows are read-only in the CRM (RLS enforces this server-side;
  // this notice is the friendly UI counterpart).
  if (record.crm_owned !== true) {
    return (
      <Card className="mt-2">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Esta propiedad se administra desde el Sheet; será editable tras la
            migración.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-2 flex">
      <Form className="flex flex-1 flex-col gap-4">
        <Card>
          <CardContent>
            <PropiedadInputs showDossier />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>
    </div>
  );
};
