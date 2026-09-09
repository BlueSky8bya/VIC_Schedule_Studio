// Traceability checks: source coverage and live destinations, not a proof of artistic equivalence.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { withoutFences } from "./memory.mjs";

export const RULE_FILES = ["AGENTS.md", "docs/ux/UI_RULES.md", "docs/ambient/ENGINE_RULES.md", "docs/ambient/ART_RULES.md"];
export const SOURCE = "docs/agent/archive/20260909-CLAUDE-before-memory-split.md";
export const MIGRATION = "docs/agent/RULE_MIGRATION.md";
// The dated original is immutable; fixture callers must opt into a different contract.
export const SOURCE_CONTRACT = Object.freeze({
  lines: 589,
  bytes: 59266,
  sha256: "61508ea7a2d4ee9bbd32935ed01f16384325a3b17514481a2c0639b21beb1e0a"
});
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const rulePattern = /^(?:- )?((?:G|UI|AMB|ART)-\d+):[ \t]*(\S.*)$/;
const ruleIdPattern = /^(?:G|UI|AMB|ART)-\d+$/;
const declarationPattern = /^[ \t]*(?:(?:[-+*]|\d+[.)]|#{1,6}|>)[ \t]+)*[*_`]*((?:G|UI|AMB|ART)-\d+)[*_`]*[ \t]*:/;

function local(root, file) {
  const absolute = path.resolve(root, file), relative = path.relative(path.resolve(root), absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Migration target leaves workspace: ${file}`);
  return absolute;
}

export function extractRuleSource(root, sourceContract = SOURCE_CONTRACT) {
  const bytes = fs.readFileSync(local(root, SOURCE)), header = bytes.toString("utf8");
  const length = Number(header.match(/^Source UTF-8 bytes: (\d+)/m)?.[1]);
  const expected = header.match(/^Source SHA-256: ([a-f0-9]{64})/m)?.[1];
  const marker = bytes.indexOf(Buffer.from("````markdown"));
  if (!length || !expected || marker < 0) throw new Error("Missing original rule snapshot metadata");
  const start = bytes.indexOf(10, marker) + 1;
  const original = bytes.subarray(start, start + length);
  if (original.length !== length || digest(original) !== expected) throw new Error("Original rule snapshot hash mismatch");
  const lines = original.toString("utf8").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (expected !== sourceContract.sha256 || length !== sourceContract.bytes || lines.length !== sourceContract.lines) {
    throw new Error("Original rule snapshot differs from pinned source contract");
  }
  return { sha256: expected, bytes: length, lines };
}

function withoutRuleComments(body) {
  let comment = false, fence = null;
  return body.split(/\r?\n/).map((line) => {
    const marker = line.match(/^[ \t]{0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^[ \t]*$/.test(marker[2])) fence = null;
      return line;
    }
    // A comment marker inside fenced examples is text, and a fence inside a comment is text.
    if (!comment && marker) { fence = marker[1]; return line; }
    let cursor = 0, visible = "";
    while (cursor < line.length) {
      if (comment) {
        const end = line.indexOf("-->", cursor), next = end < 0 ? line.length : end + 3;
        visible += " ".repeat(next - cursor);
        cursor = next;
        if (end >= 0) comment = false;
      } else {
        const start = line.indexOf("<!--", cursor);
        if (start < 0) { visible += line.slice(cursor); break; }
        visible += line.slice(cursor, start);
        cursor = start;
        comment = true;
      }
    }
    return visible;
  }).join("\n");
}

export function collectRuleInventory(root, files = RULE_FILES) {
  const rules = [];
  for (const file of files) {
    const content = withoutFences(withoutRuleComments(fs.readFileSync(local(root, file), "utf8")));
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      const match = line.match(rulePattern);
      if (match) rules.push({ id: match[1], file });
      else if (declarationPattern.test(line)) throw new Error(`Noncanonical active rule declaration at ${file}:${index + 1}; use - ID: rule text`);
    }
  }
  rules.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) throw new Error("Duplicate active rule ID");
  return { rules, sha256: digest(JSON.stringify(rules)) };
}

const cleanCell = (value) => String(value ?? "").replaceAll("|", "/").replace(/[\r\n]+/g, " ").trim();
const labels = { rule: "이관", code: "코드", retired: "의도적 삭제" };
export function renderMigrationTable(rows) {
  return ["<!-- rule-migration:coverage:start -->", "| 원문 줄 | 분류 | 대상 | 원문 내용 | 판단·이유 |", "|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.start}-${row.end} | ${labels[row.kind]} | ${row.targets?.length ? row.targets.map(cleanCell).join(", ") : "—"} | ${cleanCell(row.summary)} | ${cleanCell(row.reason)} |`),
    "<!-- rule-migration:coverage:end -->"].join("\n");
}
export function renderRuleInventory(inventory) {
  return [`Rule inventory SHA-256: ${inventory.sha256}`, "", "<!-- rule-migration:inventory:start -->", "| 규칙 ID | 현행 문서 |", "|---|---|",
    ...inventory.rules.map((rule) => `| ${rule.id} | ${rule.file} |`), "<!-- rule-migration:inventory:end -->"].join("\n");
}

function tableBlock(text, name) {
  const start = `<!-- rule-migration:${name}:start -->`, end = `<!-- rule-migration:${name}:end -->`;
  if (text.split(start).length !== 2 || text.split(end).length !== 2) throw new Error(`Missing or duplicate ${name} table`);
  return text.split(start)[1].split(end)[0].split(/\r?\n/).filter((line) => line.startsWith("|"));
}

function codeTargets(file, content) {
  const targets = new Set();
  if (file.endsWith(".json")) {
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (!Array.isArray(value)) targets.add(key);
        visit(child);
      }
    };
    visit(JSON.parse(content));
    return targets;
  }
  if (/\.ya?ml$/.test(file)) {
    // YAML targets deliberately name plain top-level keys, not nested values or comments.
    for (const line of content.split(/\r?\n/)) {
      const key = line.match(/^([A-Za-z_][\w-]*):(?:[ \t]|$)/)?.[1];
      if (key) targets.add(key);
    }
    return targets;
  }
  if (!/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)) throw new Error(`Unsupported code target file type: ${file}`);
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const propertyPath = (node) => {
    if (ts.isIdentifier(node)) return node.text;
    if (!ts.isPropertyAccessExpression(node)) return null;
    const parent = propertyPath(node.expression);
    return parent ? `${parent}.${node.name.text}` : null;
  };
  const visit = (node) => {
    // AST identifiers exclude comments, strings, regexes, JSX text and identifier substrings.
    if (ts.isIdentifier(node)) targets.add(node.text);
    if (ts.isPropertyAccessExpression(node)) {
      const compound = propertyPath(node);
      if (compound) targets.add(compound);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return targets;
}

export function validateRuleMigration(root, { sourceContract = SOURCE_CONTRACT } = {}) {
  const errors = [];
  try {
    const source = extractRuleSource(root, sourceContract), inventory = collectRuleInventory(root);
    const text = fs.readFileSync(local(root, MIGRATION), "utf8");
    if (text.match(/^Source SHA-256: ([a-f0-9]{64})$/m)?.[1] !== source.sha256) errors.push("RULE_MIGRATION source SHA-256 differs from original");
    if (Number(text.match(/^Source lines: (\d+)$/m)?.[1]) !== source.lines.length) errors.push("RULE_MIGRATION original line count differs");
    if (text.match(/^Rule inventory SHA-256: ([a-f0-9]{64})$/m)?.[1] !== inventory.sha256) errors.push("Active rule IDs changed; update RULE_MIGRATION inventory and mappings");
    const known = new Set(inventory.rules.map((rule) => rule.id)), covered = Array(source.lines.length).fill(0);
    const targetCache = new Map();
    const lines = tableBlock(text, "coverage").slice(2);
    for (const line of lines) {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const range = cells[0]?.match(/^(\d+)-(\d+)$/);
      if (cells.length !== 5 || !range || !Object.values(labels).includes(cells[1])) { errors.push(`Malformed rule coverage row: ${cells[0]}`); continue; }
      const start = Number(range[1]), end = Number(range[2]);
      if (start < 1 || end < start || end > source.lines.length) { errors.push(`Out-of-range rule source lines: ${cells[0]}`); continue; }
      for (let index = start - 1; index < end; index++) covered[index]++;
      if (!cells[3] || !cells[4] || cells[4] === "—") errors.push(`Missing source explanation/retirement reason: ${cells[0]}`);
      if (cells[1] === labels.retired) {
        if (cells[2] !== "—") errors.push(`Retired row must explain its replacement in the reason: ${cells[0]}`);
        continue;
      }
      const targets = cells[2].split(/,\s*/);
      if (!targets.length || targets[0] === "—") errors.push(`Missing live rule target: ${cells[0]}`);
      // Mixed supporting evidence is valid, but each classification needs its primary destination.
      if (cells[1] === labels.rule && !targets.some((target) => ruleIdPattern.test(target))) errors.push(`Rule row requires an active rule ID: ${cells[0]}`);
      if (cells[1] === labels.code && !targets.some((target) => /^[^:]+:.+/.test(target))) errors.push(`Code row requires a file:symbol target: ${cells[0]}`);
      for (const target of targets) {
        if (ruleIdPattern.test(target)) {
          if (!known.has(target)) errors.push(`Unknown rule ID ${target} at ${cells[0]}`);
        } else {
          const split = target.indexOf(":");
          if (split <= 0 || split === target.length - 1) { errors.push(`Invalid code target ${target} at ${cells[0]}`); continue; }
          const file = target.slice(0, split), symbol = target.slice(split + 1);
          const absolute = local(root, file);
          if (!targetCache.has(absolute)) {
            targetCache.set(absolute, fs.existsSync(absolute) && fs.statSync(absolute).isFile()
              ? codeTargets(file, fs.readFileSync(absolute, "utf8")) : new Set());
          }
          if (!targetCache.get(absolute).has(symbol)) errors.push(`Missing code target ${target} at ${cells[0]}`);
        }
      }
    }
    const gaps = covered.flatMap((count, index) => count === 0 ? [index + 1] : []);
    const overlaps = covered.flatMap((count, index) => count > 1 ? [index + 1] : []);
    if (gaps.length) errors.push(`Unmapped original lines: ${gaps.join(", ")}`);
    if (overlaps.length) errors.push(`Multiply mapped original lines: ${overlaps.join(", ")}`);
    const declared = tableBlock(text, "inventory").slice(2).map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return { id: cells[0], file: cells[1] };
    });
    if (JSON.stringify(declared) !== JSON.stringify(inventory.rules)) errors.push("RULE_MIGRATION inventory table differs from live rule IDs");
    return { errors, sourceLines: source.lines.length, mappedRows: lines.length, activeRules: inventory.rules.length };
  } catch (error) { return { errors: [...errors, error.message] }; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = validateRuleMigration(root);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
