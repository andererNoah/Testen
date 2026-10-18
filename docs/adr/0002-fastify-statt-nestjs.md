# ADR-0002: Fastify + zod statt NestJS für die API

Status: angenommen · 18.10.2026 · Abweichung vom Stack-Vorschlag im Prompt

## Kontext

Der Prompt schlägt NestJS vor und verlangt eine Begründung für Abweichungen.

## Entscheidung

Die API nutzt **Fastify 5** mit **zod 4** als einziger Schema-Quelle (Validierung, TypeScript-Typen, OpenAPI über `fastify-type-provider-zod` und `@fastify/swagger`). Abhängigkeiten werden über Konstruktor-/Funktionsparameter übergeben, nicht über einen DI-Container.

## Begründung

- **Eine Schema-Quelle**: zod-Schemas erzeugen Validierung, Typen und OpenAPI. In NestJS braucht man dafür DTO-Klassen plus Decorators plus Swagger-Decorators, also drei parallele Beschreibungen.
- **Keine Decorator-Metadaten**: NestJS benötigt `emitDecoratorMetadata`, was esbuild/Vitest nur über Zusatz-Plugins (SWC) unterstützen. Fastify-Code läuft unverändert unter Vitest, tsx und esbuild.
- **Modulgrenzen** erzwingen wir über Workspace-Pakete und Lint-Regeln, nicht über NestJS-Module. Das wirkt auch für Code außerhalb der HTTP-Schicht (Jobs, Importe).
- Fastify ist schnell (Performance-Ziel p95 < 300 ms) und hat ein stabiles Plugin-Ökosystem (Multipart, Swagger, Rate-Limit).

## Konsequenzen

- Querschnittsthemen (Auth, Mandanten-Kontext, Fehlerformat) liegen als Fastify-Plugins in `apps/api/src/plugins`.
- Wer NestJS-Konventionen erwartet, findet sie hier nicht; die Struktur je Modul ist in `CLAUDE.md` beschrieben.
