import Link from "next/link";
import type { ReactNode } from "react";

import { AuthVisual } from "@/components/auth/auth-visual";
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

            <form className="mt-9 space-y-5">
              {isSignup ? (
                <AuthField
                  id="name"
                  label="Full name"
                  name="name"
                  type="text"
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                />
              ) : null}

              <AuthField
                id="email"
                label="Email"
                name="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
              />

              <AuthField
                id="password"
                label="Password"
                name="password"
                type="password"
                placeholder="••••••••••••"
                autoComplete={isSignup ? "new-password" : "current-password"}
                trailing={
                  isSignup ? null : (
                    <Link href="#" className="text-xs font-medium text-white/35 transition-colors duration-150 hover:text-white/75">
                      Forgot password?
                    </Link>
                  )
                }
              />

              {isSignup ? (
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/38">
                  <input
                    required
                    type="checkbox"
                    name="terms"
                    className="mt-0.5 size-4 rounded border-white/15 accent-[#e3dac9]"
                  />
                  <span>
                    I agree to the <Link href="#" className="font-medium text-white/72 underline decoration-white/20 underline-offset-4">Terms</Link> and <Link href="#" className="font-medium text-white/72 underline decoration-white/20 underline-offset-4">Privacy Policy</Link>.
                  </span>
                </label>
              ) : null}

              <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#f1eee6] px-5 text-sm font-semibold text-[#080909] transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-white active:scale-[0.97]">
                {content.submit}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <div className="my-7 flex items-center gap-4 text-xs text-white/28">
              <span className="h-px flex-1 bg-white/[0.08]" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SocialButton icon="G" label="Google" />
              <SocialButton icon="◆" label="Wallet" />
            </div>

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

type AuthFieldProps = {
  id: string;
  label: string;
  name: string;
  type: "email" | "password" | "text";
  placeholder: string;
  autoComplete: string;
  trailing?: ReactNode;
};

function AuthField({ id, label, name, type, placeholder, autoComplete, trailing }: AuthFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold text-white/72">
          {label}
        </label>
        {trailing}
      </div>
      <input
        required
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="min-h-13 w-full rounded-xl border border-white/[0.1] bg-white/[0.035] px-4 text-[0.95rem] text-white/86 shadow-[inset_0_1px_rgb(255_255_255_/_4%)] outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-white/22 focus:border-[#8bd6d5]/55 focus:bg-white/[0.055] focus:shadow-[0_0_0_3px_rgb(139_214_213_/_9%)]"
      />
    </div>
  );
}

function SocialButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.035] px-4 text-sm font-semibold text-white/70 transition-[background-color,border-color,transform] duration-150 hover:border-white/20 hover:bg-white/[0.065] active:scale-[0.97]"
    >
      <span className="grid size-6 place-items-center rounded-full bg-[#f1eee6] text-xs font-bold text-[#080909]" aria-hidden="true">
        {icon}
      </span>
      Continue with {label}
    </button>
  );
}
