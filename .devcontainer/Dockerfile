# Entwicklungsumgebung für GitHub Codespaces: Node.js 22, pnpm (über corepack), PostgreSQL 16.
FROM mcr.microsoft.com/devcontainers/typescript-node:22-bookworm

# PostgreSQL 16 aus dem offiziellen PGDG-Repository (Debian hat nur 15).
# Der Server läuft nicht als Dienst; pnpm db:start startet einen eigenen Cluster im Projektordner.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16 \
 && rm -rf /var/lib/apt/lists/*

# pnpm in der Version aus package.json (packageManager) über corepack.
RUN corepack enable pnpm

ENV PG_BIN=/usr/lib/postgresql/16/bin \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
