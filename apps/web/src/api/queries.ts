import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client";
import type { components, paths } from "./schema";

type Json<P extends keyof paths, M extends "get" | "post" | "patch" | "put" | "delete", S extends number = 200> = paths[P][M] extends {
  responses: { [K in S]: { content: { "application/json": infer T } } };
}
  ? T
  : never;

export type Me = Json<"/v1/me", "get">;
export type Property = Json<"/v1/properties/{id}", "get">;
export type PropertyOverview = Json<"/v1/properties/{id}/overview", "get">;
export type Unit = Json<"/v1/units/{id}", "get">;
export type Person = Json<"/v1/persons/{id}", "get">;
export type Deadline = Json<"/v1/deadlines", "get">["items"][number];
export type Dashboard = Json<"/v1/dashboard", "get">;
export type Rule = Json<"/v1/rules", "get">["items"][number];
export type AuditEntry = Json<"/v1/audit", "get">["items"][number];
export type ImportJob = Json<"/v1/imports/{id}", "get">;
export type ImportEntity = Json<"/v1/imports/fields", "get">["items"][number];
export type DocumentItem = Json<"/v1/documents/{id}", "get">;
export type CustomField = Json<"/v1/custom-fields", "get">["items"][number];
export type MeasureHistory = Json<"/v1/units/{id}/measures", "get">["items"][number];
export type _Components = components;

export const keys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  properties: (q?: object) => ["properties", q ?? {}] as const,
  property: (id: string) => ["property", id] as const,
  overview: (id: string) => ["overview", id] as const,
  unit: (id: string, asOf?: string) => ["unit", id, asOf ?? null] as const,
  measures: (id: string) => ["measures", id] as const,
  persons: (q?: object) => ["persons", q ?? {}] as const,
  person: (id: string) => ["person", id] as const,
  deadlines: (q?: object) => ["deadlines", q ?? {}] as const,
  rules: (asOf?: string) => ["rules", asOf ?? null] as const,
  changelog: ["changelog"] as const,
  audit: (q?: object) => ["audit", q ?? {}] as const,
  imports: ["imports"] as const,
  importJob: (id: string) => ["import", id] as const,
  importFields: ["importFields"] as const,
  documents: (q?: object) => ["documents", q ?? {}] as const,
  customFields: ["customFields"] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => unwrap(api.GET("/v1/me")), staleTime: 60_000 });

export function useCan() {
  const me = useMe().data;
  return (permission: string) => !!me?.permissions.includes(permission);
}

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => unwrap(api.GET("/v1/dashboard")) });

export const useProperties = (query: { q?: string; kind?: "weg" | "rental" | "sev" } = {}) =>
  useQuery({ queryKey: keys.properties(query), queryFn: () => unwrap(api.GET("/v1/properties", { params: { query } })) });

export const useOverview = (id: string) =>
  useQuery({ queryKey: keys.overview(id), queryFn: () => unwrap(api.GET("/v1/properties/{id}/overview", { params: { path: { id } } })) });

export const useUnit = (id: string, asOf?: string) =>
  useQuery({ queryKey: keys.unit(id, asOf), queryFn: () => unwrap(api.GET("/v1/units/{id}", { params: { path: { id }, query: asOf ? { asOf } : {} } })) });

export const useMeasureHistory = (id: string) =>
  useQuery({ queryKey: keys.measures(id), queryFn: () => unwrap(api.GET("/v1/units/{id}/measures", { params: { path: { id }, query: {} } })) });

export const usePersons = (query: { q?: string; propertyId?: string } = {}) =>
  useQuery({ queryKey: keys.persons(query), queryFn: () => unwrap(api.GET("/v1/persons", { params: { query } })) });

export const usePerson = (id: string) => useQuery({ queryKey: keys.person(id), queryFn: () => unwrap(api.GET("/v1/persons/{id}", { params: { path: { id } } })) });

export const useDeadlines = (query: { propertyId?: string } = {}) =>
  useQuery({ queryKey: keys.deadlines(query), queryFn: () => unwrap(api.GET("/v1/deadlines", { params: { query } })) });

export const useRules = (asOf?: string) => useQuery({ queryKey: keys.rules(asOf), queryFn: () => unwrap(api.GET("/v1/rules", { params: { query: asOf ? { asOf } : {} } })) });

export const useChangelog = () => useQuery({ queryKey: keys.changelog, queryFn: () => unwrap(api.GET("/v1/rules/changelog")) });

export const useAudit = (query: { beforeId?: number; table?: string; limit?: number }) =>
  useQuery({ queryKey: keys.audit(query), queryFn: () => unwrap(api.GET("/v1/audit", { params: { query: { limit: 50, ...query } } })) });

export const useImportFields = () => useQuery({ queryKey: keys.importFields, queryFn: () => unwrap(api.GET("/v1/imports/fields")), staleTime: Infinity });

export const useImports = () => useQuery({ queryKey: keys.imports, queryFn: () => unwrap(api.GET("/v1/imports")) });

export const useDocuments = (query: { entityType?: "property" | "building" | "unit" | "person" | "technical_asset" | "meter"; entityId?: string; propertyId?: string }) =>
  useQuery({ queryKey: keys.documents(query), queryFn: () => unwrap(api.GET("/v1/documents", { params: { query } })) });

export const useCustomFields = () => useQuery({ queryKey: keys.customFields, queryFn: () => unwrap(api.GET("/v1/custom-fields", { params: { query: {} } })) });

/** Invalidates everything after a write; data sets are small in Phase 0. */
export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useApiMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate() });
}
