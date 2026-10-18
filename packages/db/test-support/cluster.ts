import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { chown, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

async function pgBinDir(): Promise<string> {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  try {
    const { stdout } = await execFile("pg_config", ["--bindir"]);
    return stdout.trim();
  } catch {
    throw new Error("PostgreSQL nicht gefunden: pg_config fehlt. PG_BIN setzen oder TEST_DATABASE_ADMIN_URL angeben.");
  }
}

const isRoot = () => typeof process.getuid === "function" && process.getuid() === 0;

/** PostgreSQL refuses to run as root; in containers we switch to the `postgres` system user. */
async function run(bin: string, args: string[]): Promise<string> {
  const [cmd, cmdArgs] = isRoot() ? ["runuser", ["-u", "postgres", "--", bin, ...args]] : [bin, args];
  const { stdout } = await execFile(cmd as string, cmdArgs as string[], { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

export interface LocalCluster {
  adminUrl: string;
  dataDir: string;
  /** Stops the cluster if this process started it. */
  stop(): Promise<void>;
}

/**
 * Starts (or reuses) a throwaway PostgreSQL cluster for local development and tests.
 * Trust authentication on 127.0.0.1 only; never use for real data.
 */
export async function startLocalCluster(options: { dataDir?: string; port?: number } = {}): Promise<LocalCluster> {
  const bin = await pgBinDir();
  const port = options.port ?? Number(process.env.HV_TEST_PG_PORT ?? 54329);
  const dataDir = options.dataDir ?? path.join(os.tmpdir(), `hv-pg-${port}`);
  const binary = (name: string) => path.join(bin, name);

  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    // Only the data directory itself is private; parents must stay traversable for `postgres`.
    await mkdir(path.dirname(dataDir), { recursive: true });
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    if (isRoot()) {
      const { stdout } = await execFile("id", ["-u", "postgres"]);
      const { stdout: gid } = await execFile("id", ["-g", "postgres"]);
      await chown(dataDir, Number(stdout.trim()), Number(gid.trim()));
    }
    await run(binary("initdb"), ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C.UTF-8"]);
  }

  let startedHere = false;
  const status = await run(binary("pg_ctl"), ["-D", dataDir, "status"]).catch(() => "");
  if (!status.includes("server is running")) {
    await run(binary("pg_ctl"), [
      "-D",
      dataDir,
      "-l",
      path.join(dataDir, "server.log"),
      "-w",
      "-o",
      `-p ${port} -k ${dataDir} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c max_connections=200 -c TimeZone=UTC`,
      "start",
    ]);
    startedHere = true;
  }

  return {
    adminUrl: `postgres://postgres@127.0.0.1:${port}/postgres`,
    dataDir,
    async stop() {
      if (startedHere) await run(binary("pg_ctl"), ["-D", dataDir, "-m", "fast", "-w", "stop"]);
    },
  };
}

export function withCredentials(baseUrl: string, user: string, password: string | null, database: string): string {
  const url = new URL(baseUrl);
  url.username = user;
  url.password = password ?? "";
  url.pathname = `/${database}`;
  return url.toString();
}
