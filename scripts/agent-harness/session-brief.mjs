#!/usr/bin/env node
/**
 * SessionStart 훅 — 새 세션(또는 새 에이전트)이 시작될 때 저장소의 '현재 시제'를 컨텍스트에 넣는다.
 *
 * 문서만 만들어 두면 아무도 안 읽는다(실제로 그랬다). 규칙을 문장으로 반복하는 대신 하네스로
 * 강제한다 — 이 스크립트의 출력은 세션 첫 컨텍스트에 그대로 주입된다.
 *
 * 넣는 것: CURRENT_STATE.md 전문 + ADR 인덱스 + 최근 커밋 5개. (그 이상은 토큰 낭비.)
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => (existsSync(resolve(root, p)) ? readFileSync(resolve(root, p), "utf8") : null);

const state = read("docs/agent/CURRENT_STATE.md");
const index = read("docs/agent/decisions/DECISION_INDEX.md");

let recent = "";
try {
  recent = execSync("git log --oneline -5", { cwd: root, encoding: "utf8" }).trim();
} catch {
  /* git 없음 — 무시 */
}

const out = [
  "## 저장소 기억(자동 주입) — 코드를 고치기 전에 읽는다",
  "",
  state ? state.trim() : "(docs/agent/CURRENT_STATE.md 없음)",
  "",
  "---",
  "",
  index ? index.trim() : "(docs/agent/decisions/DECISION_INDEX.md 없음)",
  "",
  "---",
  "",
  "### 최근 커밋",
  "```",
  recent || "(git log 실패)",
  "```",
  "",
  "**규칙**: Accepted ADR은 조용히 뒤집지 않는다(충돌하면 먼저 말하고 supersede).",
  "의미 있는 작업(기능·구조·마이그레이션)이 끝나면 `docs/agent/CURRENT_STATE.md`를 갱신한다."
].join("\n");

process.stdout.write(out);
