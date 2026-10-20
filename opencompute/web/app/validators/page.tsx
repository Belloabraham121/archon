import { Nav } from "@/components/layout/Nav";

export default function ValidatorsPage() {
  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Validators</h1>
        <p className="mt-2 text-neutral-400">Committee votes + 2/3 quorum → VERIFIED transition.</p>
      </main>
    </div>
  );
}
