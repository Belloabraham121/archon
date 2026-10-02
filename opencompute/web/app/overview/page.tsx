import { Nav } from "@/components/layout/Nav";
import { StatusCard } from "@/components/ui/StatusCard";

export default function OverviewPage() {
  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-6">
          <StatusCard label="Workers Online" value="—" />
          <StatusCard label="Validators Online" value="—" />
          <StatusCard label="Active Jobs" value="—" />
          <StatusCard label="Jobs Completed" value="—" />
          <StatusCard label="Compute Done" value="—" />
          <StatusCard label="Rewards Paid" value="—" />
        </div>
        <div className="mt-6 rounded-xl border border-neutral-800 p-6">
          Active job panel + live telemetry + loss chart hook into WebSocket
          feed (see lib/ws, hooks/useJobFeed).
        </div>
      </main>
    </div>
  );
}
