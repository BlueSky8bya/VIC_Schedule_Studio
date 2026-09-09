#!/usr/bin/env node
// Claude SessionStart adapter. Standalone invocation only renders the bounded brief.
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hookInput, hookSession, renderBrief, saveSession, sessionFile, snapshot } from "./memory.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
try {
  const input = await hookInput();
  const id = hookSession(process.argv.slice(2), input);
  const brief = renderBrief(root, { baseline: !!id });
  if (id) {
    const file = sessionFile(root, id);
    // Resume/compaction must not erase work since the last checked turn.
    if (!existsSync(file)) saveSession(file, { baseline: snapshot(root) });
  }
  process.stdout.write(brief);
} catch (error) {
  console.error("Repository briefing failed: " + error.message);
  process.exitCode = 1;
}
