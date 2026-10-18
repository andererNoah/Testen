import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    /** Connection as hv_app (subject to RLS). */
    DATABASE_URL: z.string().min(1),
    /** Connection as hv_owner: platform tasks only (rule sync, login lookup). */
    DATABASE_OWNER_URL: z.string().min(1),
    AUTH_DEV_SECRET: z.string().min(32).optional(),
    AUTH_JWKS_URL: z.string().url().optional(),
    AUTH_ISSUER: z.string().default("hv-dev"),
    AUTH_AUDIENCE: z.string().default("hv-api"),
    STORAGE_DIR: z.string().default(".data/storage"),
    TIME_ZONE: z.string().default("Europe/Berlin"),
  })
  .refine((c) => c.AUTH_DEV_SECRET || c.AUTH_JWKS_URL, { message: "AUTH_DEV_SECRET oder AUTH_JWKS_URL muss gesetzt sein" })
  .refine((c) => !(c.NODE_ENV === "production" && c.AUTH_DEV_SECRET), { message: "AUTH_DEV_SECRET ist im Produktivbetrieb verboten" });

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Ungültige Konfiguration:\n${parsed.error.issues.map((i) => `- ${i.path.join(".") || "(gesamt)"}: ${i.message}`).join("\n")}`);
  }
  return parsed.data;
}
