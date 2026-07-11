#!/usr/bin/env node
/**
 * 하네스 구조 무결성 검사 — 코드 테스트가 아니라 '저장소 기억'이 썩지 않았는지 본다.
 *
 * 검사:
 *   1) 필수 문서 존재
 *   2) agent-harness.yaml의 entrypoints 경로가 실재
 *   3) 문서 안의 상대 링크(.md)가 실재
 *   4) ADR의 Status가 유효(Proposed/Accepted/Deprecated/Superseded)하고 DECISION_INDEX에 등재됨
 *   5) CURRENT_STATE가 30일 넘게 안 바뀌었으면 경고(썩음 감지)
 *
 * 실패(exit 1) = 하네스가 거짓말하고 있다는 뜻. 고치고 커밋해라.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const warns = [];
const rel = (p) => resolve(root, p);
const read = (p) => readFileSync(rel(p), "utf8");

// 1) 필수 문서
const REQUIRED = [
  "agent-harness.yaml",
  "CLAUDE.md",
  "AGENTS.md",
  "docs/agent/CONSTITUTION.md",
  "docs/agent/CURRENT_STATE.md",
  "docs/agent/PROJECT_MAP.md",
  "docs/agent/RISK_PROFILE.md",
  "docs/agent/DEFINITION_OF_DONE.md",
  "docs/agent/CHANGELOG_AGENT.md",
  "docs/agent/decisions/DECISION_INDEX.md",
  "docs/agent/plans/ACTIVE_PLAN.md"
];
for (const f of REQUIRED) {
  if (!existsSync(rel(f))) errors.push(`필수 문서 없음: ${f}`);
}

// 2) 매니페스트 entrypoints 경로
if (existsSync(rel("agent-harness.yaml"))) {
  const yaml = read("agent-harness.yaml");
  const block = yaml.split(/^entrypoints:/m)[1]?.split(/^\w/m)[0] ?? "";
  for (const m of block.matchAll(/^\s+\w+:\s*"([^"]+)"/gm)) {
    if (!existsSync(rel(m[1]))) errors.push(`agent-harness.yaml entrypoint 경로 없음: ${m[1]}`);
  }
  if (!/protocol_source:/.test(yaml)) errors.push("agent-harness.yaml에 protocol_source(provenance) 없음");
}

// 3) 문서 내 상대 .md 링크
const docFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(rel(dir))) {
    const p = join(dir, name);
    if (statSync(rel(p)).isDirectory()) walk(p);
    else if (name.endsWith(".md")) docFiles.push(p);
  }
};
walk("docs/agent");
for (const f of docFiles) {
  const body = read(f);
  for (const m of body.matchAll(/\]\((\.{0,2}[^):#\s]+\.md)(#[^)]*)?\)/g)) {
    const target = resolve(rel(dirname(f)), m[1]);
    if (!existsSync(target)) errors.push(`끊긴 링크: ${f} → ${m[1]}`);
  }
}

// 4) ADR 상태 + 인덱스 등재
const VALID = ["Proposed", "Accepted", "Deprecated", "Superseded"];
const adrDir = "docs/agent/decisions";
const index = existsSync(rel(`${adrDir}/DECISION_INDEX.md`)) ? read(`${adrDir}/DECISION_INDEX.md`) : "";
for (const name of readdirSync(rel(adrDir))) {
  if (!/^ADR-\d{4}/.test(name)) continue;
  const body = read(`${adrDir}/${name}`);
  const status = body.match(/^Status:\s*(\w+)/m)?.[1];
  if (!status || !VALID.includes(status)) errors.push(`ADR Status 이상: ${name} (${status ?? "없음"})`);
  if (!index.includes(name)) errors.push(`DECISION_INDEX에 미등재: ${name}`);
}

// 5) CURRENT_STATE 신선도
try {
  const last = execSync('git log -1 --format=%ct -- docs/agent/CURRENT_STATE.md', {
    cwd: root,
    encoding: "utf8"
  }).trim();
  if (last) {
    const days = (Date.now() / 1000 - Number(last)) / 86400;
    if (days > 30) warns.push(`CURRENT_STATE.md가 ${Math.floor(days)}일째 그대로다 — 현재 시제가 맞는지 확인해라.`);
  }
} catch {
  /* git 없음 */
}

for (const w of warns) console.log(`⚠ ${w}`);
if (errors.length) {
  console.error("✖ 하네스 검증 실패:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ 하네스 정상 (문서 ${docFiles.length}개, 링크·ADR·매니페스트 확인)`);
