const BASE = "/api/v1";
const XHR = { "X-Requested-With": "XMLHttpRequest" };

// The access token lives in memory only. The refresh token is an HttpOnly, SameSite=Strict cookie set by the API,
// so scripts on the page can never read it; reloading the tab silently gets a fresh access token from that cookie.
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export const setAccessToken = (token: string | null) => { accessToken = token; };
export const setSessionExpiredHandler = (fn: (() => void) | null) => { onSessionExpired = fn; };

export type Params = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const detail = body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : null;
    super(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.join(" ") : `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

export function qs(params?: Params): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshAccess(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh/`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...XHR }, body: "{}" });
        if (!res.ok) { accessToken = null; return false; }
        accessToken = ((await res.json()) as { access: string }).access;
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function serverLogout() {
  try { await fetch(`${BASE}/auth/logout/`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...XHR }, body: "{}" }); } catch { /* offline: the cookie expires anyway */ }
  accessToken = null;
}

interface Options {
  method?: string;
  json?: unknown;
  form?: FormData;
  params?: Params;
  signal?: AbortSignal;
  /** Auth endpoints (login, reset) must not trigger a refresh-and-retry. */
  anonymous?: boolean;
}

async function send(path: string, o: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken && !o.anonymous) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (o.form) body = o.form; // the browser sets the multipart boundary itself
  else if (o.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(o.json); }
  return fetch(`${BASE}${path}${qs(o.params)}`, { method: o.method ?? (body ? "POST" : "GET"), headers, body, signal: o.signal, credentials: "same-origin" });
}

async function request(path: string, o: Options): Promise<Response> {
  let res = await send(path, o);
  if (res.status === 401 && !o.anonymous) {
    if (await refreshAccess()) res = await send(path, o);
    if (res.status === 401) onSessionExpired?.();
  }
  return res;
}

export async function api<T = unknown>(path: string, o: Options = {}): Promise<T> {
  const res = await request(path, o);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Authenticated file fetch (photos, documents). Plain links can't carry the bearer token, so we fetch a blob. */
export async function fetchBlob(path: string): Promise<Blob> {
  const res = await request(path, {});
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.blob();
}

export async function downloadFile(path: string, fallbackName: string) {
  const res = await request(path, {});
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? decodeURIComponent(match[1]) : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** DRF validation errors as {field: message}; non-field errors under "_". */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof ApiError && err.status === 400 && err.body && typeof err.body === "object" && !Array.isArray(err.body)) {
    for (const [k, v] of Object.entries(err.body as Record<string, unknown>)) {
      const msg = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") : typeof v === "string" ? v : JSON.stringify(v);
      out[k === "detail" || k === "non_field_errors" ? "_" : k] = msg;
    }
  }
  return out;
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return err.message === `Request failed (403)` ? "You don't have permission to do that." : err.message;
    if (err.status === 429) return "Too many attempts. Please wait a moment and try again.";
    if (err.status >= 500) return "The server hit a problem. Please try again shortly.";
    const fe = fieldErrors(err);
    const parts = Object.entries(fe).map(([k, v]) => (k === "_" ? v : `${k.replace(/_/g, " ")}: ${v}`));
    if (parts.length) return parts.join(" · ");
    return err.message;
  }
  if (err instanceof TypeError) return "Can't reach the server. Check your connection.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Errors to show on a form: field errors when the server sent them, otherwise one general message under "_". */
export function formErrors(err: unknown): Record<string, string> {
  const fe = fieldErrors(err);
  return Object.keys(fe).length ? fe : { _: errorText(err) };
}
