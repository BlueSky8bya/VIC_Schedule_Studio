import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const migration = await import(path.resolve("scripts/agent-harness/rule-migration.mjs").replaceAll("\\", "/"));
const temporary: string[] = [];
const original = "Protect public boundary\nKeep palette\nFixed camera size 12\nRetired feature\n";
const sha = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const sourceContract = { lines: 4, bytes: Buffer.byteLength(original), sha256: sha(original) };
const validate = (root: string) => migration.validateRuleMigration(root, { sourceContract });
function write(root: string, file: string, value: string) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}
const rows = () => [
  { start: 1, end: 1, kind: "rule", targets: ["G-01"], summary: "Public boundary", reason: "Existing common server rule" },
  { start: 2, end: 2, kind: "rule", targets: ["UI-01"], summary: "Palette", reason: "Existing domain rule" },
  { start: 3, end: 3, kind: "code", targets: ["camera.ts:SIZE"], summary: "Size", reason: "Code owns the current accepted value" },
  { start: 4, end: 4, kind: "retired", targets: [], summary: "Retired feature", reason: "Owner explicitly retired this feature; source remains in history" }
];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vic-rule-migration-"));
  temporary.push(root);
  write(root, migration.SOURCE, `Source UTF-8 bytes: ${Buffer.byteLength(original)}\nSource SHA-256: ${sha(original)}\n\n\`\`\`\`markdown\n${original}\`\`\`\`\n`);
  for (const [file, rule] of [["AGENTS.md", "G-01"], ["docs/ux/UI_RULES.md", "UI-01"], ["docs/ambient/ENGINE_RULES.md", "AMB-01"], ["docs/ambient/ART_RULES.md", "ART-01"]]) write(root, file, `- ${rule}: Current rule\n`);
  write(root, "camera.ts", "export const SIZE = 12;\n");
  const inventory = migration.collectRuleInventory(root);
  const render = (values = rows()) => `# Rule migration\nSource SHA-256: ${sha(original)}\nSource lines: 4\n\n${migration.renderMigrationTable(values)}\n\n${migration.renderRuleInventory(inventory)}\n`;
  write(root, migration.MIGRATION, render());
  return { root, render };
}
afterEach(() => {
  for (const root of temporary.splice(0)) {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("vic-rule-migration-")) throw new Error("Unsafe fixture cleanup");
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("rule migration traceability", () => {
  it("checks complete source coverage, rule inventory and live code destinations", () => {
    const { root } = fixture();
    expect(validate(root)).toEqual({ errors: [], sourceLines: 4, mappedRows: 4, activeRules: 4 });
  });

  it("rejects missing or overlapping source lines even when the source hash is unchanged", () => {
    const { root, render } = fixture();
    write(root, migration.MIGRATION, render(rows().slice(1)));
    expect(validate(root).errors.join(" ")).toContain("Unmapped original lines: 1");
    write(root, migration.MIGRATION, render([...rows(), rows()[0]]));
    expect(validate(root).errors.join(" ")).toContain("Multiply mapped original lines: 1");
  });

  it("invalidates the mapping when active IDs are added or removed", () => {
    const { root } = fixture();
    fs.appendFileSync(path.join(root, "docs/ux/UI_RULES.md"), "- UI-02: New rule\n");
    expect(validate(root).errors.join(" ")).toContain("Active rule IDs changed");
    write(root, "docs/ux/UI_RULES.md", "- UI-02: Replacement rule\n");
    expect(validate(root).errors.join(" ")).toContain("Unknown rule ID UI-01");
  });

  it("rejects altered originals, missing symbols and targets outside the workspace", () => {
    const { root, render } = fixture();
    write(root, "camera.ts", "export const OTHER = 12;\n");
    expect(validate(root).errors.join(" ")).toContain("Missing code target camera.ts:SIZE");
    const escaped = rows(); escaped[2].targets = ["../outside.ts:SIZE"];
    write(root, migration.MIGRATION, render(escaped));
    expect(validate(root).errors.join(" ")).toContain("leaves workspace");
    const source = path.join(root, migration.SOURCE);
    fs.writeFileSync(source, fs.readFileSync(source, "utf8").replace("Fixed camera", "Wrong camera"));
    expect(validate(root).errors.join(" ")).toContain("snapshot hash mismatch");
  });

  it("requires a retirement reason and rejects an invented inventory table", () => {
    const { root, render } = fixture();
    const values = rows(); values[3].reason = "";
    write(root, migration.MIGRATION, render(values));
    expect(validate(root).errors.join(" ")).toContain("retirement reason");
    write(root, migration.MIGRATION, render().replace("| UI-01 | docs/ux/UI_RULES.md |", "| UI-99 | docs/ux/UI_RULES.md |"));
    expect(validate(root).errors.join(" ")).toContain("inventory table differs");
  });

  it("does not count fenced examples or HTML comments as active rules", () => {
    const { root } = fixture();
    const historical = "```markdown\n- UI-01: Historical copy\n- **UI-02**: Example syntax\n```\n<!--\n- UI-01: Hidden copy\n- UI-03: Hidden rule\n-->\n";
    fs.appendFileSync(path.join(root, "docs/ux/UI_RULES.md"), historical);
    expect(validate(root).errors).toEqual([]);
    write(root, "docs/ux/UI_RULES.md", historical);
    expect(validate(root).errors.join(" ")).toContain("Unknown rule ID UI-01");
  });

  it.each([
    "<!--\n```markdown\n-->\n",
    "```markdown\n<!--\n```\n",
    "```markdown\n```still-an-example\n- UI-99: Historical example\n```\n"
  ])("keeps comment and fence syntax from hiding following active declarations: %s", (historical) => {
    const { root } = fixture();
    fs.appendFileSync(path.join(root, "docs/ux/UI_RULES.md"), historical);
    expect(validate(root).errors).toEqual([]);
    fs.appendFileSync(path.join(root, "docs/ux/UI_RULES.md"), "- UI-02: New active rule\n");
    expect(validate(root).errors.join(" ")).toContain("Active rule IDs changed");
  });

  it.each([
    "- **UI-02**: New rule",
    "- `UI-02`: New rule",
    "  - UI-02: New rule",
    "## UI-02: New rule",
    "- UI-02: "
  ])("rejects a noncanonical ID declaration instead of silently omitting it: %s", (declaration) => {
    const { root } = fixture();
    fs.appendFileSync(path.join(root, "docs/ux/UI_RULES.md"), declaration + "\n");
    expect(validate(root).errors.join(" ")).toContain("Noncanonical active rule declaration");
  });

  it.each([
    "export const OTHER_SIZE = 12;",
    "// SIZE retired\nexport const OTHER = 12;",
    "/* SIZE */ export const OTHER = 12;",
    'export const note = "SIZE";',
    "export const note = `SIZE`;",
    "export const note = /SIZE/;"
  ])("rejects a deleted symbol retained only in incidental source text: %s", (content) => {
    const { root } = fixture();
    write(root, "camera.ts", content);
    expect(validate(root).errors.join(" ")).toContain("Missing code target camera.ts:SIZE");
  });

  it("distinguishes executable TSX identifiers from JSX text and attribute strings", () => {
    const { root, render } = fixture();
    const values = rows(); values[2].targets = ["camera.tsx:SIZE"];
    write(root, migration.MIGRATION, render(values));
    write(root, "camera.tsx", 'export const view = <span title="SIZE">SIZE</span>;');
    expect(validate(root).errors.join(" ")).toContain("Missing code target camera.tsx:SIZE");
    write(root, "camera.tsx", "export const view = <span>{SIZE}</span>;");
    expect(validate(root).errors).toEqual([]);
  });

  it("matches compound code targets as a property path with exact identifiers", () => {
    const { root, render } = fixture();
    const values = rows(); values[2].targets = ["args.mjs:process.argv"];
    write(root, migration.MIGRATION, render(values));
    write(root, "args.mjs", 'const note = "process.argv"; process.argv2; process; argv;');
    expect(validate(root).errors.join(" ")).toContain("Missing code target args.mjs:process.argv");
    write(root, "args.mjs", "const args = process /* intentional spacing */ . argv;");
    expect(validate(root).errors).toEqual([]);
  });

  it("checks actual JSON keys and plain top-level YAML keys instead of value substrings", () => {
    const { root, render } = fixture();
    const values = rows(); values[2].targets = ["package.json:harness:verify", "agent-harness.yaml:protocol_source"];
    write(root, migration.MIGRATION, render(values));
    write(root, "package.json", JSON.stringify({ scripts: { other: "harness:verify" } }));
    write(root, "agent-harness.yaml", "# protocol_source: old.md\nreview_protocol_source: new.md\nnested:\n  protocol_source: old.md\nnote: protocol_source\n");
    const errors = validate(root).errors.join(" ");
    expect(errors).toContain("Missing code target package.json:harness:verify");
    expect(errors).toContain("Missing code target agent-harness.yaml:protocol_source");
    write(root, "package.json", JSON.stringify({ scripts: { "harness:verify": "node check.mjs" } }));
    write(root, "agent-harness.yaml", 'protocol_source: "original.md" # provenance\n');
    expect(validate(root).errors).toEqual([]);
  });

  it("requires the classification's primary target while allowing mixed supporting evidence", () => {
    const { root, render } = fixture();
    const values = rows();
    values[0].targets = ["G-01", "camera.ts:SIZE"];
    values[2].targets = ["camera.ts:SIZE", "UI-01"];
    write(root, migration.MIGRATION, render(values));
    expect(validate(root).errors).toEqual([]);
    values[0].targets = ["camera.ts:SIZE"];
    values[2].targets = ["UI-01"];
    write(root, migration.MIGRATION, render(values));
    const errors = validate(root).errors.join(" ");
    expect(errors).toContain("Rule row requires an active rule ID: 1-1");
    expect(errors).toContain("Code row requires a file:symbol target: 3-3");
  });

  it("pins the original independently of mutually rewritten source and migration metadata", () => {
    const { root } = fixture();
    expect(migration.validateRuleMigration(root).errors.join(" ")).toContain("pinned source contract");
    expect(validate(root).errors).toEqual([]);
    const replacement = original.replace("Fixed", "Other");
    const source = path.join(root, migration.SOURCE);
    fs.writeFileSync(source, fs.readFileSync(source, "utf8").replace(original, replacement).replace(sha(original), sha(replacement)));
    const table = path.join(root, migration.MIGRATION);
    fs.writeFileSync(table, fs.readFileSync(table, "utf8").replace(sha(original), sha(replacement)));
    expect(validate(root).errors.join(" ")).toContain("pinned source contract");
  });
});
