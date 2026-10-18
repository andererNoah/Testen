# Architekturentscheidungen (ADR)

Jede Entscheidung mit Tragweite bekommt eine nummerierte Datei. Format: Kontext, Entscheidung, Begründung, Konsequenzen, Status. Eine Entscheidung wird nicht gelöscht, sondern durch eine neue ersetzt („Ersetzt durch ADR-00xx“).

| Nr. | Titel | Status |
| --- | --- | --- |
| [0001](0001-modularer-monolith.md) | Modularer Monolith als pnpm-Monorepo in TypeScript | angenommen |
| [0002](0002-fastify-statt-nestjs.md) | Fastify + zod statt NestJS für die API | angenommen |
| [0003](0003-postgres-rls.md) | PostgreSQL mit Row-Level-Security für Mandanten- und Objekttrennung | angenommen |
| [0004](0004-geld-als-integer-cent.md) | Geldbeträge als Integer-Cent, zentrale Rundung | angenommen |
| [0005](0005-recht-als-versionierte-regeln.md) | Recht als versionierte Regeln im Katalog | angenommen |
| [0006](0006-bitemporale-historie.md) | Bitemporale Historie für Flächen, Anteile und Rollen | angenommen |
| [0007](0007-audit-per-trigger.md) | Audit-Log per Datenbank-Trigger, nur anhängend | angenommen |
| [0008](0008-frontend-react-vite.md) | Web-Oberfläche als React-SPA mit Vite und React Aria | angenommen |
| [0009](0009-identitaet-oidc.md) | OIDC-kompatible Token-Prüfung, Dev-Aussteller in Phase 0 | angenommen |
| [0010](0010-sprache-im-code.md) | Englische Bezeichner im Code, Fachglossar, deutsche Oberfläche | angenommen |
| [0011](0011-kysely-und-sql-migrationen.md) | Kysely als Query-Builder, Migrationen in reinem SQL | angenommen |
