import { Nav } from "@/components/layout/Nav";

export default function JobDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Job #{params.id}</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-neutral-800 p-4">Summary / artifacts / worker</section>
          <section className="rounded-xl border border-neutral-800 p-4">Live metrics</section>
          <section className="rounded-xl border border-neutral-800 p-4">Validator consensus (2-of-3)</section>
          <section className="rounded-xl border border-neutral-800 p-4">Solana tx + Tempo payment</section>
        </div>
      </main>
    </div>
  );
}
