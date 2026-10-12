import { notFound } from "next/navigation";
import { DashboardSectionPage, dashboardSections } from "@/components/dashboard/dashboard-section-page";
import { ApiKeysManager } from "@/components/dashboard/api-keys-manager";
import { IntentsWorkspace } from "@/components/dashboard/intents-workspace";
import { OrganizationsManager } from "@/components/dashboard/organizations-manager";
import { PoliciesManager } from "@/components/dashboard/policies-manager";
import { ReplaysManager } from "@/components/dashboard/replays-manager";
import { DecisionsWorkspace } from "@/components/dashboard/decisions-workspace";
import { ExecutionWorkspace } from "@/components/dashboard/execution-workspace";
import { ApprovalsWorkspace } from "@/components/dashboard/approvals-workspace";
import { OperationsWorkspace } from "@/components/dashboard/operations-workspace";
import { AuditWorkspace } from "@/components/dashboard/audit-workspace";
import { ConnectorsWorkspace } from "@/components/dashboard/connectors-workspace";
import { SettingsWorkspace } from "@/components/dashboard/settings-workspace";
import { TeamWorkspace } from "@/components/dashboard/team-workspace";
import { ExecutionMaintenance } from "@/components/dashboard/execution-maintenance";

export function generateStaticParams() { return Object.keys(dashboardSections).map((section) => ({ section })); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in dashboardSections)) notFound();
  // Live screens replace their static stubs as each phase lands (see implementation-plan.md).
  if (section === "developers") return <ApiKeysManager />;
  if (section === "intents") return <IntentsWorkspace />;
  if (section === "organizations") return <OrganizationsManager />;
  if (section === "policies") return <PoliciesManager />;
  if (section === "replays") return <ReplaysManager />;
  if (section === "decisions") return <DecisionsWorkspace />;
  if (section === "executions") return <><ExecutionWorkspace /><ExecutionMaintenance /></>;
  if (section === "approvals") return <ApprovalsWorkspace />;
  if (section === "operations") return <OperationsWorkspace />;
  if (section === "audit") return <AuditWorkspace />;
  if (section === "connections") return <ConnectorsWorkspace />;
  if (section === "settings") return <SettingsWorkspace />;
  if (section === "team") return <TeamWorkspace />;
  return <DashboardSectionPage section={section as keyof typeof dashboardSections} />;
}
