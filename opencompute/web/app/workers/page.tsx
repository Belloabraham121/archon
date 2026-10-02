import { Nav } from "@/components/layout/Nav";

export default function WorkersPage() {
  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold">Workers</h1>
        <p className="mt-2 text-neutral-400">Filters: available / busy / offline / GPU / role</p>
      </main>
    </div>
  );
}
