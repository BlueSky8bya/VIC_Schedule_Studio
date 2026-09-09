import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
// @ts-expect-error Native ESM CLI module; behavior is tested without bundling an alternate implementation.
import { assessDrift, changedPaths, markdownLinks, renderBrief, snapshot, validateMemory } from "../../scripts/agent-harness/memory.mjs";

const scratch: string[] = [];
const write = (root: string, path: string, body: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), body, "utf8");
};
const state = (work = "", next = "- Continue active work.") => [
  "# Current State",
  "## Current Objective", "Preserve current intent.",
  "## Active Work", "| ID | Status | Next | Record |", "|---|---|---|---|", work,
  "## Blockers", "- None.",
  "## Next Exact Steps", next,
  "## Last Verified", "- Verification is pending."
].join("\n");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "vic-memory-"));
  scratch.push(root);
  write(root, "agent-harness.yaml", "protocol_source: fixture\nmemory:\n  current_state_max_bytes: 8192\n");
  write(root, "AGENTS.md", "Public/private boundary is server-enforced.");
  write(root, "CLAUDE.md", "Read AGENTS.md.");
  write(root, "docs/agent/CURRENT_STATE.md", state());
  write(root, "docs/agent/plans/ACTIVE_PLAN.md", "# Active Plan\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["-c", "core.autocrlf=false", "add", "."], { cwd: root });
  execFileSync("git", ["-c", "user.name=Harness Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"], { cwd: root });
  return root;
}

afterAll(() => {
  for (const root of scratch) {
    // Every recursively removed path is an exact mkdtemp child of the intended temp directory.
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith("vic-memory-")) throw new Error("Unsafe fixture cleanup target");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("bounded current repository memory", () => {
  it("refuses oversized mandatory state without truncating its blocker", () => {
    const root = fixture();
    write(root, "docs/agent/CURRENT_STATE.md", state().replace("- None.", "중요한 차단 ".repeat(1800)));
    expect(() => renderBrief(root)).toThrow(/exceeds/);
    expect(readFileSync(join(root, "docs/agent/CURRENT_STATE.md"), "utf8")).toContain("중요한 차단");
  });

  it("does not inject the decision index or historical records", () => {
    const root = fixture();
    write(root, "docs/agent/decisions/DECISION_INDEX.md", "RETIRED_TASK_SENTINEL ".repeat(20000));
    write(root, "docs/agent/archive/old.md", "DO_NOT_REPLAY_OLD_TASK");
    const brief = renderBrief(root);
    expect(brief).toContain("Preserve current intent");
    expect(brief).not.toContain("RETIRED_TASK_SENTINEL");
    expect(brief).not.toContain("DO_NOT_REPLAY_OLD_TASK");
    expect(Buffer.byteLength(brief)).toBeLessThan(8192);
  });

  it("counts configured Claude rule files in the combined startup budget", () => {
    const root = fixture();
    write(root, ".claude/rules/large.md", "Mandatory rule ".repeat(2000));
    expect(() => renderBrief(root)).toThrow(/always-loaded/);
  });

  it("rejects duplicate current sections", () => {
    const root = fixture();
    write(root, "docs/agent/CURRENT_STATE.md", state() + "\n## Next Exact Steps\n- Replay old task.");
    expect(validateMemory(root).join("\n")).toMatch(/exactly one 'Next Exact Steps'/);
  });

  it("rejects completed work still offered as an active task or next action", () => {
    const root = fixture();
    write(root, "docs/agent/plans/DONE.md", "# Done\nStatus: Completed\n");
    write(root, "docs/agent/CURRENT_STATE.md", state(
      "| PLAN-1 | In progress | Build | [Plan](plans/DONE.md) |",
      "- [Execute plan](plans/DONE.md)"
    ));
    const errors = validateMemory(root).join("\n");
    expect(errors).toContain("active work points to Completed");
    expect(errors).toContain("next action points to closed");
  });

  it("ignores fenced historical commands and links, including shorter nested fences", () => {
    const fence = String.fromCharCode(96).repeat(4);
    const inner = String.fromCharCode(96).repeat(3);
    const body = "[Current](current.md)\n" + fence + "markdown\n[Old](deleted.md)\n" + inner + "\n[Still old](also-deleted.md)\n" + fence;
    expect(markdownLinks(body)).toEqual(["current.md"]);
  });

  it("rejects plain next-action IDs after their active row is removed", () => {
    const root = fixture();
    write(root, "docs/agent/CURRENT_STATE.md", state("| ART-PINE-R4 | Planned | Prepare | Pending |", "1. ART-PINE-R4: check SHA-256 and UTF-8 against ADR-0015."));
    expect(validateMemory(root)).toEqual([]);
    write(root, "docs/agent/CURRENT_STATE.md", state("", "1. ART-PINE-R4: prepare the batch."));
    expect(validateMemory(root).join("\n")).toContain("inactive ID ART-PINE-R4");
  });

  it.each(["완료", "해결", "철회", "완료 (2026-09-09)"])("rejects Korean closed status %s", (status) => {
    const root = fixture();
    write(root, "docs/agent/CURRENT_STATE.md", state("| PLAN-1 | " + status + " | Replay | None |"));
    expect(validateMemory(root).join("\n")).toContain("closed work must leave active index");
  });
});

describe("session documentation impact", () => {
  it("excludes inherited dirty content and detects later edits to the same file", () => {
    const root = fixture();
    write(root, "scripts/ambient-example.mjs", "// user's existing unfinished work");
    const before = snapshot(root);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
    write(root, "scripts/ambient-example.mjs", "// changed this session");
    expect(changedPaths(before, snapshot(root))).toEqual(["scripts/ambient-example.mjs"]);
  });

  it("includes scripts and artwork; touching CURRENT_STATE alone is not a domain record", () => {
    const before = { files: { "docs/agent/CURRENT_STATE.md": "old" } };
    const after = { files: { "docs/agent/CURRENT_STATE.md": "new", "public/ambient/art/rock-1.png": "image", "scripts/ambient-example.mjs": "code" } };
    expect(assessDrift(before, after).missing).toEqual(["ambient"]);
  });

  it("accepts the related domain record without demanding a CURRENT_STATE edit", () => {
    const before = { files: { "components/shared/ambient/example.ts": "old" } };
    const after = { files: { "components/shared/ambient/example.ts": "new", "docs/ambient/QA_PROGRESS.md": "updated" } };
    expect(assessDrift(before, after).missing).toEqual([]);
  });

  it("captures hook and product configuration changes for impact review", () => {
    const root = fixture();
    const before = snapshot(root);
    write(root, ".claude/settings.json", "{}");
    write(root, "next.config.ts", "export default {};");
    const after = snapshot(root);
    expect(assessDrift(before, after).source).toEqual([".claude/settings.json", "next.config.ts"]);
    expect(assessDrift(before, after).missing).toEqual(["harness", "product"]);
  });

  it("treats art folder guidance as documentation and accepts it for art impact", () => {
    const root = fixture();
    const before = snapshot(root);
    write(root, "art-src/AGENTS.md", "Use frozen run inputs.");
    write(root, "art-src/README.md", "Folder routing.");
    const docsOnly = snapshot(root);
    expect(assessDrift(before, docsOnly).source).toEqual([]);
    write(root, "scripts/ambient-example.mjs", "// documented art change");
    const withArt = snapshot(root);
    expect(assessDrift(before, withArt).source).toEqual(["scripts/ambient-example.mjs"]);
    expect(assessDrift(before, withArt).missing).toEqual([]);
  });

  it("binds a documentation-impact explanation to the exact source changes", () => {
    const before = { files: { "scripts/ambient-example.mjs": "old" } };
    const after = { files: { "scripts/ambient-example.mjs": "typo-fix" } };
    const acknowledgement = { digest: assessDrift(before, after).digest, reason: "Comment typo only; behavior and documented contracts unchanged." };
    expect(assessDrift(before, after, acknowledgement).acknowledged).toBe(true);
    expect(assessDrift(before, { files: { "scripts/ambient-example.mjs": "new-behavior" } }, acknowledgement).missing).toEqual(["ambient"]);
  });

  it("runs SessionStart and Stop through real stdin and does not reuse prior-turn evidence", () => {
    const root = fixture();
    for (const file of ["memory.mjs", "session-brief.mjs", "state-drift-check.mjs"]) {
      const destination = join(root, "scripts/agent-harness", file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve("scripts/agent-harness", file), destination);
    }
    const run = (file: string, args: string[] = []) => spawnSync(process.execPath, [join(root, "scripts/agent-harness", file), ...args], {
      cwd: root, input: JSON.stringify({ session_id: "test-session" }), encoding: "utf8"
    });
    expect(run("session-brief.mjs").status).toBe(0);
    write(root, "scripts/ambient-example.mjs", "// turn one");
    write(root, "docs/ambient/QA_PROGRESS.md", "Turn one documented.");
    expect(run("state-drift-check.mjs").stdout).toBe("");
    write(root, "scripts/ambient-example.mjs", "// turn two");
    const pending = run("state-drift-check.mjs");
    expect(pending.status).toBe(0); // semantic drift remains advisory
    expect(pending.stdout).toContain("impact review needed: ambient");
    expect(run("state-drift-check.mjs", ["--ack-none", "Only a comment changed."]).status).toBe(0);
    expect(run("state-drift-check.mjs").stdout).toBe("");
  });
});
