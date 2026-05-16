// Thin fetch wrapper that:
//   - injects the Bearer token
//   - parses the JSON envelope
//   - turns non-2xx into a typed ApiError so callers can `try { ... } catch`
//
// The actual HTTP is fetch(), so no third-party dependency. Bun ships fetch
// with native HTTP/2 + connection pooling already, plenty fast.

import { loadConfig } from "../config";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export class UnauthenticatedError extends ApiError {
  constructor() {
    super(401, "Not logged in. Run `gentity login` first.");
    this.name = "UnauthenticatedError";
  }
}

interface RequestOpts {
  method?: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  body?: unknown;
  // If true, missing token throws UnauthenticatedError before the request
  // is made. Use for every command except `login`.
  requireAuth?: boolean;
}

export async function apiRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const cfg = await loadConfig();
  const { method = "GET", body, requireAuth = true } = opts;

  if (requireAuth && !cfg.token) throw new UnauthenticatedError();

  const url = `${cfg.apiUrl}${path}`;
  const headers: Record<string, string> = { "User-Agent": "gentity-cli/0.0.1" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cfg.token) headers["Authorization"] = `Bearer ${cfg.token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, `Network error calling ${url}: ${message}`);
  }

  if (res.status === 401) {
    throw new UnauthenticatedError();
  }

  if (!res.ok) {
    // The control plane returns `{ error: string }` on failure. Try to
    // surface that; fall back to the raw text or status line otherwise.
    let detail: string;
    try {
      const j = (await res.json()) as { error?: string };
      detail = j.error ?? `${res.status} ${res.statusText}`;
    } catch {
      detail = `${res.status} ${res.statusText}`;
    }
    throw new ApiError(res.status, detail);
  }

  // Some endpoints return `{ ok: true }` with no payload; handle that too.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
