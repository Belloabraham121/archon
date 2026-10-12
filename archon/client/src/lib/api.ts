import { API_URL } from "@/lib/auth-client";

export function activeOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("archon:orgId");
}

export function setActiveOrgId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem("archon:orgId", id);
  else window.localStorage.removeItem("archon:orgId");
  window.dispatchEvent(new CustomEvent("archon:organization-changed", { detail: id }));
}

export type ArchonEnvironment = "test" | "live";

export function activeEnvironment(): ArchonEnvironment {
  if (typeof window === "undefined") return "test";
  return window.localStorage.getItem("archon:environment") === "live" ? "live" : "test";
}

export function setActiveEnvironment(environment: ArchonEnvironment) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("archon:environment", environment);
  window.dispatchEvent(new CustomEvent("archon:environment-changed", { detail: environment }));
  // Existing tenant-scoped workspaces already refresh on this event. Reuse it
  // so switching environments cannot leave test data visible under the live badge.
  window.dispatchEvent(new CustomEvent("archon:organization-changed", { detail: activeOrgId() }));
}

export type Organization = {
  id: string;
  name: string;
  slug?: string | null;
  role: string;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const orgId = activeOrgId();
  const method = (init?.method ?? "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const res = await fetch(`${API_URL}/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "x-organization-id": orgId } : {}),
      "x-environment": activeEnvironment(),
      ...(mutating ? { "Idempotency-Key": crypto.randomUUID() } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Session expired or revoked mid-visit: drop back to sign-in.
    // Middleware will hold the user there until they re-authenticate.
    if (res.status === 401 && typeof window !== "undefined") {
      setActiveOrgId(null);
      const next = window.location.pathname;
      // Hard navigation (not router.push): guarantees all cached session
      // state is dropped along with the expired session.
      const login = new URL("/login", window.location.origin);
      login.searchParams.set("next", next);
      window.location.href = login.toString();
      throw new Error("Session expired — please sign in again");
    }
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { message?: string | string[] }).message ??
      `Request failed (${res.status})`;
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
  return res.json() as Promise<T>;
}

export async function apiWithKey<T>(
  path: string,
  apiKey: string,
  organizationId: string,
  environment: ArchonEnvironment,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const res = await fetch(`${API_URL}/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-organization-id": organizationId,
      "x-environment": environment,
      ...(mutating ? { "Idempotency-Key": crypto.randomUUID() } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (body as { message?: string | string[] }).message ?? `Request failed (${res.status})`;
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
  return body as T;
}
