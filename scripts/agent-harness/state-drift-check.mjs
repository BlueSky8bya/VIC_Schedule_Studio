#!/usr/bin/env node
// Advisory semantic check, not proof that documentation is correct or that a hook ran.
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assessDrift, hookInput, hookSession, saveSession, sessionFile, snapshot } from "./memory.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
try {
  const input = await hookInput();
  const id = hookSession(args, input);
  if (!id || !existsSync(sessionFile(root, id))) {
    console.log("Documentation drift NOT CHECKED: no session baseline. SessionStart must receive session_id (or --session ID). Today's commits are not a substitute.");
  } else {
    const file = sessionFile(root, id);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    const current = snapshot(root);
    const result = assessDrift(saved.baseline, current, saved.acknowledgement);
    const ackAt = args.indexOf("--ack-none");
    if (ackAt >= 0) {
      const reason = args[ackAt + 1]?.trim();
      if (!reason || reason.startsWith("--")) throw new Error("--ack-none requires a documentation-impact explanation.");
      saveSession(file, { ...saved, acknowledgement: { digest: result.digest, reason, recordedAt: new Date().toISOString() } });
      console.log("Documentation impact recorded for the exact current changes: " + reason);
    } else if (result.missing.length) {
      console.log("Documentation impact review needed: " + result.missing.join(", ") + ".");
      console.log("Source changes: " + result.source.join(", "));
      console.log("Update the relevant domain record when behavior/decisions changed. Routine edits need no CURRENT_STATE paragraph; record --session ID --ack-none \"reason\" when documentation has no impact.");
    } else {
      saveSession(file, { baseline: current });
    }
  }
} catch (error) {
  console.error("Documentation drift NOT CHECKED: " + error.message);
  process.exitCode = 1;
}
