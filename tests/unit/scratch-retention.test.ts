import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_POLICY, plan, removeUnit, slimRun, dedupe, parseArgs, referencedPaths, units } from "../../scripts/scratch-retention/retention.mjs";

const DAY = 86400000, GIB = 2 ** 30, NOW = Date.UTC(2026, 9, 23, 0, 0, 0);
const temps: string[] = [];
afterEach(() => { for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scratch-retention-"));
  temps.push(dir);
  const root = path.join(dir, ".scratch-pw");
  fs.mkdirSync(root);
  return { dir, root };
}
/** Create `rel` under root with one file of `bytes`, dated `ageDays` before NOW, plus optional JSON files. */
function unit(root: string, rel: string, ageDays: number, bytes = 1024, json: Record<string, unknown> = {}) {
  const dir = path.join(root, rel);
  fs.mkdirSync(dir, { recursive: true });
  const at = new Date(NOW - ageDays * DAY);
  const data = path.join(dir, "data.bin");
  fs.writeFileSync(data, Buffer.alloc(bytes, 7));
  fs.utimesSync(data, at, at);
  for (const [name, value] of Object.entries(json)) { const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify(value)); fs.utimesSync(f, at, at); }
  return dir;
}
const policy = (extra: Partial<typeof DEFAULT_POLICY> = {}) => ({ ...DEFAULT_POLICY, budgetBytes: 100 * GIB, minFreeBytes: 0, ...extra });
const removed = (p: { remove: { dir: string }[] }) => p.remove.map(u => path.basename(u.dir)).sort();

describe("scratch retention plan", () => {
  it("keeps the newest runs and newest success of each factory and expires the rest by status age", () => {
    const { root } = repo();
    unit(root, "companion-daily/20261001000000-1-aaaaaaaa", 22, 10, { "report.json": { status: "completed-scoped-checks" } });
    unit(root, "companion-daily/20261010000000-1-bbbbbbbb", 13, 10, { "report.json": { status: "failed" } });
    unit(root, "companion-daily/20261018000000-1-cccccccc", 5, 10, { "report.json": { status: "completed-scoped-checks" } });
    unit(root, "companion-daily/20261020000000-1-dddddddd", 3, 10, { "report.json": { status: "failed" } });
    unit(root, "companion-daily/20261021000000-1-eeeeeeee", 2, 10, { "report.json": { status: "failed" } });
    const p = plan({ roots: [root], worktrees: [], now: NOW, policy: policy(), refs: new Set() });
    // newest two (eeee, dddd) and newest success (cccc) kept; aaaa success >3d and bbbb failure >7d expire.
    expect(removed(p)).toEqual(["20261001000000-1-aaaaaaaa", "20261010000000-1-bbbbbbbb"]);
  });

  it("never removes in-progress, state-referenced, receipt-chained or worktree-containing units", () => {
    const { dir, root } = repo();
    unit(root, "companion-daily/20261001000000-1-aaaaaaaa", 30, 10, { "report.json": { status: "failed" } });
    unit(root, "companion-daily/20261002000000-1-bbbbbbbb", 30, 10, { "report.json": { status: "failed" } });
    unit(root, "companion-daily/20261003000000-1-cccccccc", 30, 10, { "report.json": { status: "failed" } });
    const chained = unit(root, "site-daily/native/old-proof", 30, 10, { "result.json": { status: "failed" } });
    unit(root, "site-daily/native/current", 30, 10, { "result.json": { status: "failed", proofRef: chained.replaceAll("\\", "/") + "/result.json" } });
    fs.writeFileSync(path.join(root, "site-daily", "state.json"), JSON.stringify({ previousFailedRun: path.join(root, "companion-daily/20261001000000-1-aaaaaaaa"), lastDiagnosticRef: ".scratch-pw/site-daily-165/ref.json", nativeCurrent: path.join(root, "site-daily/native/current") }));
    unit(root, "site-daily-165", 30);
    const active = unit(root, "companion-123", 0.01);
    const withWorktree = unit(root, "side-toy-150", 40);
    const worktree = path.join(withWorktree, "release-worktree");
    fs.mkdirSync(worktree);
    const p = plan({ roots: [root], worktrees: [dir, worktree], now: NOW, policy: policy({ keepLatestPerFactory: 0 }), refs: referencedPaths([root]) });
    const kept = new Map(p.units.filter(u => u.protected).map(u => [path.basename(u.dir), u.protected]));
    expect(kept.get("20261001000000-1-aaaaaaaa")).toMatch(/referenced/);
    expect(kept.get("site-daily-165")).toMatch(/referenced/);
    expect(kept.get("current")).toMatch(/referenced/);
    expect(kept.get("old-proof")).toMatch(/referenced/);
    expect(kept.get(path.basename(active))).toMatch(/written within/);
    expect(kept.get("side-toy-150")).toMatch(/worktree/);
    expect(removed(p)).toEqual(["20261002000000-1-bbbbbbbb", "20261003000000-1-cccccccc"]);
  });

  it("keeps every run a kept run cites, even when no state file mentions it", () => {
    const { root } = repo();
    const base = unit(root, "site-daily/native/n1-base", 30, 10, { "result.json": { status: "failed" } });
    const mid = unit(root, "site-daily/native/n2-mid", 29, 10, { "result.json": { status: "failed", continueFrom: base + "\\result.json" } });
    unit(root, "site-daily/native/n3-unrelated", 28, 10, { "result.json": { status: "failed" } });
    unit(root, "site-daily/native/n4-newest", 1, 10, { "result.json": { status: "failed", reuseBuild: mid.replaceAll("\\", "/") } });
    const p = plan({ roots: [root], worktrees: [], now: NOW, policy: policy({ keepLatestPerFactory: 1 }), refs: new Set() });
    expect(removed(p)).toEqual(["n3-unrelated"]);
    expect(p.units.find(u => u.dir === base)?.protected).toMatch(/cited by a kept run/);
  });

  it("expires feature folders, test leftovers and stale tool environments on their own clocks", () => {
    const { root } = repo();
    unit(root, "companion-140", 20);
    unit(root, "companion-160", 5);
    unit(root, "focused-receipt-abc", 2);
    const kept = unit(root, "face-stamp-revision", 5);
    unit(root, "face-stamp-revision/normal/hf-native", 10, 10, { "pyvenv.cfg": {} });
    const p = plan({ roots: [root], worktrees: [], now: NOW, policy: policy(), refs: new Set() });
    expect(removed(p)).toEqual(["companion-140", "focused-receipt-abc", "hf-native"]);
    expect(p.remove.find(u => u.kind === "tool-env")?.dir).toBe(path.join(kept, "normal", "hf-native"));
  });

  it("removes the oldest unprotected units first until under budget and above the free floor", () => {
    const { root } = repo();
    unit(root, "a-old", 9, 4096);
    unit(root, "b-mid", 8, 4096);
    unit(root, "c-new", 7, 4096);
    const p = plan({ roots: [root], worktrees: [], now: NOW, free: 0, policy: policy({ featureDays: 30, budgetBytes: 5000 }), refs: new Set() });
    expect(removed(p)).toEqual(["a-old", "b-mid"]);
    expect(p.remove.every(u => /budget|floor/.test(u.reason ?? ""))).toBe(true);
  });

  it("classifies factories, native runs and leftovers", () => {
    const { root } = repo();
    unit(root, "companion-daily/20261001000000-1-aaaaaaaa", 1);
    unit(root, "site-daily/native/n1", 1);
    unit(root, "site-daily/2026-10-21-1-x", 1);
    unit(root, "focused-continue-1", 1);
    unit(root, "qa", 1);
    const kinds = Object.fromEntries(units(root).map(u => [path.basename(u.dir), `${u.kind}:${u.factory ?? ""}`]));
    expect(kinds).toEqual({ "20261001000000-1-aaaaaaaa": "factory:companion-daily", n1: "factory:site-daily/native", "2026-10-21-1-x": "factory:site-daily", "focused-continue-1": "leftover:", qa: "feature:" });
  });
});

describe("scratch retention actions", () => {
  it("unlinks links instead of following them and refuses paths outside .scratch-pw", () => {
    const { dir, root } = repo();
    const outside = path.join(dir, "node_modules");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "keep.txt"), "x");
    const run = unit(root, "companion-daily/20261001000000-1-aaaaaaaa", 30);
    fs.mkdirSync(path.join(run, "workspace"));
    fs.symlinkSync(outside, path.join(run, "workspace", "node_modules"), process.platform === "win32" ? "junction" : "dir");
    expect(() => removeUnit(outside, [root])).toThrow(/outside/);
    expect(removeUnit(run, [root])).toBe(true);
    expect(fs.existsSync(path.join(outside, "keep.txt"))).toBe(true);
  });

  it("slims only the webpack cache of a finished run", () => {
    const { root } = repo();
    const run = unit(root, "companion-daily/20261001000000-1-aaaaaaaa", 1);
    for (const rel of ["workspace/.next/cache/webpack/0.pack", "workspace/.next/BUILD_ID", "attempt-01/trace.zip"]) { fs.mkdirSync(path.dirname(path.join(run, rel)), { recursive: true }); fs.writeFileSync(path.join(run, rel), "data"); }
    expect(slimRun(run, { compress: false })).toBe(4);
    expect(fs.existsSync(path.join(run, "workspace/.next/cache"))).toBe(false);
    expect(fs.readFileSync(path.join(run, "workspace/.next/BUILD_ID"), "utf8")).toBe("data");
    expect(fs.existsSync(path.join(run, "attempt-01/trace.zip"))).toBe(true);
  });

  it("hardlinks byte-identical files without changing their bytes", () => {
    const { root } = repo();
    const a = unit(root, "a", 1, 70000), b = unit(root, "b", 1, 70000), c = unit(root, "c", 1, 70000);
    fs.writeFileSync(path.join(c, "data.bin"), Buffer.alloc(70000, 9));
    const result = dedupe([a, b, c]);
    expect(result).toEqual({ saved: 70000, linked: 1 });
    const ino = (d: string) => fs.statSync(path.join(d, "data.bin"), { bigint: true }).ino;
    expect(ino(a)).toBe(ino(b));
    expect(ino(a)).not.toBe(ino(c));
    expect(fs.readFileSync(path.join(b, "data.bin")).equals(Buffer.alloc(70000, 7))).toBe(true);
  });

  it("parses policy overrides in GiB and days", () => {
    const o = parseArgs(["--apply", "--budgetBytes", "20", "--failureDays", "10", "--root", "."]);
    expect(o.apply).toBe(true);
    expect(o.policy.budgetBytes).toBe(20 * GIB);
    expect(o.policy.failureDays).toBe(10);
    expect(() => parseArgs(["--bogus"])).toThrow();
  });
});
