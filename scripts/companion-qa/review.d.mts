export type ReviewEvaluation = { passed: boolean; issues: string[] };
export type Finalization = { schemaVersion: number; kind: string; eligibleForAuthorizedRelease: boolean; decision: string; issues: string[]; limitations: readonly string[]; [key: string]: unknown };
export const REVIEW_PERSPECTIVES: readonly string[];
export function registeredRecipes(source: string): { id: string; personality: string }[];
export function evaluateReviewContracts(input: unknown): ReviewEvaluation;
export function finalizeDailyReview(options: { run: string; reviews: string; ideas: string; output?: string }): Finalization;
export function parseReviewOptions(argv: string[]): { run: string; reviews: string; ideas: string; output?: string };
