import { notFound } from "next/navigation";
import { DashboardSectionPage, dashboardSections } from "@/components/dashboard/dashboard-section-page";
import { ApiKeysManager } from "@/components/dashboard/api-keys-manager";
import { IntentsWorkspace } from "@/components/dashboard/intents-workspace";
import { OrganizationsManager } from "@/components/dashboard/organizations-manager";
import { PoliciesManager } from "@/components/dashboard/policies-manager";
import { ReplaysManager } from "@/components/dashboard/replays-manager";
import { JudgmentMetrics } from "@/components/dashboard/judgment-metrics";
import { ExecutionWorkspace } from "@/components/dashboard/execution-workspace";
import { ApprovalsWorkspace } from "@/components/dashboard/approvals-workspace";

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
  if (section === "decisions") return <JudgmentMetrics />;
  if (section === "executions") return <ExecutionWorkspace />;
  if (section === "approvals") return <ApprovalsWorkspace />;
  return <DashboardSectionPage section={section as keyof typeof dashboardSections} />;
}
