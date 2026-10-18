/**
 * Session token for the development login (ADR-0009). Kept per browser tab (sessionStorage);
 * the OIDC login in Phase 1 replaces this module.
 */
const KEY = "hv.token";

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable: the user has to log in again on reload */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
