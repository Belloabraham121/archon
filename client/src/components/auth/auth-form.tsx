"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { authClient } from "@/lib/auth-client";
import { notifyError } from "@/lib/notify";

type SignUpInput = {
  email: string;
  password: string;
  name: string;
  firstName: string;
  lastName: string;
};

type AuthResult = { error: { message?: string } | null };

// Server (backend/src/auth/auth.ts) declares firstName/lastName via
// additionalFields; the client SDK can't infer them, so the call is typed
// explicitly. Runtime sends every field as JSON — the server validates.
const signUpWithNames = authClient.signUp.email as (
  input: SignUpInput,
) => Promise<AuthResult>;

type AuthFormProps = {
  mode: "login" | "signup";
  submitLabel: string;
};

export function AuthForm({ mode, submitLabel }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { data: session, isPending: sessionPending } = authClient.useSession();

  // Already signed in (e.g. middleware cookie check raced, or back button):
  // don't show the form, go straight to the dashboard.
  useEffect(() => {
    if (!sessionPending && session) {
      router.replace("/dashboard");
    }
  }, [session, sessionPending, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") ?? "");
      const password = String(data.get("password") ?? "");
      if (isSignup) {
        const firstName = String(data.get("firstName") ?? "").trim();
        const lastName = String(data.get("lastName") ?? "").trim();
        const { error } = await signUpWithNames({
          email,
          password,
          name: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
        });
        if (error) throw new Error(error.message ?? "Sign up failed");
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message ?? "Sign in failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(notifyError(err, isSignup ? "Sign up failed" : "Sign in failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-9 space-y-5">
      {isSignup ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            id="firstName"
            label="First name"
            name="firstName"
            type="text"
            placeholder="Ada"
            autoComplete="given-name"
          />
          <AuthField
            id="lastName"
            label="Last name"
            name="lastName"
            type="text"
            placeholder="Lovelace"
            autoComplete="family-name"
          />
        </div>
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
            I agree to the{" "}
            <Link
              href="#"
              className="font-medium text-white/72 underline decoration-white/20 underline-offset-4"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="font-medium text-white/72 underline decoration-white/20 underline-offset-4"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#f1eee6] px-5 text-sm font-semibold text-[#080909] transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-white active:scale-[0.97] disabled:opacity-60"
      >
        {pending ? "Please wait…" : submitLabel}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  name: string;
  type: "email" | "password" | "text";
  placeholder: string;
  autoComplete: string;
};

function AuthField({ id, label, name, type, placeholder, autoComplete }: AuthFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold text-white/72">
          {label}
        </label>
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
