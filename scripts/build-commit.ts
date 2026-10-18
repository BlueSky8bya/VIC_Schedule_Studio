import { execFileSync } from "node:child_process";

function validCommit(value: string | undefined): string | undefined {
  const commit = value?.trim();
  // Preserve a full object ID for server/client comparisons; shorten only
  // where it is displayed. Accept Git's SHA-1 and SHA-256 repository formats.
  return commit && /^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(commit) ? commit.toLowerCase() : undefined;
}

/** Configuration-time only: no shell, network, runtime polling or DB access. */
export function readGitHead(cwd = process.cwd()): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd,
      encoding: "utf8",
      timeout: 1500,
      maxBuffer: 1024,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    }).trim();
  } catch {
    // A source archive may have neither Git nor provider revision metadata.
    return undefined;
  }
}

/** Select the revision once while Next loads its build configuration. */
export function resolveBuildCommit(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  readHead: () => string | undefined = readGitHead
): string {
  for (const candidate of [environment.VERCEL_GIT_COMMIT_SHA, environment.APP_COMMIT, environment.GITHUB_SHA]) {
    const commit = validCommit(candidate);
    if (commit) return commit;
  }
  try {
    return validCommit(readHead()) ?? "dev";
  } catch {
    return "dev";
  }
}
