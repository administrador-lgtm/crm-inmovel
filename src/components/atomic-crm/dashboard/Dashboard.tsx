import { PipelineWidget } from "./PipelineWidget";
import { VisitasProximasWidget } from "./VisitasProximasWidget";
import { LeadsFollowupWidget } from "./LeadsFollowupWidget";
import { HandoffUnassignedWidget } from "./HandoffUnassignedWidget";
import { MarketingWidget } from "./MarketingWidget";

/**
 * Inmovel operations dashboard: pipeline funnel, this week's visits, per-advisor
 * follow-up gaps, the unassigned handoff-ready queue, and live Meta marketing.
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
        <MarketingWidget />
        <HandoffUnassignedWidget />
      </div>
    </div>
  );
};
