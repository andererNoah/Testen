# ADR-0009: OIDC-kompatible Token-Prüfung, Dev-Aussteller in Phase 0

Status: angenommen · 18.10.2026

## Entscheidung

- Die API akzeptiert nur Bearer-Tokens (JWT) und prüft Signatur, Aussteller, Zielgruppe und Ablauf mit `jose`.
- Konfiguration: entweder `AUTH_JWKS_URL` (OIDC-Anbieter, z. B. Keycloak, ab Phase 1) oder `AUTH_DEV_SECRET` (HS256, nur Entwicklung und Tests).
- Phase 0 enthält einen Dev-Login-Endpunkt `POST /v1/dev/login`, der nur bei gesetztem `AUTH_DEV_SECRET` und `NODE_ENV !== 'production'` existiert.
- Mandant und Benutzer kommen aus dem Token (`tid`, `sub`); Rollen lädt die API aus der Datenbank, nicht aus dem Token, damit entzogene Rechte sofort wirken.

## Konsequenzen

- Magic Link, Passkeys und MFA (V12) liefert der OIDC-Anbieter; das Datenmodell trennt Login (`users`) von Person (`persons`).
- Keycloak-Anbindung und Portal-Login sind Phase 1.
