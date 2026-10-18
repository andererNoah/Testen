import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { registerAuth, type AppDeps } from "./plugins/context";
import { registerErrorHandling } from "./plugins/errors";
import { auditRoutes } from "./routes/audit";
import { dashboardRoutes, deadlineRoutes } from "./routes/deadlines";
import { devRoutes } from "./routes/dev";
import { documentRoutes } from "./routes/documents";
import { importRoutes } from "./routes/imports";
import { personRoutes } from "./routes/persons";
import { propertyRoutes } from "./routes/properties";
import { ruleRoutes } from "./routes/rules";
import { settingsRoutes } from "./routes/settings";
import { systemRoutes } from "./routes/system";

export interface BuildAppOptions {
  deps: AppDeps;
  logger?: boolean | { level: string };
  /** Extra route plugins under /v1 (e.g. import, documents). */
  plugins?: Array<(app: FastifyInstance) => Promise<void>>;
}

export const API_VERSION = "0.1.0";

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    genReqId: (req) => (typeof req.headers["x-request-id"] === "string" && /^[\w-]{1,64}$/.test(req.headers["x-request-id"]) ? req.headers["x-request-id"] : randomUUID()),
    bodyLimit: 2 * 1024 * 1024,
  });
  app.decorate("deps", options.deps);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
  registerAuth(app);

  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 20 } });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "[PRODUKTNAME] API",
        description: "Versionierte REST-API (V27). Alle Oberflächen nutzen ausschließlich diese API.",
        version: API_VERSION,
      },
      components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
      security: [{ bearer: [] }],
    },
    transform: jsonSchemaTransform,
  });
  // Swagger UI routes are public; the hook must exist before the UI plugin adds them.
  app.addHook("onRoute", (route) => {
    if (route.url.startsWith("/v1/docs")) route.config = { ...(route.config ?? {}), public: true };
  });
  await app.register(swaggerUi, { routePrefix: "/v1/docs", uiConfig: { docExpansion: "list" } });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  await app.register(
    async (v1) => {
      v1.get("/openapi.json", { config: { public: true }, schema: { hide: true } }, async () => app.swagger());
      await v1.register(systemRoutes);
      await v1.register(devRoutes);
      await v1.register(propertyRoutes);
      await v1.register(personRoutes);
      await v1.register(settingsRoutes);
      await v1.register(ruleRoutes);
      await v1.register(deadlineRoutes);
      await v1.register(dashboardRoutes);
      await v1.register(auditRoutes);
      await v1.register(importRoutes);
      await v1.register(documentRoutes);
      for (const plugin of options.plugins ?? []) await v1.register(plugin);
    },
    { prefix: "/v1" },
  );

  return app;
}
