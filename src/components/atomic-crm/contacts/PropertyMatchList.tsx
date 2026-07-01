import { useGetList, useTranslate } from "ra-core";
import type { Identifier } from "ra-core";
import { MessageCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type { LeadPropertyMatch } from "../types";
import { formatPrecio } from "../nocnok/types";

/**
 * Source-tier label, in Spanish (the advisor-facing UI language). Lower tier is
 * a better source: own inventory first, then the qualified pool, then Lamudi.
 */
const TIER_LABELS: Record<number, string> = {
  1: "Propias",
  2: "Bolsa calificada",
  3: "Lamudi",
};

const TIER_ORDER = [1, 2, 3];

// Popular zones match hundreds of listings; cap the ficha at the best-ranked
// few so the advisor sees signal, not a wall. rank_score already favours lower
// tiers, so the top slice is naturally own/qualified-pool heavy.
const TOP_N = 24;

interface PropertyMatchListProps {
  leadId: Identifier;
}

/**
 * Read-only "Propiedades sugeridas" section on the lead ficha. Reads the
 * `lead_property_matches` view (RLS-scoped to the lead owner) for one lead and
 * renders the suggestions grouped by source tier. A lead with no match profile
 * (not matchable) yields zero rows from the view and shows the empty-state —
 * never an error and never an endless spinner.
 */
export const PropertyMatchList = ({ leadId }: PropertyMatchListProps) => {
  const translate = useTranslate();
  const { data, isPending, error } = useGetList<LeadPropertyMatch>(
    "lead_property_matches",
    {
      filter: { lead_id: leadId },
      sort: { field: "rank_score", order: "DESC" },
      pagination: { page: 1, perPage: TOP_N },
    },
  );

  // Keep the section hidden until the first fetch settles, so a not-matchable
  // lead never flashes a spinner on the ficha.
  if (isPending) return null;

  // A query error is treated like "no suggestions" — the section degrades to the
  // empty-state rather than surfacing an error on the ficha.
  const matches = error ? [] : (data ?? []);

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <h3 className="text-md font-semibold mb-3">
          {translate("crm.propertyMatch.title", {
            _: "Propiedades sugeridas",
          })}
        </h3>
        {matches.length >= TOP_N ? (
          <p className="text-xs text-muted-foreground mb-3">
            {translate("crm.propertyMatch.capped", {
              n: TOP_N,
              _: `Mostrando las ${TOP_N} más relevantes.`,
            })}
          </p>
        ) : null}
        {matches.length > 0 ? (
          <PropertyMatchGroups matches={matches} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {translate("crm.propertyMatch.empty", {
              _: "Sin propiedades sugeridas.",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

/** Render the matches grouped by tier, best-ranked first within each tier. */
const PropertyMatchGroups = ({ matches }: { matches: LeadPropertyMatch[] }) => {
  const groups = TIER_ORDER.map((tier) => ({
    tier,
    rows: matches
      .filter((match) => match.tier === tier)
      .sort((a, b) => b.rank_score - a.rank_score),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.tier}>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {TIER_LABELS[group.tier] ?? `Tier ${group.tier}`}
          </h4>
          <ul className="flex flex-col gap-2">
            {group.rows.map((match) => (
              <PropertyMatchRow key={match.id} match={match} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

/**
 * One suggested-property row. The whole row is the listing link (own ficha
 * preferred, anuncio as fallback) with a >=44px tap target for mobile; rows
 * without any URL render as a plain, non-interactive card.
 */
const PropertyMatchRow = ({ match }: { match: LeadPropertyMatch }) => {
  const href = match.url_ficha ?? match.url_anuncio ?? null;
  const precio = formatPrecio(match.precio ?? undefined);
  const location = [match.colonia, match.alcaldia].filter(Boolean).join(" · ");
  // Qualified-pool (NocNok) fichas open under our own account, so the advisor
  // can't reach the listing broker from there. Surface the broker's WhatsApp
  // (and name) directly on the row for co-brokering.
  const showBroker = match.property_source === "nocnok" && !!match.broker_wa;

  const content = (
    <>
      {match.title && (
        <span className="font-medium break-words">{match.title}</span>
      )}
      <span className="text-sm">
        {precio ?? "Precio no disponible"}
        {match.recamaras != null ? ` · ${match.recamaras} rec.` : ""}
      </span>
      {location && (
        <span className="text-xs text-muted-foreground break-words">
          {location}
        </span>
      )}
      {showBroker && match.broker_nombre && (
        <span className="text-xs text-muted-foreground break-words">
          Broker: {match.broker_nombre}
        </span>
      )}
    </>
  );

  const main = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 flex-1 flex-col justify-center hover:underline"
    >
      {content}
    </a>
  ) : (
    <div className="flex min-w-0 flex-1 flex-col justify-center">{content}</div>
  );

  return (
    <li className="flex min-h-[44px] items-center gap-2 rounded-md border p-3">
      {main}
      {showBroker && (
        <a
          href={match.broker_wa ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-md border border-green-600 px-2 text-xs font-medium text-green-700 hover:bg-green-50"
          title={
            match.broker_nombre
              ? `WhatsApp del broker (${match.broker_nombre})`
              : "WhatsApp del broker"
          }
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">WhatsApp broker</span>
        </a>
      )}
    </li>
  );
};
