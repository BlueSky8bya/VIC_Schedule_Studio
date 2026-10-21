import { afterAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The implementation is standalone ESM consumed by the Node planner, without a
// third declaration file. A typed facade keeps this test inside the two-file scope.
const modulePath = "../../scripts/site-daily/evidence.mjs";
type DiagnosticResult = {
  diagnosticPassed: boolean; releaseEligible: false; full200NotExecuted: boolean;
  fullReleaseCertificationNotExecuted: true; originalReportStatus: string | null;
  selected: { count: number; passed: number; failed: number; skipped: number; retried: number; expectedFailure: number; duplicateTitles: string[] };
  failures: { title: string; errors: unknown[] }[]; originalGlobalErrors: unknown[];
  guardIssues: string[];
  evidenceScope: { sourceVerification: string; sourcePaths: string[]; fullSourceVerified: false; rawMediaVerified: false; releaseCertificationVerified: false };
};
const { evaluateCompanionDiagnostic, inspectCompanionDiagnostic } = await import(modulePath) as {
  evaluateCompanionDiagnostic: (input?: unknown) => DiagnosticResult;
  inspectCompanionDiagnostic: (input?: unknown) => DiagnosticResult;
};
const {bindDiagnosticPlan}=await import(modulePath) as {bindDiagnosticPlan:(plan:unknown,diagnostic:unknown,grep:string)=>{planSatisfied:boolean;releaseEligible:false;issues:string[]}};
const sha = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const harnessPaths = ["scripts/companion-qa/runner.mjs", "scripts/companion-qa/catalog.mjs", "scripts/companion-qa/network-guard.mjs"];
const specPath = "tests/visual/companion-synthetic.spec.ts";
const productPath = "lib/ui/viewer-companion/synthetic.ts";
const bodies = new Map([...harnessPaths, specPath, productPath].map(file => [file, `synthetic source for ${file}\n`]));

function inputFixture(count = 1) {
  const sourceFiles = [...bodies].map(([file, body]) => ({ path: file, sha256: sha(body) }));
  const source = { contentDigest: sha(JSON.stringify(sourceFiles)), sourceFiles, privateSourceArtCopied: false, sourceIllustrationsCopied: 0, sourceContractsCopied: 0 };
  const required = ["isolated-snapshot", "pure-models", "pure-count-proof", "metadata", "build", "typecheck", "lint", "owned-process-cleanup", "original-tree-preserved"];
  const report = {
    schemaVersion: 1, runId: "synthetic-retained-run", status: "failed", sourceDigest: source.contentDigest, buildId: "synthetic-build-165", automaticCodeEdits: 0, automaticAssetEdits: 0,
    diagnosticScope: { nativeGrep: "165 selected", eligibleForRelease: false, fullRunStillRequired: true },
    stages: [
      ...required.map(name => ({ name, status: "passed", exitCode: 0, detail: name === "original-tree-preserved" ? "0 original file hashes changed; git-state changed:false. No automatic restore/reset is performed" : "Synthetic clean guard" })),
      { name: "native-production-fixture", status: "failed", exitCode: 0, detail: "Exactly200 unique native cases including all27 entries must actually pass once" },
      { name: "native-personality-entry-proof", status: "not-run", exitCode: 0, detail: "Selected diagnostic has no full coverage" },
    ],
    nativeEntries: { plannedSelectedCases: 200, selectedCaseCount: count, selectedPassedCases: count, selectedUniqueTitles: count },
  };
  const reporter = {
    config: { projects: [{ retries: 0, repeatEach: 1 }] },
    suites: [{ title: "synthetic", specs: Array.from({ length: count }, (_, i) => ({
      title: `165 selected actual case ${i}`, file: "companion-synthetic.spec.ts", ok: true,
      tests: [{ expectedStatus: "passed", status: "expected", annotations: [] as { type: string }[], results: [{ status: "passed", duration: 17, retry: 0, errors: [] as unknown[], annotations: [] as { type: string }[] }] }],
    })) }], errors: [] as unknown[], stats: { duration: count * 17, expected: count, skipped: 0, unexpected: 0, flaky: 0 },
  };
  const evidenceVerification = {
    issues: [] as string[], runId: report.runId, sourceDigest: report.sourceDigest, buildId: report.buildId,
    metadataFiles: ["report.json", "source-freeze.json", "attempt-01/playwright.json"].map(file => ({ path: file, expectedSha256: sha(file), actualSha256: sha(file) })),
    sourceFiles: sourceFiles.map(file => ({ path: file.path, expectedSha256: file.sha256, workspaceSha256: file.sha256, rootSha256: file.sha256 })),
  };
  return { report, source, reporter, evidenceVerification };
}
type Input = ReturnType<typeof inputFixture>;
function spec(input: Input) { return input.reporter.suites[0].specs[0]; }
function result(input: Input) { return spec(input).tests[0].results[0]; }

describe('daily plan must match actual diagnostic selection',()=>{
  it('rejects a recorded grep that did not select the actual titles',()=>{const x=inputFixture();x.report.diagnosticScope.nativeGrep='^ABSENT$';expect(evaluateCompanionDiagnostic(x).diagnosticPassed).toBe(false);});
  it('rejects a missing planned case even when the generic selected subset passed',()=>{const x=inputFixture(),diagnostic=evaluateCompanionDiagnostic(x);expect(diagnostic.diagnosticPassed).toBe(true);const plan={kind:'site-daily-triage-plan',companion:{mode:'diagnostic-only',fullRequired:false,nativePattern:'165 selected',expectedSelectedCases:2,requiredTitlePatterns:['^165 selected actual case 0$','^165 selected actual case 1$']}};expect(bindDiagnosticPlan(plan,diagnostic,'165 selected').planSatisfied).toBe(false);plan.companion.expectedSelectedCases=1;plan.companion.requiredTitlePatterns.pop();expect(bindDiagnosticPlan(plan,diagnostic,'165 selected')).toMatchObject({planSatisfied:true,releaseEligible:false});expect(bindDiagnosticPlan(plan,diagnostic,'different').planSatisfied).toBe(false);});
});

const temporaryRoots: string[] = [];
afterAll(() => {
  for (const root of temporaryRoots) {
    // Only this test's exact mkdtemp child may be removed, never a computed repo path.
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("vic-site-daily-evidence-165-")) throw Error("Unsafe synthetic fixture cleanup target");
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function diskFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vic-site-daily-evidence-165-"));
  temporaryRoots.push(root);
  const run = path.join(root, ".scratch-pw", "synthetic-retained-run");
  const input = inputFixture();
  const write = (relative: string, bytes: string) => {
    const file = path.join(run, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); return file;
  };
  for (const [file, body] of bodies) {
    const current = path.join(root, file); fs.mkdirSync(path.dirname(current), { recursive: true }); fs.writeFileSync(current, body);
    write(`workspace/${file}`, body);
  }
  write("workspace/.next/BUILD_ID", `${input.report.buildId}\n`);
  write("report.json", JSON.stringify(input.report));
  write("source-freeze.json", JSON.stringify(input.source));
  write("attempt-01/playwright.json", JSON.stringify(input.reporter));
  write("attempt-01/preserved-video.webm", "synthetic opaque raw evidence");
  const manifest = {
    report: ["report.json", "source-freeze.json"].map(file => ({ path: file, sha256: sha(fs.readFileSync(path.join(run, file))) })),
    files: ["playwright.json", "preserved-video.webm"].map(file => { const bytes = fs.readFileSync(path.join(run, "attempt-01", file)); return { path: file, bytes: bytes.length, sha256: sha(bytes) }; }),
  };
  write("evidence-manifest.json", JSON.stringify(manifest));
  return { root, run, input, manifest, write, inspect: () => inspectCompanionDiagnostic({ root, run, sourcePaths: [productPath] }) };
}

describe("165 fail-closed companion diagnostic interpretation", () => {
  it("accepts a once-passed diagnostic despite intentionally unselected full200/nine gates, preserving original failure", () => {
    const output = evaluateCompanionDiagnostic(inputFixture());
    expect(output.diagnosticPassed, output.guardIssues.join("\n")).toBe(true);
    expect(output).toMatchObject({ classification: "diagnostic-only", releaseEligible: false, originalReportStatus: "failed", full200NotExecuted: true, fullReleaseCertificationNotExecuted: true, selected: { count: 1, passed: 1 } });
    const nine = inputFixture(); nine.report.stages.find(stage => stage.name === "native-production-fixture")!.detail = "All nine exact personality trace IDs must independently pass with sufficient actual ninety-second observations";
    expect(evaluateCompanionDiagnostic(nine).diagnosticPassed).toBe(true);
  });
  it("never grants release eligibility even if a diagnostic happens to select all200", () => {
    const output = evaluateCompanionDiagnostic(inputFixture(200));
    expect(output.diagnosticPassed, output.guardIssues.join("\n")).toBe(true);
    expect(output).toMatchObject({ releaseEligible: false, full200NotExecuted: false, fullReleaseCertificationNotExecuted: true });
  });
  it.each<[string, (input: Input) => void]>([
    ["zero cases", input => { input.reporter.suites = []; input.reporter.stats.expected = 0; input.report.nativeEntries.selectedCaseCount = 0; }],
    ["skipped result", input => { result(input).status = "skipped"; }],
    ["flaky retry that eventually passes", input => { spec(input).tests[0].results.unshift({ ...result(input), status: "failed" }); result(input).retry = 1; }],
    ["nonzero retry without earlier attempt", input => { result(input).retry = 1; }],
    ["expected failure", input => { spec(input).tests[0].expectedStatus = "failed"; result(input).status = "failed"; }],
    ["expected-failure annotation despite passed status", input => { spec(input).tests[0].annotations.push({ type: "fail" }); }],
    ["missing duration", input => { result(input).duration = 0; }],
    ["duplicate titles", input => { input.reporter.suites[0].specs.push(structuredClone(spec(input))); }],
    ["second project under the same spec", input => { spec(input).tests.push(structuredClone(spec(input).tests[0])); }],
    ["configured retries", input => { input.reporter.config.projects[0].retries = 1; }],
    ["hidden skipped statistics", input => { input.reporter.stats.skipped = 1; }],
    ["missing cleanup guard", input => { input.report.stages = input.report.stages.filter(stage => stage.name !== "owned-process-cleanup"); }],
    ["duplicate guard stage", input => { input.report.stages.push(structuredClone(input.report.stages[0])); }],
    ["nonzero typecheck exit despite passed label", input => { input.report.stages.find(stage => stage.name === "typecheck")!.exitCode = 1; }],
    ["changed original source", input => { input.report.stages.find(stage => stage.name === "original-tree-preserved")!.detail = "1 original file hashes changed; git-state changed:false."; }],
    ["changed Git state", input => { input.report.stages.find(stage => stage.name === "original-tree-preserved")!.detail = "0 original file hashes changed; git-state changed:true."; }],
    ["native command failure", input => { input.report.stages.find(stage => stage.name === "native-production-fixture")!.exitCode = 1; }],
    ["unrelated native failure", input => { input.report.stages.find(stage => stage.name === "native-production-fixture")!.detail = "Actual browser crashed"; }],
    ["stopped after network denial", input => { input.report.stages.push({ name: "stopped", status: "failed", exitCode: 1, detail: "Network guard blocked request" }); }],
    ["missing diagnostic guard", input => { input.report.diagnosticScope.fullRunStillRequired = false; }],
    ["attempt to claim release", input => { input.report.diagnosticScope.eligibleForRelease = true; }],
    ["unexpected source edit", input => { input.report.automaticCodeEdits = 1; }],
    ["selected count mismatch", input => { input.report.nativeEntries.selectedCaseCount = 200; }],
    ["source digest mismatch", input => { input.source.sourceFiles[0].sha256 = "0".repeat(64); }],
    ["build identity mismatch", input => { input.evidenceVerification.buildId = "changed-build"; }],
    ["missing source guard hash", input => { input.evidenceVerification.sourceFiles.shift(); }],
    ["changed source subset", input => { input.evidenceVerification.sourceFiles[0].rootSha256 = "0".repeat(64); }],
    ["changed frozen workspace subset", input => { input.evidenceVerification.sourceFiles[0].workspaceSha256 = "0".repeat(64); }],
    ["missing report evidence", input => { input.evidenceVerification.metadataFiles.shift(); }],
    ["changed reporter evidence", input => { input.evidenceVerification.metadataFiles[2].actualSha256 = "0".repeat(64); }],
  ])("rejects %s", (_label, mutate) => {
    const input = inputFixture(); mutate(input); const output = evaluateCompanionDiagnostic(input);
    expect(output.diagnosticPassed).toBe(false); expect(output.releaseEligible).toBe(false); expect(output.guardIssues.length).toBeGreaterThan(0);
  });
  it("retains the actual case/global errors and never rewrites the original failed evidence", () => {
    const input = inputFixture(); const original = { message: "Original food target ping-pong", stack: "preserved synthetic stack" };
    result(input).errors.push(original); result(input).status = "failed"; spec(input).ok = false;
    input.reporter.errors.push({ message: "Original worker timeout" });
    const before = JSON.stringify(input); const output = evaluateCompanionDiagnostic(input);
    expect(output.diagnosticPassed).toBe(false); expect(output.failures[0].errors).toContainEqual(original);
    expect(output.originalGlobalErrors).toEqual(input.reporter.errors); expect(JSON.stringify(input)).toBe(before);
  });
  it("fails closed on wholly absent evidence without throwing", () => {
    const output = evaluateCompanionDiagnostic(); expect(output.diagnosticPassed).toBe(false); expect(output.releaseEligible).toBe(false);
  });
});

describe("165 retained evidence read-only filesystem binding", () => {
  it("hashes exactly the declared metadata/source subset in both trees and leaves retained bytes untouched", () => {
    const fixture = diskFixture(); const files = ["report.json", "source-freeze.json", "evidence-manifest.json", "attempt-01/playwright.json", "attempt-01/preserved-video.webm"];
    const before = files.map(file => sha(fs.readFileSync(path.join(fixture.run, file)))); const output = fixture.inspect();
    expect(output.diagnosticPassed, output.guardIssues.join("\n")).toBe(true);
    expect(output.evidenceScope).toMatchObject({ sourceVerification: "explicit-subset", fullSourceVerified: false, rawMediaVerified: false, releaseCertificationVerified: false });
    expect(output.evidenceScope.sourcePaths.sort()).toEqual([...bodies.keys()].sort());
    expect(files.map(file => sha(fs.readFileSync(path.join(fixture.run, file))))).toEqual(before);
  });
  it.each(["report.json", "source-freeze.json", "attempt-01/playwright.json"])("rejects changed original %s while preserving it", relative => {
    const fixture = diskFixture(); const file = path.join(fixture.run, relative); const changed = `${fs.readFileSync(file, "utf8")} `; fs.writeFileSync(file, changed);
    const output = fixture.inspect(); expect(output.diagnosticPassed).toBe(false); expect(fs.readFileSync(file, "utf8")).toBe(changed);
  });
  it.each(["root", "workspace"])("rejects source drift in %s", target => {
    const fixture = diskFixture(); const file = target === "root" ? path.join(fixture.root, productPath) : path.join(fixture.run, "workspace", productPath);
    fs.writeFileSync(file, "changed synthetic product source");
    expect(fixture.inspect().diagnosticPassed).toBe(false);
  });
  it("rejects BUILD_ID changes", () => {
    const fixture = diskFixture(); fixture.write("workspace/.next/BUILD_ID", "changed-build\n"); expect(fixture.inspect().diagnosticPassed).toBe(false);
  });
  it("rejects missing manifest rows, duplicate rows, unsafe source paths and run escape", () => {
    const fixture = diskFixture(); fixture.manifest.report.pop(); fixture.write("evidence-manifest.json", JSON.stringify(fixture.manifest));
    expect(fixture.inspect().diagnosticPassed).toBe(false);
    const duplicate = diskFixture(); duplicate.manifest.files.push(duplicate.manifest.files[0]); duplicate.write("evidence-manifest.json", JSON.stringify(duplicate.manifest));
    expect(duplicate.inspect().diagnosticPassed).toBe(false);
    const clean = diskFixture();
    for (const unsafe of ["../private", ".env.local", "node_modules/private.ts", "docs/private.ts", "art-src/private.json", "C:/private.ts"]) {
      expect(inspectCompanionDiagnostic({ root: clean.root, run: clean.run, sourcePaths: [unsafe] }).diagnosticPassed).toBe(false);
    }
    expect(inspectCompanionDiagnostic({ root: clean.root, run: os.tmpdir() }).diagnosticPassed).toBe(false);
  });
  it("does not pretend unselected source or raw media has been verified", () => {
    const fixture = diskFixture(); fixture.write("attempt-01/preserved-video.webm", "changed raw media intentionally not in metadata verification subset");
    fs.writeFileSync(path.join(fixture.root, productPath), "unselected product changed");
    const output = inspectCompanionDiagnostic({ root: fixture.root, run: fixture.run });
    expect(output.diagnosticPassed, output.guardIssues.join("\n")).toBe(true);
    expect(output.evidenceScope.sourcePaths).not.toContain(productPath); expect(output.evidenceScope.rawMediaVerified).toBe(false); expect(output.releaseEligible).toBe(false);
  });
});
