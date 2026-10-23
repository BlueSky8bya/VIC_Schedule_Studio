/** Daily scoped QA keeps failure traces and every video; manual/full QA keeps its traces. */
export function companionTraceMode(environment: Readonly<Record<string, string | undefined>> = process.env): "on" | "retain-on-failure" {
  return environment.VIC_QA_EVIDENCE_MODE === "scoped-retain-failures-v1" ? "retain-on-failure" : "on";
}
