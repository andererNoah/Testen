import { catalog } from "../catalog";
import { createRuleEngine } from "./engine";

export * from "./types";
export * from "./engine";
export { catalog } from "../catalog";
export type { Catalog, RuleKey } from "../catalog";

/** Default engine over the built-in catalog. */
export const rules = createRuleEngine(catalog);
