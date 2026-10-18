import { z } from "zod";
import { isoDate } from "@hv/masterdata";

export const documentCategory = z.enum(["contract", "protocol", "invoice", "statement", "correspondence", "technical", "plan", "certificate", "photo", "other"]);
export const documentEntity = z.enum(["property", "building", "unit", "person", "technical_asset", "meter"]);

export const documentLinkInput = z.object({ entityType: documentEntity, entityId: z.string().uuid() });
export type DocumentLinkInput = z.infer<typeof documentLinkInput>;

export const documentMeta = z.object({
  title: z.string().trim().min(1).max(200),
  category: documentCategory,
  documentDate: isoDate.nullable().optional(),
  links: z.array(documentLinkInput).min(1, "Mindestens eine Akte angeben"),
});
export type DocumentMeta = z.infer<typeof documentMeta>;

export const documentVersion = z.object({
  version: z.number(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  sha256: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
});

export const documentLink = z.object({ id: z.string(), entityType: documentEntity, entityId: z.string(), propertyId: z.string().nullable() });

export const document = z.object({
  id: z.string(),
  title: z.string(),
  category: documentCategory,
  documentDate: z.string().nullable(),
  currentVersion: z.number(),
  retentionUntil: z.string().nullable(),
  retentionRule: z.string().nullable(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
  links: z.array(documentLink),
  versions: z.array(documentVersion),
});
export type DocumentView = z.infer<typeof document>;
