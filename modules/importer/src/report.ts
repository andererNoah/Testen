import type { EntityKey } from "./fields";

export interface ImportIssue {
  severity: "error" | "warning";
  sheet?: string;
  /** Row number as shown in the spreadsheet program. */
  row?: number;
  column?: string;
  field?: string;
  message: string;
}

export interface EntityCounts {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export interface ImportReport {
  ok: boolean;
  dryRun: boolean;
  counts: Record<EntityKey, EntityCounts>;
  errors: number;
  warnings: number;
  /** First 500 issues; the totals above are complete. */
  issues: ImportIssue[];
  durationMs: number;
}

export const MAX_REPORTED_ISSUES = 500;

export function emptyCounts(): Record<EntityKey, EntityCounts> {
  const zero = (): EntityCounts => ({ created: 0, updated: 0, unchanged: 0, failed: 0 });
  return { properties: zero(), buildings: zero(), units: zero(), persons: zero(), roles: zero(), assets: zero(), meters: zero() };
}

export class IssueCollector {
  readonly issues: ImportIssue[] = [];
  errors = 0;
  warnings = 0;
  add(issue: ImportIssue) {
    if (issue.severity === "error") this.errors++;
    else this.warnings++;
    if (this.issues.length < MAX_REPORTED_ISSUES) this.issues.push(issue);
  }
  error(issue: Omit<ImportIssue, "severity">) {
    this.add({ ...issue, severity: "error" });
  }
  warning(issue: Omit<ImportIssue, "severity">) {
    this.add({ ...issue, severity: "warning" });
  }
}
