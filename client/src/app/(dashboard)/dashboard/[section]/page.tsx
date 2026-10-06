import { notFound } from "next/navigation";
import { DashboardSectionPage, dashboardSections } from "@/components/dashboard/dashboard-section-page";
import { ApiKeysManager } from "@/components/dashboard/api-keys-manager";

export function generateStaticParams() { return Object.keys(dashboardSections).map((section) => ({ section })); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in dashboardSections)) notFound();
  // Live screens replace their static stubs as each phase lands (see implementation-plan.md).
  if (section === "developers") return <ApiKeysManager />;
  return <DashboardSectionPage section={section as keyof typeof dashboardSections} />;
}
