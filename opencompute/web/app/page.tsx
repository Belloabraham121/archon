import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm uppercase tracking-widest text-neutral-400">
        Proof of Useful Compute
      </p>
      <h1 className="mt-4 text-5xl font-bold leading-tight">
        Any capable device should earn for useful AI compute.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-neutral-400">
        Requesters post fine-tuning jobs. Workers train. Validators verify
        2-of-3. Solana finalizes. Tempo settles stablecoins. Watch it live.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-white px-5 py-3 font-medium text-black"
        >
          Log in / Connect
        </Link>
        <Link
          href="/overview"
          className="rounded-lg border border-neutral-700 px-5 py-3 font-medium"
        >
          View network dashboard
        </Link>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {["Create job", "Worker trains + submits", "2-of-3 verified → paid"].map(
          (s) => (
            <div key={s} className="rounded-xl border border-neutral-800 p-4">
              {s}
            </div>
          )
        )}
      </div>
    </main>
  );
}
