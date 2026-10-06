import { createAuthClient } from "better-auth/react";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const authClient = createAuthClient({ baseURL: API_URL });

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function displayName(user: SessionUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.name || user.email;
}

export function initialsOf(user: SessionUser): string {
  const parts = [user.firstName, user.lastName].filter(Boolean) as string[];
  if (parts.length > 0) return parts.map((p) => p[0]).join("").toUpperCase();
  return (user.name || user.email).slice(0, 2).toUpperCase();
}
