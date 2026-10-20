import { Nav } from "@/components/layout/Nav";

export default function PaymentsPage() {
  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="mt-2 text-neutral-400">Tempo stablecoin payouts: worker + validators.</p>
      </main>
    </div>
  );
}
