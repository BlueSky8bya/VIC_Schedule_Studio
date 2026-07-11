#!/usr/bin/env node
/**
 * Stop 훅 — 세션이 끝날 때 "코드는 바뀌었는데 현재 상태 문서는 그대로"인 드리프트를 잡는다.
 *
 * 판정(둘 다 참일 때만 경고):
 *   1) 최근 커밋 또는 작업 트리에 '제품 소스'(app/ components/ lib/ db/migrations/) 변경이 있다.
 *   2) 그 범위에 docs/agent/CURRENT_STATE.md 변경이 없다.
 *
 * 문서 손질·설정 변경만 한 세션은 조용히 통과한다(잔소리 금지 — 잔소리는 무시당한다).
 * 차단하지 않고 경고만 한다. 판단이 필요한 규칙(무엇을 적을지)은 사람·에이전트의 몫이다.
 */
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const git = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" });
  } catch {
    return "";
  }
};

// 이번 세션에서 만진 파일 ≈ 최근 커밋들(오늘) + 작업 트리 변경.
const today = git("git log --since=midnight --name-only --pretty=format:");
const dirty = git("git status --porcelain");
const touched = new Set(
  [
    ...today.split("\n").map((l) => l.trim()),
    ...dirty
      .split("\n")
      .map((l) => l.slice(3).trim())
      .filter(Boolean)
  ].filter(Boolean)
);

const SOURCE = /^(app|components|lib|db\/migrations)\//;
const sourceChanged = [...touched].some((f) => SOURCE.test(f));
const stateChanged = [...touched].some((f) => f === "docs/agent/CURRENT_STATE.md");

if (sourceChanged && !stateChanged) {
  process.stdout.write(
    [
      "⚠ 저장소 기억 드리프트: 오늘 제품 소스(app/ components/ lib/ db/migrations/)를 바꿨는데",
      "`docs/agent/CURRENT_STATE.md`는 그대로다.",
      "",
      "이 작업이 '의미 있는 변경'(기능·구조·마이그레이션·알려진 이슈 해결)이라면 CURRENT_STATE의",
      "Current Status / Known Issues / Next Exact Steps / Last Verified를 지금 갱신해라.",
      "되돌리기 비싼 결정을 내렸다면 docs/agent/decisions/에 ADR을 추가하고 DECISION_INDEX에 한 줄 넣어라.",
      "단순 오타·스타일 수정이면 무시해도 된다."
    ].join("\n")
  );
}
