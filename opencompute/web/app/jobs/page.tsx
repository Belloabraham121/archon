import { Nav } from "@/components/layout/Nav";
import Link from "next/link";

export default function JobsPage() {
  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Jobs</h1>
          <Link href="/jobs/create" className="rounded-lg bg-white px-4 py-2 text-black">
            Create Compute Job
          </Link>
        </div>
        <p className="mt-4 text-neutral-400">Job list wires to Solana + WS events.</p>
      </main>
    </div>
  );
}
