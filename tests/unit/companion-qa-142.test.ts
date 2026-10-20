import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BOOLEAN_KEYS, PERSONALITIES, ROUTINES, NATIVE_ENTRY_GREP, NATIVE_ENTRY_TITLES, NATIVE_FLOATING_TIDY_TITLES, PLANNED_NATIVE_CASE_COUNT, NATIVE_GREP, NATIVE_SUITES, coverageFor, dailyCases, pairwiseRows, universe } from "../../scripts/companion-qa/catalog.mjs";
import { childEnvironment, dailyEvidenceGate, nativeEntryEvidence, loopbackOrigin, ownedTerminationCommand, parseOptions, REQUIRED_AGENT_REGRESSIONS, registeredAgentRegressions, safeRelative, snapshotEligible } from "../../scripts/companion-qa/runner.mjs";
import { inspectTrace, traceSufficiency, ordinaryRouteOscillations, ordinaryWalkPacing, traceContextComplete, type QaFrame } from "../../scripts/companion-qa/trace-checks.mjs";
import { admitNodeRequest } from "../../scripts/companion-qa/network-guard.mjs";
import { AUDITED_MACHINE_METADATA, AUDITED_MACHINE_METADATA_BYTES, validateAuditedMachineMetadata } from "../../scripts/companion-qa/machine-metadata.mjs";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, normalizeCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { createCompanionPersonalityDirector } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionRoutineArbiter, type CompanionRoutineInput } from "@/lib/ui/viewer-companion/routine-arbiter";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

const measured = { booleanPatterns: 0, routineTemplates: 0, entries: 0, recipeCount: COMPANION_PERSONALITY_SCENES.length };
afterAll(() => {
  const output = process.env.COMPANION_QA_PURE_OUTPUT;
  if (output) { mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, "model-coverage.json"), JSON.stringify({ ...measured, scope: "Pure finite model only; rendered effects and Cartesian settings are not proved", frameCount: companionSpriteMetadata.frames.length, rowCount: companionSpriteMetadata.rows.length }), { flag: "wx" }); }
});
const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 650, kind: "floor", manualOnly: true };
const pad: Platform = { id: "companion-home-floor-400", x: 450, y: 600, width: 60, kind: "floor", manualOnly: true, bodyOnly: true };
const sofa: Platform = { id: "companion-home", x: 0, y: 570, width: 150, kind: "floor" };
const outside: Platform = { id: "actual-date", x: 700, y: 600, width: 300, kind: "date" };
function scene(personality: typeof COMPANION_PERSONALITIES[number]): CompanionRoutineInput {
  return { world: { x: 200, y: 600, platformId: floor.id, platforms: [floor, pad, sofa, outside], width: 1100, height: 720, animated: true, foods: [{ id: "synthetic-carrot", kind: "carrot", x: 260, y: 600, platformId: floor.id }] },
    brain: { ...createBrain(0, () => .5), hunger: .05, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, now: 0,
    active: true, entryReady: true, toys: [], tv: "off", lightLit: true, canTv: true, canCurtain: true, curtainPhase: "open", radioAllowed: true, radioPlaying: false,
    home: { floor: { x: 320, y: 600, platformId: floor.id }, pad: { x: 480, y: 600, platformId: pad.id }, sofa: { x: 80, y: 570, platformId: sofa.id }, dispenser: { x: 380, y: 600, platformId: floor.id }, radio: { x: 240, y: 600, platformId: floor.id }, light: { x: 240, y: 600, platformId: floor.id }, curtain: { x: 240, y: 600, platformId: floor.id }, contacts: { radio: { x: 240, y: 550 }, light: { x: 240, y: 520 }, curtain: { x: 240, y: 540 } } },
    environment: { date: { y: 2026, m: 10, d: 20 }, season: "autumn", band: "noon", night: false, hour: 12, weather: "clear" } };
}
describe("142 declared QA model and safety gates", () => {
  it("exhausts the eighteen independent boolean normalizer patterns without claiming their full enum cross-product", () => {
    expect(Object.entries(DEFAULT_COMPANION_PREFERENCES).filter(([, value]) => typeof value === "boolean").map(([key]) => key).sort()).toEqual([...BOOLEAN_KEYS].sort());
    expect(PERSONALITIES).toEqual(COMPANION_PERSONALITIES);
    for (let mask = 0; mask < 2 ** BOOLEAN_KEYS.length; mask++) {
      const patch = Object.fromEntries(BOOLEAN_KEYS.map((key, bit) => [key, Boolean(mask & 2 ** bit)]));
      const normalized = normalizeCompanionPreferences({ ...patch, size: "small" });
      for (const key of BOOLEAN_KEYS) if (normalized[key as keyof typeof normalized] !== patch[key]) throw Error(`Boolean normalization changed mask ${mask}, key ${key}`);
      if (normalized.size !== "large") throw Error(`Legacy size escaped normalization at ${mask}`);
      measured.booleanPatterns++;
    }
    expect(measured.booleanPatterns).toBe(262144); expect(universe().normalizedPreferenceCrossProduct).toBe(2144600064);
    expect(universe().fixedNormalizedSize).toBe("large"); expect(universe().preferenceEnums).toEqual({ personality: 9, animalMode: 3, speed: 3, soundVolume: 101 });
    expect(universe().claims.nativeExhaustive).toBe(false);
  }, 15000);
  it("proves every generated pair while keeping nine daily observed cases explicitly partial", () => {
    const rows = pairwiseRows(), coverage = coverageFor(rows);
    expect(coverage.complete).toBe(true); expect(coverage.missingPairs).toEqual([]);
    const cases = dailyCases(20261020); expect(cases.map(row => row.personality)).toEqual(PERSONALITIES);
    expect(cases.every(row => row.motion === "full" && ["full", "soft", "off", "reduced"].includes(String(row.plannedMotion)))).toBe(true);
    expect(coverageFor(cases).complete).toBe(false); expect(coverageFor([]).coveredPairs).toBe(0);
  });
  it("registers all27 native personality selection titles separately from the nine pure entry ACKs", () => {
    const entry = new RegExp(NATIVE_ENTRY_GREP), selected = new RegExp(NATIVE_GREP);
    const titles = ["viewer", "studio", "preview"].flatMap(surface => PERSONALITIES.map(personality => `137 ${surface} native ${personality} selection expresses immediately and remains purposeful`));
    expect(NATIVE_SUITES).toContain("companion-personality-scenes-137.spec.ts");
    expect(titles).toHaveLength(27); expect(universe().plannedNativeEntryCases).toBe(27); expect(universe().modeledEntries).toBe(9);
    for (const title of titles) for (const prefix of ["", "chromium companion-personality-scenes-137.spec.ts "]) {
      expect(entry.test(prefix + title)).toBe(true); expect(selected.test(prefix + title)).toBe(true);
    }
    for (const title of [
      "137 viewer native unknown selection expresses immediately and remains purposeful",
      "137 mobile native performer selection expresses immediately and remains purposeful",
      "2137 viewer native performer selection expresses immediately and remains purposeful",
      "137 viewer native performer selection expresses immediately and remains purposeful sibling",
      "137 viewer tidy carries all four native toys to the actual box before removing their IDs",
    ]) expect(entry.test(title)).toBe(false);
    for (const title of ["143 actual controls", "142 performer actual daily life", "141 common everyday life", "140 viewer primary and secondary"]) expect(selected.test(title)).toBe(true);
  });
  it("excludes credentials/private source art and preserves a fail-closed loopback and worker budget", () => {
    for (const file of [".env.local", "lib/.env", "art-src/private.png", "lib/../secret", "/etc/passwd", "C:/Users/private", "docs/제작기록/request.json"]) expect(snapshotEligible(file)).toBe(false);
    expect(snapshotEligible("lib/ui/viewer-companion/brain.ts")).toBe(true); expect(safeRelative("public/companion/hd/a.webp")).toBe(true);
    const env = childEnvironment({ PATH: "synthetic-bin", SUPABASE_SERVICE_ROLE_KEY: "synthetic-secret", NEXT_PUBLIC_SUPABASE_URL: "synthetic-production", OPENAI_API_KEY: "synthetic-secret" });
    expect(Object.keys(env).some(key => /SUPABASE|API_KEY/.test(key))).toBe(false); expect(env.NEXT_TELEMETRY_DISABLED).toBe("1");
    for (const value of ["https://127.0.0.1:3100", "http://example.com", "http://127.0.0.1.example.com", "http://user:pass@127.0.0.1", "http://127.0.0.1/path"]) expect(() => loopbackOrigin(value)).toThrow();
    expect(loopbackOrigin("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100"); expect(() => parseOptions(["--workers", "4"])).toThrow();
    expect(admitNodeRequest("https://fonts.gstatic.com/synthetic.woff2")).toBe(true);
    for (const url of ["https://synthetic.supabase.co/rest/v1/events", "https://vitals.vercel-insights.com/", "http://127.0.0.1:3100/api/soop-live", "https://fonts.gstatic.com.evil.invalid/x"]) expect(admitNodeRequest(url)).toBe(false);
    expect(admitNodeRequest("http://127.0.0.1:3100/visual-fixture/poster", "POST")).toBe(false);
    expect(admitNodeRequest("http://127.0.0.1:3100/visual-fixture/poster", "GET", "http://127.0.0.1:3100")).toBe(true);
    expect(admitNodeRequest("http://127.0.0.1:3101/visual-fixture/poster", "GET", "http://127.0.0.1:3100")).toBe(false);
  });
  it("uses only an exact owned PID tree and requires every declared personality evidence ID to pass", () => {
    expect(ownedTerminationCommand(1234, "win32", resolve("synthetic-windows"))).toEqual({ file: resolve("synthetic-windows/System32/taskkill.exe"), args: ["/PID", "1234", "/T", "/F"] });
    expect(() => ownedTerminationCommand(0)).toThrow(); expect(() => ownedTerminationCommand(-1)).toThrow();
    const cases = dailyCases(1), passed = cases.map(row => ({ scenario: { ...row }, status: "passed", sufficiency: { passed: true } }));
    expect(dailyEvidenceGate(cases, passed)).toBe(true);
    expect(dailyEvidenceGate(cases, passed.slice(1))).toBe(false);
    expect(dailyEvidenceGate(cases, [...passed.slice(1), passed[1]])).toBe(false);
    expect(dailyEvidenceGate(cases, passed.map((row, index) => index ? row : { ...row, status: "needs-review" }))).toBe(false);
    expect(dailyEvidenceGate(cases, passed.map((row, index) => index ? row : { ...row, sufficiency: { passed: false } }))).toBe(false);
  });
  it("admits only the exact independently audited immutable machine JSON bytes without following their references", () => {
    expect(AUDITED_MACHINE_METADATA).toHaveLength(18); expect(AUDITED_MACHINE_METADATA.reduce((sum, row) => sum + row.bytes, 0)).toBe(AUDITED_MACHINE_METADATA_BYTES);
    for (const entry of AUDITED_MACHINE_METADATA) {
      expect(snapshotEligible(entry.path)).toBe(false);
      const bytes = readFileSync(resolve(entry.path)), proof = { tracked: true, headUnchanged: true };
      expect(validateAuditedMachineMetadata(entry.path, bytes, proof)).toEqual(entry);
      expect(() => validateAuditedMachineMetadata(entry.path, bytes, { ...proof, tracked: false })).toThrow();
      expect(() => validateAuditedMachineMetadata(entry.path, bytes, { ...proof, headUnchanged: false })).toThrow();
      const changed = Buffer.from(bytes); changed[0] ^= 1;
      expect(() => validateAuditedMachineMetadata(entry.path, changed, proof)).toThrow();
      expect(() => validateAuditedMachineMetadata(entry.path, bytes.subarray(1), proof)).toThrow();
    }
    expect(() => validateAuditedMachineMetadata("art-src/private/user-feedback.json", Buffer.from("{}"), { tracked: true, headUnchanged: true })).toThrow();
  });
  it("requires all four independent learner, store, goal and actual-progress regressions without replacing an older suite", () => {
    expect(REQUIRED_AGENT_REGRESSIONS).toHaveLength(4);
    expect(registeredAgentRegressions([...REQUIRED_AGENT_REGRESSIONS], true)).toEqual(REQUIRED_AGENT_REGRESSIONS);
    for (const missing of REQUIRED_AGENT_REGRESSIONS) expect(() => registeredAgentRegressions(REQUIRED_AGENT_REGRESSIONS.filter(file => file !== missing), true)).toThrow();
    expect(() => registeredAgentRegressions([], true)).toThrow();
  });
  it.each(COMPANION_PERSONALITIES)("counts %s entry only after its real protocol acknowledgement", personality => {
    const director = createCompanionPersonalityDirector([]), input = scene(personality), entry = director.next(input)!;
    expect(entry.meta.id).toBe(`entry-${personality}`); expect(director.entryReady()).toBe(false);
    director.complete({ ...entry.meta, serial: entry.meta.serial - 1 }); expect(director.entryReady()).toBe(false);
    director.complete(entry.meta); expect(director.entryReady()).toBe(true); expect(director.completed()).toEqual([]); measured.entries++;
  });
  it.each(COMPANION_PERSONALITIES.flatMap(personality => ROUTINES.map(kind => ({ personality, kind }))))("admits finite $kind for $personality from its actual finite model preconditions", ({ personality, kind }) => {
    const input = scene(personality), arbiter = createCompanionRoutineArbiter();
    if (kind === "meal") { input.brain.hunger = .5; input.meal = { foodId: "synthetic-carrot" }; }
    if (kind === "wash") for (let n = 1; n <= 5; n++) arbiter.observe("played", n);
    if (kind === "sleep" || kind === "nap") { input.brain.energy = .15; input.environment = { ...input.environment!, band: kind === "sleep" ? "night" : "noon", night: kind === "sleep" }; }
    if (kind === "outing") input.radioAllowed=false; // Isolate the outing retry, not another valid leisure kind.
    if (kind === "outing" || kind === "music") { input.canOuting = kind !== "music"; arbiter.next(input); input.now = kind === "music" ? 35000 : personality === "sleepy" ? 45000 : personality === "homebody" ? 100000 : 8000; }
    const chosen = arbiter.next(input)!;
    expect(chosen?.kind).toBe(kind); expect(chosen.recipe.personality).toBe(personality); expect(chosen.recipe.steps.length).toBeGreaterThan(1);
    for (const step of chosen.recipe.steps) if ("ms" in step) expect(step.ms).toBeGreaterThan(0);
    const director = createCompanionPersonalityDirector([]), entry = director.next(input)!; director.complete(entry.meta);
    expect(director.startRoutine(chosen.recipe, input.now, chosen.itemId, chosen.outsideGoal)).toBe(true);
    expect(director.current()).toMatchObject({ id: `routine-${kind}`, routine: true }); expect(director.completed()).toEqual([]);
    arbiter.cancel(input.now); expect(arbiter.current()).toBeUndefined(); expect(arbiter.next(input)).toBeUndefined(); measured.routineTemplates++;
  });
});
const frame = (at: number, patch: Partial<QaFrame> = {}): QaFrame => ({ at, x: 100, y: 600, visible: true, decoded: true, state: "idle", eligible: true, pose: 0, ...patch });
const declaredNanumFonts = [
  "https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundR.woff2",
  "https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundB.woff2",
  "https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundEB.woff2",
];
describe("142 exact declared Node font admission", () => {
  it.each(declaredNanumFonts)("admits the declared static file for readonly Node requests%s", url => {
    expect(readFileSync(resolve("app/fonts.css"), "utf8")).toContain(`url("${url}")`);
    expect(admitNodeRequest(url, "GET")).toBe(true);
    expect(admitNodeRequest(url, "HEAD")).toBe(true);
  });
  it("rejects provider-wide, query, API, authority, port, protocol and mutation variants", () => {
    const denied = [
      ...declaredNanumFonts.flatMap(url => [url + "?tracking=1", url + "#fragment", url.replace(".woff2", ".woff")]),
      "https://hangeul.pstatic.net/api/private", "https://hangeul.pstatic.net/", "https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/Other.woff2",
      declaredNanumFonts[0].replace("https:", "http:"), declaredNanumFonts[0].replace("hangeul.pstatic.net/", "hangeul.pstatic.net:444/"),
      declaredNanumFonts[0].replace("hangeul.pstatic.net/", "user:synthetic@hangeul.pstatic.net/"), declaredNanumFonts[0].replace("hangeul.pstatic.net/", "hangeul.pstatic.net.example.invalid/"),
    ];
    for (const url of denied) expect(admitNodeRequest(url, "GET"), url).toBe(false);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) for (const url of declaredNanumFonts) expect(admitNodeRequest(url, method)).toBe(false);
  });
});
describe("142 actual native entry reporter gate", () => {
  const passedSpec = (title: string) => ({ title, tests: [{ expectedStatus: "passed", status: "expected", results: [{ status: "passed", retry: 0 }] }] });
  const nativeReport = () => ({ errors: [], suites: [{ specs: Array.from({ length: PLANNED_NATIVE_CASE_COUNT - NATIVE_ENTRY_TITLES.length - NATIVE_FLOATING_TIDY_TITLES.length }, (_, index) => passedSpec(`legacy-native-${index}`)), suites: [{ specs: NATIVE_ENTRY_TITLES.map(passedSpec) }, { specs: NATIVE_FLOATING_TIDY_TITLES.map(passedSpec) }] }] });
  it("requires every planned unique single-pass results including all27 entries and both exact floating-house tidy cases", () => {
    const result = nativeEntryEvidence(nativeReport());
    expect(result).toMatchObject({ status: "passed", gatePassed: true, requiredEntries: 27, registeredEntries: 27, passedEntries: 27, failedEntries: 0, skippedEntries: 0, notRunEntries: 0, selectedCaseCount: PLANNED_NATIVE_CASE_COUNT, selectedPassedCases: PLANNED_NATIVE_CASE_COUNT, floatingTidy: { required: 2, registered: 2, passed: 2, failed: 0, skipped: 0, notRun: 0 } });
  });
  it("reports entirely missing entry cases as not-run rather than promoting the pure entry model", () => {
    expect(nativeEntryEvidence(undefined)).toMatchObject({ status: "not-run", gatePassed: false, passedEntries: 0, notRunEntries: 27 });
    const report = nativeReport(); report.suites[0].suites[0].specs = [];
    expect(nativeEntryEvidence(report)).toMatchObject({ status: "not-run", gatePassed: false, registeredEntries: 0, notRunEntries: 27, selectedCaseCount: PLANNED_NATIVE_CASE_COUNT-NATIVE_ENTRY_TITLES.length });
  });
  it("rejects a missing, skipped or failed entry even if all remaining selected cases passed", () => {
    const missing = nativeReport(); missing.suites[0].suites[0].specs.pop();
    expect(nativeEntryEvidence(missing)).toMatchObject({ gatePassed: false, notRunEntries: 1, passedEntries: 26 });
    const skipped = nativeReport(); skipped.suites[0].suites[0].specs[0].tests[0].results[0].status = "skipped";
    expect(nativeEntryEvidence(skipped)).toMatchObject({ gatePassed: false, skippedEntries: 1, passedEntries: 26 });
    const failed = nativeReport(); failed.suites[0].suites[0].specs[0].tests[0].results[0].status = "failed";
    expect(nativeEntryEvidence(failed)).toMatchObject({ gatePassed: false, failedEntries: 1, passedEntries: 26 });
  });
  it("registers exactly two new native titles without changing the nine-model/27-selection distinction", () => {
    expect(NATIVE_FLOATING_TIDY_TITLES).toEqual([
      "142 floating home tidy preserves all four returns with learned care on",
      "142 floating home tidy returns from a real calendar perch to all four toys",
    ]);
    expect(new Set(NATIVE_FLOATING_TIDY_TITLES).size).toBe(2);
    for (const title of NATIVE_FLOATING_TIDY_TITLES) expect(new RegExp(NATIVE_GREP).test(title)).toBe(true);
    expect(universe()).toMatchObject({ modeledEntries: 9, plannedNativeEntryCases: 27, plannedNativeFloatingTidyCases: 2, plannedNativeCaseCount: PLANNED_NATIVE_CASE_COUNT });
  });
  it("never promotes the previous95-case result when both floating-house regressions did not run", () => {
    const old95 = nativeReport(); old95.suites[0].suites[1].specs = []; old95.suites[0].specs=old95.suites[0].specs.slice(0,95-NATIVE_ENTRY_TITLES.length);
    expect(nativeEntryEvidence(old95)).toMatchObject({ gatePassed: false, passedEntries: 27, selectedCaseCount: 95, selectedPassedCases: 95, floatingTidy: { required: 2, registered: 0, passed: 0, notRun: 2 } });
  });
  it.each(NATIVE_FLOATING_TIDY_TITLES)("requires exact floating-house result%s even when unrelated passes fill every planned slot", title => {
    const report = nativeReport(), cases = report.suites[0].suites[1].specs;
    const index = cases.findIndex(item => item.title === title); cases[index] = passedSpec("unrelated-padding-case");
    expect(nativeEntryEvidence(report)).toMatchObject({ gatePassed: false, selectedCaseCount: PLANNED_NATIVE_CASE_COUNT, selectedUniqueTitles: PLANNED_NATIVE_CASE_COUNT, selectedPassedCases: PLANNED_NATIVE_CASE_COUNT, floatingTidy: { registered: 1, passed: 1, notRun: 1 } });
  });
  it("rejects a duplicate floating-house title without treating the absent peer as success", () => {
    const report = nativeReport(), cases = report.suites[0].suites[1].specs; cases[1] = cases[0];
    expect(nativeEntryEvidence(report)).toMatchObject({ gatePassed: false, selectedCaseCount: PLANNED_NATIVE_CASE_COUNT, selectedUniqueTitles: PLANNED_NATIVE_CASE_COUNT-1, floatingTidy: { passed: 0, failed: 1, notRun: 1 } });
  });
  it.each(["skip", "fail", "retry", "expected-failure", "never-ran"] as const)("rejects floating-house%s outcomes while all27 selection entries pass", defect => {
    const report = nativeReport(), test = report.suites[0].suites[1].specs[0].tests[0];
    if (defect === "skip") test.results[0].status = "skipped";
    if (defect === "fail") test.results[0].status = "failed";
    if (defect === "retry") test.results[0].retry = 1;
    if (defect === "expected-failure") test.expectedStatus = "failed";
    if (defect === "never-ran") test.results = [];
    expect(nativeEntryEvidence(report)).toMatchObject({ gatePassed: false, passedEntries: 27, floatingTidy: { passed: 1 } });
  });
  it("rejects expected failures, retries, duplicate titles, zero execution and missing legacy coverage", () => {
    const wrongExpectation = nativeReport(); wrongExpectation.suites[0].suites[0].specs[0].tests[0].expectedStatus = "failed";
    const retried = nativeReport(); retried.suites[0].suites[0].specs[0].tests[0].results[0].retry = 1;
    const duplicate = nativeReport(); duplicate.suites[0].suites[0].specs[1] = duplicate.suites[0].suites[0].specs[0];
    const neverRan = nativeReport(); neverRan.suites[0].suites[0].specs[0].tests[0].results = [];
    const fewerCases = nativeReport(); fewerCases.suites[0].specs.pop();
    for (const report of [wrongExpectation, retried, duplicate, neverRan, fewerCases]) expect(nativeEntryEvidence(report).gatePassed).toBe(false);
  });
});
describe("142 read-only observation detectors", () => {
  it("finds actual ten-second stagnation while excluding a hidden interval and deliberate sleep", () => {
    const trace = Array.from({ length: 102 }, (_, i) => frame(i * 100));
    expect(inspectTrace(trace).findings.map(f => f.rule)).toContain("no-visible-progress-10s");
    expect(inspectTrace(trace.map(f => ({ ...f, eligible: false }))).eligibleFrames).toBe(0);
    expect(inspectTrace(trace.map(f => ({ ...f, state: "sleep", sleepAllowed: true }))).findings).toEqual([]);
    expect(inspectTrace([frame(0), frame(10001, { visible: false }), frame(11000)]).findings).toEqual([]);
  });
  it("detects A-B-A only with a current stable-food proof and keeps sleep OFF authoritative", () => {
    expect(inspectTrace([frame(0, { goal: "a", stableFood: true }), frame(100, { goal: "b", stableFood: true }), frame(200, { goal: "a", stableFood: true })]).findings.map(f => f.rule)).toContain("food-target-thrash");
    expect(inspectTrace([frame(0, { goal: "a" }), frame(100, { goal: "b" }), frame(200, { goal: "a" })]).findings).toEqual([]);
    expect(inspectTrace([frame(0, { state: "sleep", sleepAllowed: false })]).findings.map(f => f.rule)).toContain("sleep-off");
  });
  it("reports nearby cleanup only as a candidate and requires measured clip evidence", () => {
    expect(inspectTrace([frame(0, { items: "two-items" })]).findings).toEqual([]);
    expect(inspectTrace([frame(0, { nearbyCleanupCandidate: true, cleanupWaitingMs: 10001 })]).findings[0].rule).toBe("nearby-cleanup-no-progress-candidate");
    expect(inspectTrace([frame(0, { clipError: 3, intendedOcclusion: true })]).findings).toEqual([]);
    expect(inspectTrace([frame(0, { clipError: 3 })]).findings[0].rule).toBe("body-clip");
  });
  it("rejects looping pose and beat changes as progress but observes real AI carry and home-control changes", () => {
    const trace = Array.from({ length: 102 }, (_, i) => frame(i * 100, { pose: i % 5, beat: String(i % 3), effect: String(i % 4), carried: "same-real-food" }));
    expect(inspectTrace(trace).findings.map(f => f.rule)).toContain("no-visible-progress-10s");
    expect(inspectTrace(trace.map((f, i) => ({ ...f, controls: String(Math.floor(i / 25)) }))).findings).toEqual([]);
    expect(inspectTrace(trace.map((f, i) => ({ ...f, carried: String(Math.floor(i / 25)) }))).findings).toEqual([]);
  });
  const actualWash = (at: number, patch: Partial<QaFrame> = {}): QaFrame => frame(at, {
    state: "play", platform: "companion-home-floor-400", pose: 144 + Math.floor(at / 100) % 16,
    wash: { signaled: true, command: "wash", row9: true, body: { x: 54, y: 508, width: 92, height: 92 },
      pad: { x: 70, y: 585.6, width: 60, height: 20, visible: true, decoded: true },
      brush: { x: 96 + Math.sin(at / 65) * 2, y: 560, width: 32, height: 42, visible: true, angle: -30 + Math.sin(at / 80) * 9 } }, ...patch });
  const washTrace = () => Array.from({ length: 121 }, (_, i) => actualWash(i * 100));
  it("credits only sustained decoded row9 with actual pad contact and fresh body-relative brush motion", () => {
    const analysis = inspectTrace(washTrace());
    expect(analysis.washProgressFrames).toBeGreaterThan(90);
    expect(analysis.findings).toEqual([]);
    expect(inspectTrace(washTrace().slice(0, 5)).washProgressFrames).toBe(0);
    expect(inspectTrace([]).washProgressFrames).toBe(0);
  });
  it("rejects a stopped visible brush even while sprite pixels, pose, labels and scene beats change", () => {
    const trace = washTrace().map(f => ({ ...f, beat: String(f.at % 300), scene: "routine-wash", wash: { ...f.wash!, brush: { ...f.wash!.brush!, x: 96, angle: -30 } } }));
    expect(inspectTrace(trace).washProgressFrames).toBe(0);
    expect(inspectTrace(trace).findings.map(f => f.rule)).toContain("no-visible-progress-10s");
  });
  it("rejects off-pad, hidden, missing, undecoded or wrong-source wash observations", () => {
    const trace = washTrace();
    const bad = [
      trace.map(f => ({ ...f, wash: { ...f.wash!, pad: { ...f.wash!.pad!, x: 150 } } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, brush: { ...f.wash!.brush!, visible: false } } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, brush: null } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, brush: { ...f.wash!.brush!, x: 400 } } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, brush: { ...f.wash!.brush!, angle: NaN } } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, signaled: false } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, command: "bow" } })),
      trace.map(f => ({ ...f, visible: false })), trace.map(f => ({ ...f, decoded: false })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, row9: false } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, pad: { ...f.wash!.pad!, visible: false } } })),
      trace.map(f => ({ ...f, wash: { ...f.wash!, pad: { ...f.wash!.pad!, decoded: false } } })),
    ];
    for (const candidate of bad) expect(inspectTrace(candidate).washProgressFrames).toBe(0);
    expect(inspectTrace(bad[0]).findings.map(f => f.rule)).toContain("no-visible-progress-10s");
    expect(inspectTrace(bad[1]).findings.map(f => f.rule)).toContain("no-visible-progress-10s");
  });
  it("does not treat whole-room scrolling or a changing sprite with one frozen physical frame as brushing", () => {
    const trace = washTrace().map(f => {
      const dy = f.at / 100;
      return { ...f, y: f.y + dy, wash: { ...f.wash!, body: { ...f.wash!.body!, y: f.wash!.body!.y + dy },
        pad: { ...f.wash!.pad!, y: f.wash!.pad!.y + dy }, brush: { ...f.wash!.brush!, x: 96, y: 560 + dy, angle: -30 } } };
    });
    expect(inspectTrace(trace).washProgressFrames).toBe(0);
    expect(inspectTrace(washTrace().map(f => ({ ...f, pose: 144 }))).washProgressFrames).toBe(0);
  });
  it("expires motion credit and still flags ten seconds after the last genuine wash rather than exempting its labels", () => {
    const trace = Array.from({ length: 151 }, (_, i) => actualWash(i * 100));
    const lastReal = actualWash(2500).wash!.brush!;
    for (const f of trace) if (f.at > 2500) f.wash!.brush = { ...lastReal };
    const analysis = inspectTrace(trace);
    expect(analysis.washProgressFrames).toBeGreaterThan(0);
    expect(analysis.washProgressFrames).toBeLessThan(30);
    expect(analysis.findings.find(f => f.rule === "no-visible-progress-10s")?.at).toBeGreaterThanOrEqual(12500);
    expect(analysis.findings.find(f => f.rule === "no-visible-progress-10s")?.at).toBeLessThanOrEqual(12700);
  });
  it("resets wash evidence across missing samples and honors OFF, input ownership and legal sleep", () => {
    const trace = washTrace();
    expect(inspectTrace(trace.map(f => ({ ...f, at: f.at * 3 }))).washProgressFrames).toBe(0);
    for (const patch of [{ enabled: false }, { eligible: false }, { owned: true }, { blocked: true }, { state: "sleep", sleepAllowed: true }]) expect(inspectTrace(trace.map(f => ({ ...f, ...patch }))).washProgressFrames).toBe(0);
    expect(inspectTrace(trace.map(f => ({ ...f, state: "sleep", sleepAllowed: false }))).findings.map(f => f.rule)).toContain("sleep-off");
    expect(inspectTrace(trace.map(f => ({ ...f, wash: { ...f.wash!, brush: null } }))).washProgressFrames).toBe(0);
  });
  it("never counts empty, hidden, undecoded or short traces as sufficient ninety-second evidence", () => {
    const trace = Array.from({ length: 901 }, (_, i) => frame(i * 100));
    expect(traceSufficiency(trace).passed).toBe(true);
    for (const candidate of [[], trace.slice(0, 80), trace.map(f => ({ ...f, visible: false })), trace.map(f => ({ ...f, decoded: false }))]) expect(traceSufficiency(candidate).passed).toBe(false);
  });
});

describe("142 ordinary two-point route oscillation candidate", () => {
  function repeatedTrip(): QaFrame[] {
    const values: QaFrame[] = [];
    for (let leg = 0; leg < 5; leg++) {
      const destination = leg % 2 ? 520 : 558;
      const common = { scene: "", items: "food-1|", controls: "off|true|open|false", carried: "", enabled: true, roam: true, sourceClipMeasured: true, walkSource: true, lifePurpose: "ordinary", humanEpoch: 0, layoutEpoch: 0 };
      if (leg) for (let n = 1; n <= 10; n++) values.push(frame(leg * 5000 - 1100 + n * 100, { ...common, state: "jump", y: (leg % 2 ? 558 : 520) + (destination - (leg % 2 ? 558 : 520)) * n / 10, pose: n % 2 + 1, platform: leg % 2 ? "floor" : "sofa" }));
      for (let n = 0; n < 40; n++) values.push(frame(leg * 5000 + n * 100, { ...common, state: "look", y: destination, pose: n % 2 + 4, platform: leg % 2 ? "sofa" : "floor" }));
    }
    return values;
  }
  it("flags four actual decoded transfers and three reversals between the same two measured settled points within30s", () => {
    expect(ordinaryRouteOscillations(repeatedTrip())).toMatchObject([{ rule: "ordinary-two-point-route-oscillation", evidence: { transitions: 4, reversals: 3, inputContextObserved: true } }]);
  });
  it("can audit legacy raw positions but explicitly cannot claim unrecorded human inactivity", () => {
    const trace = repeatedTrip().map(value => ({ ...value, lifePurpose: undefined, humanEpoch: undefined, layoutEpoch: undefined }));
    expect(ordinaryRouteOscillations(trace)).toEqual([]);
    expect(ordinaryRouteOscillations(trace, { legacyAudit: true })[0]).toMatchObject({ evidence: { inputContextObserved: false } });
    expect(ordinaryRouteOscillations(trace, { legacyAudit: true })[0].detail).toContain("absence of those events is unproved");
  });
  it.each(["meal", "sleep", "wash", "four-returns", "TV-visit", "moving-mouse", "human-hold", "new-target", "layout-scroll", "layout-resize", "hidden", "undecoded", "OFF", "roam-OFF", "blocked", "missing-purpose", "missing-epochs", "care-purpose", "social-purpose", "authored-purpose", "explore-purpose", "frozen-pose", "pose-only", "incomplete", "third-point", "slow", "gap", "bad-time"] as const)("does not flag %s as purposeless ordinary oscillation", reason => {
    let trace = repeatedTrip(); const middle = trace.filter(value => value.at >= 9500 && value.at <= 12500);
    for (const value of middle) {
      if (reason === "meal") value.state = "eat";
      if (reason === "sleep") value.state = "sleep";
      if (reason === "wash") value.scene = "routine-wash";
      if (reason === "four-returns") value.carried = "actual-toy-2";
      if (reason === "TV-visit") value.scene = "routine-music";
      if (reason === "human-hold") value.owned = true;
      if (reason === "new-target") value.goal = "new-actual-food";
      if (reason === "hidden") value.visible = false;
      if (reason === "undecoded") value.decoded = false;
      if (reason === "OFF") value.enabled = false;
      if (reason === "roam-OFF") value.roam = false;
      if (reason === "blocked") value.blocked = true;
      if (reason === "missing-purpose") value.lifePurpose = undefined;
      if (reason === "missing-epochs") value.humanEpoch = undefined;
      if (reason === "care-purpose") value.lifePurpose = "care";
      if (reason === "social-purpose") value.lifePurpose = "social";
      if (reason === "authored-purpose") value.lifePurpose = "authored";
      if (reason === "explore-purpose") value.lifePurpose = "explore";
    }
    if (reason === "moving-mouse") for (const value of trace.filter(value => value.at >= 9500)) value.humanEpoch = 1;
    if (reason === "layout-scroll" || reason === "layout-resize") for (const value of trace.filter(value => value.at >= 9500)) value.layoutEpoch = 1;
    if (reason === "TV-visit") for (const value of trace.filter(value => value.at >= 9500)) value.controls = "nature|true|open|false";
    if (reason === "four-returns") for (const value of trace.filter(value => value.at >= 12500)) value.items = "food-1|toy-3,toy-4";
    if (reason === "frozen-pose") for (const value of trace) value.pose = 2;
    if (reason === "pose-only") for (const value of trace) { value.state = "look"; value.y = 558; value.platform = "floor"; }
    if (reason === "incomplete") trace = trace.filter(value => value.at < 19000);
    if (reason === "third-point") for (const value of trace.filter(value => value.at >= 9500 && value.at < 13500)) { value.x += 48; value.platform = "third"; }
    if (reason === "slow") for (const value of trace) value.at *= 2;
    if (reason === "gap") trace = trace.filter(value => value.at < 10000 || value.at > 11500);
    if (reason === "bad-time") trace.find(value => value.at === 10000)!.at = NaN;
    expect(ordinaryRouteOscillations(trace)).toEqual([]);
  });
  it("keeps the existing10s stationary detector unchanged rather than accepting pose labels as accomplishments", () => {
    const trace = Array.from({ length: 120 }, (_, n) => frame(n * 100, { pose: n % 16, scene: "changing-label", beat: String(n) }));
    expect(inspectTrace(trace).findings.map(value => value.rule)).toContain("no-visible-progress-10s");
  });
  it("fails daily context closed for empty, missing, invalid or negative observations without substituting ordinary", () => {
    const trace = repeatedTrip(); expect(traceContextComplete(trace)).toBe(true); expect(traceContextComplete([])).toBe(false);
    for (const patch of [{ lifePurpose: undefined }, { lifePurpose: "unknown-private-value" }, { humanEpoch: undefined }, { humanEpoch: -1 }, { layoutEpoch: NaN }]) {
      expect(traceContextComplete(trace.map((value, index) => index === 4 ? { ...value, ...patch } : value))).toBe(false);
    }
    expect(traceContextComplete(trace.map(value => ({ ...value, visible: false })))).toBe(false);
  });
});

describe("142 ordinary horizontal pacing keeps short real stops and ignores nonwork label changes", () => {
  function pacing(): QaFrame[] {
    const values: QaFrame[]=[];let at=0;
    const sample=(x:number,state:string,pose:number):QaFrame=>frame(at+=80,{x,y:600,state,pose,platform:"actual-floor",lifePurpose:"ordinary",humanEpoch:0,layoutEpoch:0,items:"|",controls:"off|true|open|false",walkSource:state==="walk",enabled:true,roam:true});
    values.push(sample(100,"idle",0));
    for(let leg=0;leg<4;leg++){
      const from=leg%2 ? 200:100,to=leg%2 ? 100:200;
      for(let n=1;n<=12;n++)values.push(sample(from+(to-from)*n/12,"walk",companionSpriteMetadata.rows[20][n%5]));
      values.push(sample(to,"idle",0));
    }
    return values;
  }
  it("flags four registered physical walks/three reversals despite only one observed idle frame at each endpoint",()=>{
    expect(ordinaryWalkPacing(pacing())).toMatchObject([{rule:"ordinary-walk-pacing",evidence:{ordinaryMotionOnly:true,shortStopsAllowed:true,legs:[{distance:100},{distance:100},{distance:100},{distance:100}]}}]);
  });
  it("retains earlier ordinary completion when only its next stationary label becomes explore",()=>{
    const trace=pacing().map(value=>value.state==="idle" ? {...value,lifePurpose:"explore"}:value);
    expect(ordinaryWalkPacing(trace)).toHaveLength(1);
  });
  it("requires current decoded registered walk-source proof; source/pose labels alone do not qualify",()=>{
    expect(ordinaryWalkPacing(pacing().map(value=>({...value,walkSource:false})))).toEqual([]);
    expect(ordinaryWalkPacing(pacing().map(value=>({...value,pose:304})))).toEqual([]);
  });
  it.each(["noise","one-way","two-turns","jump","parabola","teleport","new-goal","actual-explore-travel","food-carry","toy-return","actual-control","items-change","human","layout","held","hidden","undecoded","OFF","quiet","scene","sleep","meal","missing-source","source-only-stationary-end","unregistered-moving","gap"] as const)("rejects %s while retaining the fixed10s and30s rules",reason=>{
    let trace=pacing();
    if(reason==="noise")for(const value of trace)value.x=100+(value.x-100)*.1;
    if(reason==="one-way")for(const value of trace)value.x=100+value.at/80*5;
    if(reason==="two-turns")trace=trace.slice(0,40);
    if(reason==="jump")for(const value of trace)if(value.state==="walk")value.state="jump";
    if(reason==="parabola")for(let n=0;n<trace.length;n++)trace[n].y+=Math.sin(n/12*Math.PI)*20;
    if(reason==="teleport")for(const value of trace)value.at/=30;
    const middle=trace.filter(value=>value.at>=1600&&value.at<=2400);
    for(const value of middle){
      if(reason==="new-goal")value.goal="actual-existing-food-goal";
      if(reason==="actual-explore-travel")value.lifePurpose="explore";
      if(reason==="food-carry"||reason==="toy-return")value.carried="actual-carried-object";
      if(reason==="held")value.owned=true;
      if(reason==="hidden")value.visible=false;
      if(reason==="undecoded")value.decoded=false;
      if(reason==="OFF")value.enabled=false;
      if(reason==="quiet")value.eligible=false;
      if(reason==="scene")value.scene="routine-music";
      if(reason==="sleep")value.state="sleep";
      if(reason==="meal")value.state="eat";
    }
    if(reason==="actual-control")for(const value of trace.filter(value=>value.at>=1600))value.controls="nature|true|open|false";
    if(reason==="items-change")for(const value of trace.filter(value=>value.at>=1600))value.items="|new-toy";
    if(reason==="human")for(const value of trace.filter(value=>value.at>=1600))value.humanEpoch=1;
    if(reason==="layout")for(const value of trace.filter(value=>value.at>=1600))value.layoutEpoch=1;
    if(reason==="missing-source")for(const value of trace)value.walkSource=undefined;
    if(reason==="source-only-stationary-end"||reason==="unregistered-moving"){
      for(let leg=0;leg<4;leg++)for(let n=0;n<12;n++){
        const value=trace[1+leg*13+n];value.walkSource=n>=9;
        if(reason==="source-only-stationary-end"&&n>=9)value.x=leg%2?100:200;
      }
    }
    if(reason==="gap")trace=trace.filter(value=>value.at<1600||value.at>2000);
    expect(ordinaryWalkPacing(trace)).toEqual([]);
  });
  it("keeps new walk-source context mandatory instead of converting its absence to a passing empty finding list",()=>{
    expect(traceContextComplete(pacing())).toBe(true);
    expect(traceContextComplete(pacing().map(value=>({...value,walkSource:undefined})))).toBe(false);
  });
});
