export interface PgTestConfig {
  adminUrl: string;
  template: string;
  ownerPassword: string;
  appPassword: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    pg: PgTestConfig;
  }
}
