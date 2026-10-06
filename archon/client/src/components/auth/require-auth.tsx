"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * In-app auth gate for the dashboard. Middleware keeps logged-out visitors
 * out at the edge, but only a live session check catches expired/revoked
 * sessions (cookie present, backend says no).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !data) {
      router.replace("/login?next=/dashboard");
      router.refresh();
    }
  }, [data, isPending, router]);

  if (isPending) {
    return (
      <div className="grid min-h-[60svh] place-items-center" aria-live="polite">
        <div className="flex items-center gap-3 text-sm text-white/45">
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/15 border-t-white/70"
          />
          Verifying session…
        </div>
      </div>
    );
  }

  if (!data) return null;

  return <>{children}</>;
}
