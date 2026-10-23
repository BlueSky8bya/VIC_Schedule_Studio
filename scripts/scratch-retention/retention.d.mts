export interface RetentionPolicy {
  activeHours: number; keepLatestPerFactory: number; successDays: number; failureDays: number; featureDays: number;
  leftoverDays: number; toolEnvDays: number; budgetBytes: number; minFreeBytes: number; startFloorBytes: number;
}
export interface RetentionUnit {
  dir: string; kind: 'factory' | 'feature' | 'leftover' | 'tool-env'; factory?: string; runId?: string; status?: string;
  bytes: number; newest: number; files: number; protected?: string; reason?: string;
}
export interface RetentionPlan {
  units: RetentionUnit[]; remove: RetentionUnit[]; slim: string[]; totalBefore: number; totalAfter: number; freeBefore: number; projectedFree: number;
}
export const DEFAULT_POLICY: Readonly<RetentionPolicy>;
export function walk(dir: string, visit: (file: string) => void): void;
export function measure(dir: string, seen?: Set<string>): { bytes: number; newest: number; files: number };
export function scratchRoots(repoRoot: string): { roots: string[]; worktrees: string[] };
export function units(root: string): RetentionUnit[];
export function toolEnvs(featureDir: string, depth?: number): string[];
export function referencedPaths(roots: string[], maxDepth?: number, seeds?: string[]): Set<string>;
export function plan(input: { roots: string[]; worktrees: string[]; now?: number; free?: number; policy?: RetentionPolicy; refs?: Set<string> }): RetentionPlan;
export function removeUnit(dir: string, scratchRoots: string[]): boolean;
export function slimRun(dir: string, options?: { compress?: boolean }): number;
export function dedupe(dirs: string[], minBytes?: number): { saved: number; linked: number };
export function freeBytes(dir: string): number;
export function enforce(input: { repoRoot: string; apply?: boolean; policy?: RetentionPolicy; now?: number; log?: (line: string) => void; dedupeFiles?: boolean }): RetentionPlan & { applied: boolean; deleted: { dir: string; bytes: number; reason: string; ok: boolean }[]; slimmedBytes: number; dedupe: { saved: number; linked: number }; freeAfter?: number };
export function guardBeforeRun(repoRoot: string, options?: { policy?: RetentionPolicy; log?: (line: string) => void }): number;
export function afterRun(runDir: string): number;
export function parseArgs(argv: string[]): { apply: boolean; repoRoot: string; policy: RetentionPolicy; json: boolean };
