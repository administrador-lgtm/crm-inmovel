import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import type { Propiedad } from "../types";
import { FormToolbar } from "../layout/FormToolbar";
import { PropiedadInputs } from "./PropiedadInputs";

/**
 * Minimal create form for advisor-captured properties. New rows are stamped
 * CRM-owned and start as draft: they never reach the matcher (or, later, the
 * bot) until the advisor publishes them from the Edit page.
 * See adr/ADR-propiedades-crm-owned-guard.md
 */
export const PropiedadCreate = () => {
  const { identity } = useGetIdentity();

  const transform = (data: Propiedad): Propiedad => ({
    ...data,
    crm_owned: true,
    lifecycle_status: "draft",
    created_by: identity?.id,
    fuente: "crm",
    fecha_carga: new Date().toISOString(),
  });

  return (
    <CreateBase redirect="show" transform={transform}>
      <div className="mt-2 flex">
        <div className="flex-1">
          <Form>
            <Card>
              <CardContent>
                <PropiedadInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
