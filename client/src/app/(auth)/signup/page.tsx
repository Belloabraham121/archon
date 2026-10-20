import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Archon account and start building programmable onchain decisions.",
};

export default function SignupPage() {
  return <AuthShell mode="signup" />;
}
