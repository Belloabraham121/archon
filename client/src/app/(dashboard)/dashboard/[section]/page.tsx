import { notFound } from "next/navigation";
import { DashboardSectionPage, dashboardSections } from "@/components/dashboard/dashboard-section-page";

export function generateStaticParams() { return Object.keys(dashboardSections).map((section) => ({ section })); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in dashboardSections)) notFound();
  return <DashboardSectionPage section={section as keyof typeof dashboardSections} />;
}
