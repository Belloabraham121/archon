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

export type Organization = {
  id: string;
  name: string;
  slug?: string | null;
  role: string;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const orgId = activeOrgId();
  const res = await fetch(`${API_URL}/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "x-organization-id": orgId } : {}),
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
