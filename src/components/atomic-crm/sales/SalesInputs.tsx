import { email, required, useGetIdentity, useRecordContext } from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import type { Sale } from "../types";

export function SalesInputs() {
  const { identity } = useGetIdentity();
  const record = useRecordContext<Sale>();
  return (
    <div className="space-y-4 w-full">
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
      <TextInput
        source="email"
        validate={[required(), email()]}
        helperText={false}
      />
      <BooleanInput
        source="administrator"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
      <BooleanInput
        source="disabled"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
      <TextInput source="telefono" helperText={false} />
      <TextInput source="calendario" helperText={false} />
      <SelectInput
        source="linea_negocio"
        choices={[
          { id: "exclusiva", name: "Exclusiva" },
          { id: "compartida", name: "Compartida" },
        ]}
        helperText={false}
      />
      <BooleanInput source="activo" helperText={false} />
    </div>
  );
}
