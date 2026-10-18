import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { clearSession, getToken } from "../auth/session";

/** problem+json (RFC 9457) as returned by the API. */
export interface ApiError {
  status: number;
  code: string;
  title: string;
  detail: string;
  requestId?: string;
  issues?: Array<{ path: string; message: string }>;
  candidates?: Array<{ personId: string; displayName: string; score: number; reasons: string[] }>;
}

export class ApiRequestError extends Error implements ApiError {
  status: number;
  code: string;
  title: string;
  detail: string;
  requestId?: string;
  issues?: ApiError["issues"];
  candidates?: ApiError["candidates"];
  constructor(problem: ApiError) {
    super(problem.detail);
    this.status = problem.status;
    this.code = problem.code;
    this.title = problem.title;
    this.detail = problem.detail;
    this.requestId = problem.requestId;
    this.issues = problem.issues;
    this.candidates = problem.candidates;
  }
}

const auth: Middleware = {
  onRequest({ request }) {
    const token = getToken();
    if (token) request.headers.set("authorization", `Bearer ${token}`);
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401 && !response.url.includes("/dev/")) {
      clearSession();
      window.location.assign(`/anmelden?weiter=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    return response;
  },
};

export const api = createClient<paths>({ baseUrl: "" });
api.use(auth);

function toError(error: unknown, response: Response): ApiRequestError {
  const p = (error ?? {}) as Partial<ApiError>;
  return new ApiRequestError({
    status: p.status ?? response.status,
    code: p.code ?? "unknown",
    title: p.title ?? "Fehler",
    detail: p.detail ?? `Die Anfrage ist fehlgeschlagen (${response.status}).`,
    requestId: p.requestId ?? response.headers.get("x-request-id") ?? undefined,
    issues: p.issues,
    candidates: p.candidates,
  });
}

/** Unwraps an openapi-fetch result or throws ApiRequestError. */
export async function unwrap<T>(promise: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await promise;
  if (error !== undefined || !response.ok) throw toError(error, response);
  return data as T;
}

/** Multipart upload (openapi-fetch does not type multipart bodies). */
export async function upload<T>(url: string, form: FormData): Promise<T> {
  const token = getToken();
  const response = await fetch(url, { method: "POST", body: form, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw toError(body, response);
  return body as T;
}

/** Authenticated file download. */
export async function download(url: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const response = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw toError(await response.json().catch(() => undefined), response);
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(disposition);
  const name = match ? decodeURIComponent(match[1] ?? match[2] ?? fallbackName) : fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}
