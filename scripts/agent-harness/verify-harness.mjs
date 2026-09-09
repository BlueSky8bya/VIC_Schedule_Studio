#!/usr/bin/env node
// Structural/current-memory contracts. Semantic policy and visual judgement still need review.
import { existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { markdownFiles, markdownLinks, read, renderBrief, validateMemory, withoutFences } from "./memory.mjs";
import { syncCatalog } from "../ambient-art-catalog.mjs";
import { validateRuleMigration } from "./rule-migration.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
errors.push(...validateRuleMigration(root).errors);
const required = [
  "agent-harness.yaml", "CLAUDE.md", "AGENTS.md", "docs/agent/CONSTITUTION.md",
  "docs/agent/CURRENT_STATE.md", "docs/agent/PROJECT_MAP.md", "docs/agent/RISK_PROFILE.md",
  "docs/agent/DEFINITION_OF_DONE.md", "docs/agent/CHANGELOG_AGENT.md",
  "docs/agent/decisions/DECISION_INDEX.md", "docs/agent/plans/ACTIVE_PLAN.md"
];
for (const file of required) if (!existsSync(resolve(root, file))) errors.push("Missing required file: " + file);

if (existsSync(resolve(root, "agent-harness.yaml"))) {
  const config = read(root, "agent-harness.yaml");
  const entrypoints = config.split(/^entrypoints:/m)[1]?.split(/^\w/m)[0] ?? "";
  for (const match of entrypoints.matchAll(/^\s+\w+:\s*"([^"]+)"/gm)) {
    if (!existsSync(resolve(root, match[1]))) errors.push("Missing entrypoint: " + match[1]);
  }
  if (!/^protocol_source:/m.test(config)) errors.push("Missing protocol provenance.");
}

const extra = ["AGENTS.md", "CLAUDE.md", "art-src/AGENTS.md", "art-src/README.md", "art-src/reference/README.md",
  "docs/README.md", "docs/harness.md", "docs/ux/README.md", "docs/ux/UI_RULES.md",
  "docs/ambient/README.md", "docs/ambient/ART_RULES.md", "docs/ambient/ENGINE_RULES.md", "docs/ambient/ART_PIPELINE.md",
  "docs/ambient/reference/README.md", "docs/ambient/HANDOFF-20260908-pine.md", "docs/ambient/prompts/20260909-pine21-r4.md"];
const documents = [...new Set([...markdownFiles(root, "docs/agent"), ...extra])]
  .filter((file) => existsSync(resolve(root, file)));
for (const file of documents) {
  for (const link of markdownLinks(read(root, file))) {
    if (!link.endsWith(".md")) continue;
    if (!existsSync(resolve(root, dirname(file), link))) errors.push("Broken link: " + file + " → " + link);
  }
}

const directory = "docs/agent/decisions";
const index = read(root, directory + "/DECISION_INDEX.md");
const valid = new Set(["Proposed", "Accepted", "Deprecated", "Superseded"]);
for (const file of readdirSync(resolve(root, directory)).filter((name) => /^ADR-\d{4}.*\.md$/.test(name))) {
  const status = withoutFences(read(root, directory + "/" + file)).match(/^Status:\s*(\w+)/m)?.[1];
  const row = index.split(/\r?\n/).find((line) => line.includes("(" + file + ")"));
  const indexedStatus = row?.split("|")[2]?.trim().match(/^\w+/)?.[0];
  if (!valid.has(status)) errors.push("Invalid ADR status: " + file + " (" + status + ")");
  if (!row) errors.push("Unindexed ADR: " + file);
  else if (indexedStatus !== status) errors.push("ADR/index status mismatch: " + file + " (" + status + " / " + indexedStatus + ")");
}

try {
  const catalog = syncCatalog({ workspaceRoot: root, check: true });
  if (catalog.status !== "pass") errors.push(`Art catalog drift: ${catalog.changes.length} stale, ${catalog.conflicts.length} edited generated documents; run npm run art:catalog`);
} catch (error) { errors.push(`Art catalog check: ${error.message}`); }

if (!errors.length) {
  errors.push(...validateMemory(root));
  if (!errors.length) {
    try {
      const brief = renderBrief(root);
      console.log("Brief: " + Buffer.byteLength(brief) + " UTF-8 bytes (no history/index body injected).");
    } catch (error) { errors.push(error.message); }
  }
}
if (errors.length) {
  console.error("Harness validation failed:\n" + errors.map((error) => "  - " + error).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Harness verified: " + documents.length + " documents; links, ADR statuses, active lifecycle and memory budgets.");
}
