import { Nav } from "@/components/layout/Nav";

export default function CreateJobPage() {
  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-bold">Create Compute Job</h1>
        {/* Fields per FRONTEND.md: task, model CID, dataset CID, compute, training, validation, reward */}
        <form className="mt-6 space-y-4">
          {["Model CID", "Dataset CID", "Min VRAM (MB)", "Steps", "Max loss", "Min score", "Reward (USDC)"].map((f) => (
            <div key={f}>
              <label className="text-sm text-neutral-400">{f}</label>
              <input className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3" />
            </div>
          ))}
          <button className="rounded-lg bg-white px-5 py-3 font-medium text-black">
            Create Compute Job
          </button>
        </form>
      </main>
    </div>
  );
}
