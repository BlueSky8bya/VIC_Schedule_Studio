import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readGitHead, resolveBuildCommit } from "@/scripts/build-commit";

const vercel = "a".repeat(40), explicit = "b".repeat(40), github = "c".repeat(40), local = "d".repeat(40);

describe("build revision metadata", () => {
  it("keeps Vercel's deployed revision ahead of explicit, CI and local metadata", () => {
    const readHead = vi.fn(() => local);
    expect(resolveBuildCommit({ VERCEL_GIT_COMMIT_SHA: vercel, APP_COMMIT: explicit, GITHUB_SHA: github }, readHead)).toBe(vercel);
    expect(readHead).not.toHaveBeenCalled();
  });

  it("accepts an explicit source-archive revision before GitHub or local HEAD", () => {
    const readHead = vi.fn(() => local);
    expect(resolveBuildCommit({ VERCEL_GIT_COMMIT_SHA: " ", APP_COMMIT: ` ${explicit.toUpperCase()}\n`, GITHUB_SHA: github }, readHead)).toBe(explicit);
    expect(readHead).not.toHaveBeenCalled();
  });

  it("uses GitHub's checked-out revision when higher-priority values are invalid", () => {
    const readHead = vi.fn(() => local);
    expect(resolveBuildCommit({ VERCEL_GIT_COMMIT_SHA: "dev", APP_COMMIT: "release-tag", GITHUB_SHA: github }, readHead)).toBe(github);
    expect(readHead).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "  ", "dev", "35dd86a", "not-a-commit", "g".repeat(40), "a".repeat(41)])("falls back to one Git HEAD read for unavailable or invalid metadata: %j", value => {
    const readHead = vi.fn(() => local);
    expect(resolveBuildCommit({ VERCEL_GIT_COMMIT_SHA: value, APP_COMMIT: value, GITHUB_SHA: value }, readHead)).toBe(local);
    expect(readHead).toHaveBeenCalledTimes(1);
  });

  it("supports a full SHA-256 Git object ID without truncating metadata", () => {
    expect(resolveBuildCommit({ APP_COMMIT: "e".repeat(64) }, () => undefined)).toBe("e".repeat(64));
  });

  it("retains the archive sentinel when no valid source revision is available", () => {
    expect(resolveBuildCommit({}, () => undefined)).toBe("dev");
    expect(resolveBuildCommit({}, () => "HEAD")).toBe("dev");
    expect(resolveBuildCommit({}, () => { throw new Error("Git unavailable"); })).toBe("dev");
  });
});

describe("local Git revision fallback", () => {
  let directory: string;
  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "vic-build-commit-"));
    execFileSync("git", ["init", "-q", directory], { stdio: "ignore", windowsHide: true, timeout: 4000 });
    execFileSync("git", ["-c", "core.hooksPath=", "-c", "commit.gpgsign=false", "-c", "user.name=Build fixture", "-c", "user.email=build-fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture"], { cwd: directory, stdio: "ignore", windowsHide: true, timeout: 4000 });
  });
  afterAll(() => {
    if (!directory) return;
    // Only remove the uniquely created fixture directory in the OS temp root.
    expect(dirname(resolve(directory))).toBe(resolve(tmpdir()));
    expect(directory.startsWith(join(tmpdir(), "vic-build-commit-"))).toBe(true);
    rmSync(directory, { recursive: true, force: true });
  });

  it("resolves an actual local checkout without any hosting environment variables", () => {
    const head = readGitHead(directory);
    expect(head).toMatch(/^(?:[a-f\d]{40}|[a-f\d]{64})$/);
    expect(resolveBuildCommit({}, () => readGitHead(directory))).toBe(head);
  });

  it("fails quietly for an unavailable Git working directory", () => {
    expect(readGitHead(join(directory, "missing-working-directory"))).toBeUndefined();
  });
});
