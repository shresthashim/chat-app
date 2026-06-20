import { API_URL } from "../config";
import type { ApiEnvelope } from "@/types";

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;
  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Internal: prevents infinite refresh loops. */
  _retry?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

/** Attempt a single token refresh, de-duplicated across concurrent 401s. */
async function refreshSession(): Promise<boolean> {
  refreshPromise ??= fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/**
 * Typed fetch wrapper. Always sends cookies, unwraps the API envelope, and
 * transparently refreshes the access token once on a 401 before retrying.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, _retry, ...rest } = options;
  const isFormData = body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_retry && !path.startsWith("/api/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch<T>(path, { ...options, _retry: true });
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. 204) — fall through.
  }

  if (!res.ok || (payload && payload.success === false)) {
    throw new ApiError(res.status, payload?.message ?? `Request failed (${res.status})`, payload?.details);
  }

  return (payload?.data ?? (null as T)) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: "POST", body: form }),
};
