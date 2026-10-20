import { toast } from "sonner";

/** Normalizes unknown throwables (fetch failures, API envelopes) to a message. */
export function messageOf(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message) return cause.message;
  return fallback;
}

/**
 * Error toast with the action as title and the backend reason as description.
 * Call from event handlers and promise callbacks (client-only).
 */
export function notifyError(cause: unknown, action: string): string {
  const message = messageOf(cause, action);
  if (message === action) {
    toast.error(action);
  } else {
    toast.error(action, { description: message });
  }
  return message;
}

/** Success toast for completed mutations. */
export function notifySuccess(title: string, description?: string) {
  if (description) toast.success(title, { description });
  else toast.success(title);
}
