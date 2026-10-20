import Link from "next/link";

import { AuthVisual } from "@/components/auth/auth-visual";
import { AuthForm } from "@/components/auth/auth-form";
import { BrandLogo } from "@/components/brand/brand-logo";

type AuthShellProps = {
  mode: "login" | "signup";
};

const copy = {
  login: {
    title: "Welcome back.",
    description: "Continue to your policies, decision streams, and execution infrastructure.",
    submit: "Sign in",
    switchPrompt: "New to Archon?",
    switchLabel: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account.",
    description: "Start building programmable decisions for every onchain action.",
    submit: "Create account",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
  },
} as const;

export function AuthShell({ mode }: AuthShellProps) {
  const content = copy[mode];
  const isSignup = mode === "signup";

  return (
    <main className="min-h-svh bg-[#050606]">
      <div className="grid min-h-svh overflow-hidden bg-[#050606] lg:grid-cols-2">
        <AuthVisual mode={mode} />

        <section className="relative flex min-h-svh items-center justify-center border-white/[0.07] bg-[#070808] px-5 py-14 text-white sm:px-10 lg:border-l lg:px-14 xl:px-24">
          <div className="absolute left-6 top-6 lg:hidden">
            <BrandLogo priority inverse />
          </div>

          <div className="auth-form-card w-full max-w-[30rem]">
            <div className="text-center lg:text-left">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/32">
                {isSignup ? "Join Archon" : "Archon console"}
              </p>
              <h1 className="mt-4 bg-[linear-gradient(105deg,#8b8b87,#f4f4f1_48%,#8e8e8a)] bg-clip-text text-4xl font-semibold tracking-[-0.05em] text-transparent sm:text-5xl">
                {content.title}
              </h1>
              <p className="mt-4 text-pretty text-sm leading-6 text-white/42 sm:text-base">
                {content.description}
              </p>
            </div>

            <AuthForm mode={mode} submitLabel={content.submit} />

            <p className="mt-8 text-center text-sm text-white/36">
              {content.switchPrompt}{" "}
              <Link href={content.switchHref} className="font-semibold text-white/78 underline decoration-white/20 underline-offset-4 transition-colors duration-150 hover:text-white">
                {content.switchLabel}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
