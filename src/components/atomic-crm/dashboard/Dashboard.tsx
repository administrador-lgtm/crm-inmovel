import { Card, CardContent } from "@/components/ui/card";

import { PipelineWidget } from "./PipelineWidget";
import { VisitasProximasWidget } from "./VisitasProximasWidget";
import { LeadsFollowupWidget } from "./LeadsFollowupWidget";
import { HandoffUnassignedWidget } from "./HandoffUnassignedWidget";

/** Placeholder for ④ "Vista Marketing" (live Meta ad insights) — wired next. */
const MarketingPlaceholder = () => (
  <Card>
    <CardContent className="flex h-full min-h-[8rem] flex-col items-center justify-center pt-5 text-center">
      <p className="text-sm font-semibold text-muted-foreground">
        Vista Marketing
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Cómo vamos (Meta, live) — próximamente
      </p>
    </CardContent>
  </Card>
);

/**
 * Inmovel operations dashboard: pipeline funnel, this week's visits, per-advisor
 * follow-up gaps, and the unassigned handoff-ready queue. The Marketing panel
 * (live Meta insights) is stubbed until its integration lands.
 */
export const Dashboard = () => {
  return (
    <div className="mt-1 flex flex-col gap-6">
      <PipelineWidget />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VisitasProximasWidget />
        <LeadsFollowupWidget />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MarketingPlaceholder />
        <HandoffUnassignedWidget />
      </div>
    </div>
  );
};
