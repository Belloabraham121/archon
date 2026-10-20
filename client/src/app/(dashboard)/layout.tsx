import type { ReactNode } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell>
      <RequireAuth>{children}</RequireAuth>
    </DashboardShell>
  );
}
