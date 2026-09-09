import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, relative, sep } from "node:path";

export const STATE = "docs/agent/CURRENT_STATE.md";
export const STATE_SECTIONS = ["Current Objective", "Active Work", "Blockers", "Next Exact Steps", "Last Verified"];
const CLOSED = /^(completed|closed|resolved|superseded|deprecated|cancelled|canceled|done|완료|해결|철회)(?=$|[\s(/:;,—–-])/i;
const SOURCE = /^(app\/|components\/|lib\/|db\/migrations\/|scripts\/|tests\/|public\/|art-src\/|\.claude\/|\.github\/workflows\/|package(?:-lock)?\.json$|agent-harness\.yaml$|(?:next|eslint|postcss|tailwind|vitest|playwright)(?:[.-][^/]+)?\.(?:[cm]?[jt]s|json)$|tsconfig(?:\.[^/]+)?\.json$|middleware\.[jt]s$|next-env\.d\.ts$)/;
const DOC = /^(docs\/|AGENTS\.md$|CLAUDE\.md$|(?:app|components|lib|tests|scripts|art-src)\/.*(?:README|AGENTS)\.md$)/;
export const read = (root, file) => readFileSync(resolve(root, file), "utf8");
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function withoutFences(body) {
  let fence = null;
  return body.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s{0,3}(\x60{3,}|~{3,})/);
    if (fence) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && /^[ \t]*$/.test(line.slice(match[0].length))) fence = null;
      return "";
    }
    if (match) { fence = match[1]; return ""; }
    return line;
  }).join("\n");
}

export function sections(body) {
  const result = new Map();
  let key = null;
  for (const line of withoutFences(body).split("\n")) {
    const title = line.match(/^## (.+?)\s*$/)?.[1];
    if (title) {
      key = title;
      if (!result.has(key)) result.set(key, []);
      result.get(key).push([]);
    } else if (key) {
      const occurrences = result.get(key);
      occurrences[occurrences.length - 1].push(line);
    }
  }
  return result;
}

export function limits(root) {
  const config = read(root, "agent-harness.yaml");
  const number = (key, fallback) => {
    const raw = config.match(new RegExp("^\\s+" + key + ":\\s*(\\d+)\\s*(?:#.*)?$", "m"))?.[1];
    return raw ? Number(raw) : fallback;
  };
  return {
    files: {
      "AGENTS.md": number("agents_max_bytes", 6144),
      "CLAUDE.md": number("claude_max_bytes", 1024),
      [STATE]: number("current_state_max_bytes", 8192),
      "docs/agent/plans/ACTIVE_PLAN.md": number("active_plan_max_bytes", 4096)
    },
    brief: number("brief_max_bytes", 8192),
    always: number("always_loaded_max_bytes", 16384)
  };
}

export function markdownLinks(body) {
  return [...withoutFences(body).matchAll(/\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)]
    .map((m) => (m[1] ?? m[2]).split("#")[0])
    .filter((p) => p && !/^(?:[a-z]+:|\/)/i.test(p));
}

function activeRows(body) {
  return withoutFences(body).split(/\r?\n/).filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells[0] && cells[0] !== "ID" && !/^[-: ]+$/.test(cells[0]));
}

export function validateMemory(root) {
  const errors = [];
  const budget = limits(root);
  for (const [file, max] of Object.entries(budget.files)) {
    if (!existsSync(resolve(root, file))) { errors.push("Missing current-memory file: " + file); continue; }
    const bytes = Buffer.byteLength(read(root, file));
    if (bytes > max) errors.push(file + ": " + bytes + " bytes exceeds " + max + "; move history/detail, do not truncate.");
  }
  if (!existsSync(resolve(root, STATE))) return errors;
  const state = sections(read(root, STATE));
  for (const key of STATE_SECTIONS) {
    if (state.get(key)?.length !== 1) errors.push(STATE + ": expected exactly one '" + key + "' section.");
  }
  for (const key of state.keys()) {
    if (!STATE_SECTIONS.includes(key)) errors.push(STATE + ": unexpected current section '" + key + "'; route history/detail.");
  }
  const currentWork = state.get("Active Work")?.[0]?.join("\n") ?? "";
  const indexes = [[STATE, currentWork]];
  const plan = "docs/agent/plans/ACTIVE_PLAN.md";
  if (existsSync(resolve(root, plan))) indexes.push([plan, read(root, plan)]);
  for (const [file, body] of indexes) {
    const ids = new Set();
    for (const cells of activeRows(body)) {
      if (ids.has(cells[0])) errors.push(file + ": duplicate active ID " + cells[0]);
      ids.add(cells[0]);
      if (CLOSED.test(cells[1] ?? "")) errors.push(file + ": closed work must leave active index: " + cells[0]);
      for (const link of markdownLinks(cells.join(" | "))) {
        if (!link.endsWith(".md")) continue;
        const target = resolve(root, dirname(file), link);
        if (!existsSync(target)) continue;
        const status = withoutFences(readFileSync(target, "utf8")).match(/^Status:\s*(.+)$/m)?.[1]?.trim();
        if (status && CLOSED.test(status)) errors.push(file + ": active work points to " + status + " record " + link);
      }
    }
  }
  const next = state.get("Next Exact Steps")?.[0]?.join("\n") ?? "";
  const activeIds = new Set(activeRows(currentWork).map((cells) => cells[0]));
  // IDs belong in the leading action label; prose can cite SHA-256, UTF-8 or historical ADRs.
  for (const action of next.matchAll(/^\s*(?:\d+[.)]|[-*])\s+([^:\n]+):/gm)) {
    for (const id of new Set(action[1].match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g) ?? [])) {
      if (!activeIds.has(id)) errors.push(STATE + ": next action references inactive ID " + id);
    }
  }
  for (const link of markdownLinks(next)) {
    const target = resolve(root, dirname(STATE), link);
    if (!link.endsWith(".md") || !existsSync(target)) continue;
    const status = withoutFences(readFileSync(target, "utf8")).match(/^Status:\s*(.+)$/m)?.[1]?.trim();
    if (status && CLOSED.test(status)) errors.push(STATE + ": next action points to closed record " + link);
  }
  return errors;
}

export function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
}

export function renderBrief(root, context = {}) {
  const errors = validateMemory(root);
  if (errors.length) throw new Error(errors.join("\n"));
  let revision = "unavailable";
  let changed = [];
  try {
    revision = git(root, ["rev-parse", "--short", "HEAD"]).trim();
    changed = git(root, ["status", "--short"]).trim().split(/\r?\n/).filter(Boolean);
  } catch { /* non-git fixture; state remains readable */ }
  const body = [
    "## Repository briefing",
    "Revision: " + revision + "; working-tree entries: " + changed.length,
    "Sources: AGENTS.md; " + STATE + " (sha256 " + sha256(read(root, STATE)) + ")",
    "",
    read(root, STATE).trim(),
    "",
    "Routing: docs/agent/PROJECT_MAP.md → relevant domain rules. Decisions: docs/agent/decisions/DECISION_INDEX.md → relevant ADR only.",
    "Current plan index: docs/agent/plans/ACTIVE_PLAN.md. Historical snapshots are not current instructions.",
    context.baseline ? "Session baseline: recorded for this session." : "Session baseline: unavailable; standalone brief does not infer session changes.",
    ""
  ].join("\n");
  const budget = limits(root);
  const bytes = Buffer.byteLength(body);
  const ruleFiles = existsSync(resolve(root, ".claude/rules")) ? markdownFiles(root, ".claude/rules") : [];
  const ruleBytes = ruleFiles.reduce((sum, file) => sum + Buffer.byteLength(read(root, file)), 0);
  const total = bytes + Buffer.byteLength(read(root, "AGENTS.md")) + Buffer.byteLength(read(root, "CLAUDE.md")) + ruleBytes;
  if (bytes > budget.brief || total > budget.always) {
    throw new Error("Brief budget exceeded: " + bytes + "/" + budget.brief + "; always-loaded " + total + "/" + budget.always + " bytes. Split current content; nothing was truncated.");
  }
  return body;
}

export function snapshot(root) {
  const files = {};
  const paths = new Set(git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean));
  for (const path of [...paths].sort()) {
    if ((!SOURCE.test(path) && !DOC.test(path)) || path.startsWith("docs/agent/archive/")) continue;
    try { files[path] = sha256(readFileSync(resolve(root, path))); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return { schemaVersion: 1, capturedAt: new Date().toISOString(), head: git(root, ["rev-parse", "HEAD"]).trim(), files };
}

export function changedPaths(before, after) {
  return [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])]
    .filter((p) => before.files[p] !== after.files[p]).sort();
}

const DOMAINS = [
  { name: "harness", source: /^(scripts\/agent-harness\/|agent-harness\.yaml$|\.claude\/)/, docs: /^(AGENTS\.md$|CLAUDE\.md$|docs\/agent\/(?:plans\/(?!ACTIVE_PLAN)|handoffs\/|decisions\/|DEFINITION_OF_DONE)|docs\/harness\.md$)/ },
  { name: "ambient", source: /^(components\/shared\/ambient\/|scripts\/ambient-|scripts\/lib\/ambient-|public\/ambient\/art\/|art-src\/)/, docs: /^(?:art-src\/(?:.*\/)?(?:README|AGENTS)\.md$|docs\/(?:ambient\/|ux\/ambient-art-brief\.md$|agent\/(?:plans\/(?!ACTIVE_PLAN)|handoffs\/|decisions\/)))/ },
  { name: "security", source: /^(app\/api\/public\/|lib\/(?:permissions|auth|private-layer|schedules)\/|db\/migrations\/)/, docs: /^docs\/(?:security-boundary\.md$|architecture\.md$|agent\/(?:domain-rules\/|plans\/(?!ACTIVE_PLAN)|handoffs\/|decisions\/))/ },
  { name: "product", source: SOURCE, docs: /^docs\/(?:ux\/|tags\/|insights\/|product\/|deployment\.md$|architecture\.md$|agent\/(?:plans\/(?!ACTIVE_PLAN)|handoffs\/|decisions\/))/ }
];

export function assessDrift(before, after, acknowledgement = null) {
  const changed = changedPaths(before, after);
  const source = changed.filter((p) => SOURCE.test(p) && !DOC.test(p));
  const digest = sha256(JSON.stringify(source.map((p) => [p, after.files[p] ?? null])));
  if (acknowledgement?.digest === digest && acknowledgement.reason?.trim()) return { source, missing: [], digest, acknowledged: true };
  const missing = new Set();
  for (const path of source) {
    const domain = DOMAINS.find((entry) => entry.source.test(path));
    if (domain && !changed.some((p) => domain.docs.test(p) && after.files[p])) missing.add(domain.name);
  }
  return { source, missing: [...missing], digest, acknowledged: false };
}

export function sessionFile(root, id) {
  const gitPath = git(root, ["rev-parse", "--git-path", "agent-harness/sessions"]).trim();
  return resolve(root, gitPath, sha256(id) + ".json");
}

export function saveSession(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function hookSession(args, input) {
  const i = args.indexOf("--session");
  const id = i >= 0 ? args[i + 1] : input?.session_id;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function hookInput() {
  if (process.stdin.isTTY) return {};
  let body = "";
  for await (const chunk of process.stdin) body += chunk.toString();
  if (!body.trim()) return {};
  try { return JSON.parse(body); } catch { return {}; }
}

export function markdownFiles(root, directory) {
  const result = [];
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    const file = relative(root, resolve(root, directory, entry.name)).split(sep).join("/");
    if (entry.isDirectory()) {
      if (file !== "docs/agent/archive") result.push(...markdownFiles(root, file));
    } else if (entry.name.endsWith(".md")) result.push(file);
  }
  return result;
}
