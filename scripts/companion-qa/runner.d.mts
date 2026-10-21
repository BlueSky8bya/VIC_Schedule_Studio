export function loopbackOrigin(value: string): string;
export function safeRelative(value: string): boolean;
export function snapshotEligible(relative: string): boolean;
export function childEnvironment(source: Record<string, string | undefined>, extra?: Record<string, string>): Record<string, string>;
export function parseOptions(argv: string[]): { budgetMinutes: number; workers: number; plan: boolean; root: string; sourceManifest?: string; nativeGrep?: string };
export function ownedTerminationCommand(pid: number, platform?: string, systemRoot?: string): { file: string; args: string[] } | { signal: string; group: number };
export function dailyEvidenceGate(cases: { id: string; personality?: string | number }[], observed: { scenario?: { id: string; personality?: string | number; seconds?: number }; status: string; sufficiency?: { passed: boolean } }[]): boolean;
export const REQUIRED_AGENT_REGRESSIONS: readonly string[];
export function registeredAgentRegressions(available: readonly string[], learnerExists: boolean): string[];

export function nativeEntryEvidence(report: unknown): { status: string; gatePassed: boolean; requiredEntries: number; registeredEntries: number; passedEntries: number; failedEntries: number; skippedEntries: number; notRunEntries: number; plannedSelectedCases: number; selectedCaseCount: number; selectedPassedCases: number; selectedUniqueTitles: number; cases: { title: string; status: string }[]; floatingTidy: { required: number; registered: number; passed: number; failed: number; skipped: number; notRun: number; cases: { title: string; status: string }[] } };
