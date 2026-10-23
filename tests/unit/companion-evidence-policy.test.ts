import { describe, expect, it } from "vitest";
import { companionTraceMode } from "../visual/helpers/companion-evidence-policy";
// @ts-expect-error Offline Node QA tooling is not imported into the application.
import { scopedEvidenceEnvironment } from "../../scripts/site-daily/scoped-native.mjs";
import { childEnvironment } from "../../scripts/companion-qa/runner.mjs";

describe("explicit scoped companion evidence retention", () => {
  it("keeps manual and full-run traces by default", () => {
    expect(companionTraceMode({})).toBe("on");
    expect(companionTraceMode({ CI: "true", COMPANION_QA_OUTPUT: "daily" })).toBe("on");
  });

  it("uses failure retention only for the explicit scoped runner policy", () => {
    expect(companionTraceMode(scopedEvidenceEnvironment())).toBe("retain-on-failure");
  });

  it("does not silently reduce evidence for unknown, misspelled or empty policies", () => {
    for (const value of [undefined, "", "on", "retain-on-failure", "scoped", "scoped-retain-failures-v2"]) {
      expect(companionTraceMode({ VIC_QA_EVIDENCE_MODE: value })).toBe("on");
    }
  });

  it("does not leak a parent's scoped setting into the legacy full runner", () => {
    const parent = { PATH: "fixture-path", ...scopedEvidenceEnvironment() };
    expect(companionTraceMode(childEnvironment(parent))).toBe("on");
    expect(companionTraceMode(childEnvironment(parent, scopedEvidenceEnvironment()))).toBe("retain-on-failure");
  });
});
