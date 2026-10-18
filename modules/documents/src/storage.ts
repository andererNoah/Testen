import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

/**
 * Content storage (ADR: S3-compatible object storage in Germany once hosted).
 * Keys are generated from ids only, never from user-supplied file names.
 */
export interface DocumentStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}

const KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/v\d+-[0-9a-f]{64}$/;

export class FileSystemStorage implements DocumentStorage {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    if (!KEY.test(key)) throw new Error(`Ungültiger Speicherschlüssel: ${key}`);
    return path.join(this.baseDir, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Write-then-rename: readers never see half-written files.
    const tmp = `${target}.tmp-${process.pid}`;
    await writeFile(tmp, data, { flag: "wx" });
    await rename(tmp, target);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }
}

export class MemoryStorage implements DocumentStorage {
  readonly files = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    this.files.set(key, Buffer.from(data));
  }
  async get(key: string) {
    const data = this.files.get(key);
    if (!data) throw new Error(`Nicht gefunden: ${key}`);
    return data;
  }
}

export function storageKey(tenantId: string, documentId: string, version: number, sha256: string): string {
  return `${tenantId}/${documentId}/v${version}-${sha256}`;
}
