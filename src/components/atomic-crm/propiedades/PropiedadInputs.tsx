import { useState } from "react";
import { required, useCanAccess, useRecordContext } from "ra-core";
import { useWatch } from "react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";

import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { FileInput } from "@/components/admin/file-input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { AttachmentField } from "../notes/AttachmentField";
import type { Propiedad } from "../types";
import {
  LIFECYCLE_CHOICES,
  LIFECYCLE_CHOICES_NON_ADMIN,
} from "./propiedadLifecycle";

const TIPO_CHOICES = [
  { id: "propia", name: "Propia" },
  { id: "compartida", name: "Compartida" },
];

const OPERACION_CHOICES = [
  { id: "venta", name: "Venta" },
  { id: "renta", name: "Renta" },
];

const ESTATUS_CHOICES = [
  { id: "disponible", name: "Disponible" },
  { id: "apartado", name: "Apartado" },
];

interface PropiedadInputsProps {
  /** Edit-only extras: lifecycle selector + collapsible consultant dossier. */
  showDossier?: boolean;
}

export const PropiedadInputs = ({ showDossier }: PropiedadInputsProps) => (
  <div className="flex flex-col gap-8 p-1">
    <PropiedadIdentityInputs showLifecycle={showDossier} />
    <Separator />
    <PropiedadLocationInputs />
    <Separator />
    <PropiedadPricingInputs />
    <Separator />
    <PropiedadMaterialInputs />
    <PropiedadBrokerInputs />
    {showDossier ? <PropiedadDossierInputs /> : null}
  </div>
);

const PropiedadIdentityInputs = ({
  showLifecycle,
}: {
  showLifecycle?: boolean;
}) => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Identidad</h6>
    <TextInput source="nombre" label="Nombre" validate={required()} />
    <div className="flex flex-col md:flex-row gap-4">
      <SelectInput
        source="tipo"
        label="Tipo"
        choices={TIPO_CHOICES}
        defaultValue="propia"
        validate={required()}
        className="flex-1"
      />
      <SelectInput
        source="operacion"
        label="Operación"
        choices={OPERACION_CHOICES}
        defaultValue="venta"
        validate={required()}
        className="flex-1"
      />
      <SelectInput
        source="estatus"
        label="Estatus"
        choices={ESTATUS_CHOICES}
        defaultValue="disponible"
        className="flex-1"
      />
    </div>
    {showLifecycle ? <LifecycleStatusInput /> : null}
  </div>
);

/**
 * Lifecycle selector: advisors can move a property between draft, matchable
 * and archived on their own; only admins can expose it to the consultant bot
 * (consultor_active). See adr/ADR-propiedades-crm-owned-guard.md
 */
const LifecycleStatusInput = () => {
  const record = useRecordContext<Propiedad>();
  const { canAccess: isAdmin } = useCanAccess({
    resource: "sales",
    action: "list",
  });
  // Non-admins cannot grant consultor_active; when a property already has it,
  // lock the field so they cannot apply a one-way downgrade only an admin
  // could undo (and so the current value keeps a visible label).
  const isLockedForNonAdmin =
    !isAdmin && record?.lifecycle_status === "consultor_active";
  return (
    <SelectInput
      source="lifecycle_status"
      label="Estatus CRM"
      choices={
        isAdmin || isLockedForNonAdmin
          ? LIFECYCLE_CHOICES
          : LIFECYCLE_CHOICES_NON_ADMIN
      }
      readOnly={isLockedForNonAdmin}
    />
  );
};

const PropiedadLocationInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Ubicación</h6>
    <TextInput source="direccion" label="Dirección" />
    <div className="flex flex-col md:flex-row gap-4">
      <TextInput
        source="colonia"
        label="Colonia"
        validate={required()}
        className="flex-1"
      />
      <TextInput source="alcaldia" label="Alcaldía" className="flex-1" />
    </div>
    <TextInput source="url_maps" label="URL de Maps" />
  </div>
);

const PropiedadPricingInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Precio y especificaciones</h6>
    <NumberInput source="precio" label="Precio" validate={required()} />
    <div className="flex flex-col md:flex-row gap-4">
      <NumberInput source="metros" label="Metros" className="flex-1" />
      <NumberInput source="recamaras" label="Recámaras" className="flex-1" />
      <NumberInput source="banos" label="Baños" className="flex-1" />
      <NumberInput
        source="estacionamiento"
        label="Estacionamiento"
        className="flex-1"
      />
    </div>
  </div>
);

const PropiedadMaterialInputs = () => (
  <div className="flex flex-col gap-4">
    <h6 className="text-lg font-semibold">Material</h6>
    <FileInput source="material_files" label="Material de marketing" multiple>
      <AttachmentField source="src" title="title" target="_blank" />
    </FileInput>
  </div>
);

/** Broker details only make sense for shared (external) listings. */
const PropiedadBrokerInputs = () => {
  const tipo = useWatch({ name: "tipo" });
  if (tipo !== "compartida") return null;
  return (
    <div className="flex flex-col gap-4">
      <Separator />
      <h6 className="text-lg font-semibold">Broker</h6>
      <div className="flex flex-col md:flex-row gap-4">
        <TextInput
          source="broker_nombre"
          label="Nombre del broker"
          className="flex-1"
        />
        <TextInput source="comision" label="Comisión" className="flex-1" />
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <TextInput
          source="broker_telefono"
          label="Teléfono broker"
          className="flex-1"
        />
        <TextInput
          source="broker_wa"
          label="WhatsApp broker"
          className="flex-1"
        />
      </div>
    </div>
  );
};

/** Long-text sales-dossier fields; collapsed by default to keep Edit light. */
const PropiedadDossierInputs = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Separator />
      <Button
        type="button"
        variant="ghost"
        className="justify-start px-0 text-lg font-semibold"
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Dossier consultor
      </Button>
      {isOpen ? (
        <div className="flex flex-col gap-4">
          <TextInput source="argumento1" label="Argumento 1" multiline />
          <TextInput source="argumento2" label="Argumento 2" multiline />
          <TextInput source="argumento3" label="Argumento 3" multiline />
          <TextInput
            source="argumentos_zona"
            label="Argumentos de zona"
            multiline
          />
          <TextInput
            source="caracteristicas"
            label="Características"
            multiline
          />
          <TextInput source="amenidades" label="Amenidades" multiline />
          <TextInput source="esquema_pago" label="Esquema de pago" multiline />
          <TextInput source="creditos" label="Créditos" multiline />
          <TextInput source="objeciones" label="Objeciones" multiline />
          <TextInput
            source="precios_por_tipo"
            label="Precios por tipo"
            multiline
          />
          <TextInput
            source="tipos_unidades"
            label="Tipos de unidades"
            multiline
          />
          <div className="flex flex-col md:flex-row gap-4">
            <TextInput
              source="unidades_disponibles"
              label="Unidades disponibles"
              className="flex-1"
            />
            <TextInput
              source="fecha_entrega"
              label="Fecha de entrega"
              className="flex-1"
            />
            <TextInput
              source="enganche_minimo_pct"
              label="Enganche mínimo (%)"
              className="flex-1"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
