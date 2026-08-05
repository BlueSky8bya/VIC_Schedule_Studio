import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// transform으로 가운데 정렬한 요소에 **transform을 건드리는 등장 애니메이션**을 붙이면,
// 키프레임의 transform이 translateX(-50%)를 통째로 덮어써 요소가 반쯤 옆으로 밀린다.
// 좁은 화면에서는 그대로 화면 밖으로 잘린다.
//
// 2026-08-05 모바일 실측: 삭제 스낵바('실행 취소')가 390px 화면에서 오른쪽으로 6px 넘쳐 잘렸다.
// 같은 함정이 6곳에 있었다(스낵바·확대 플로트 2종·축하 토스트·월드컵 카드 2종).
// 조용히 깨지고(오류 없음) 넓은 화면에서는 안 보여서, 규칙으로 못박는다.
//
// 해법은 둘 중 하나:
//   ① 가운데 정렬을 transform 없이 한다(left:0; right:0; margin-inline:auto) — 권장.
//   ② 키프레임의 모든 transform에 -50%를 함께 적는다(translate(-50%, …)).

const ROOTS = ["components", "app"];

function cssFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css")) out.push(p);
    }
  };
  for (const r of ROOTS) walk(path.join(process.cwd(), r));
  return out;
}

type Keyframes = Map<string, string[]>; // 이름 → transform 선언들

function collectKeyframes(sources: string[]): Keyframes {
  const kf: Keyframes = new Map();
  for (const src of sources) {
    for (const m of src.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
      const transforms = [...m[2].matchAll(/transform:\s*([^;}]+)/g)].map((t) => t[1].trim());
      const prev = kf.get(m[1]) ?? [];
      kf.set(m[1], [...prev, ...transforms]);
    }
  }
  return kf;
}

describe("가운데 정렬(transform)과 등장 애니메이션이 싸우지 않는다", () => {
  it("애니메이션이 translateX(-50%) 정렬을 덮어쓰는 규칙이 없다", () => {
    const files = cssFiles();
    const sources = files.map((f) => fs.readFileSync(f, "utf8"));
    const kf = collectKeyframes(sources);
    const broken: string[] = [];

    files.forEach((file, i) => {
      const src = sources[i];
      for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const body = m[2];
        const selector = m[1].trim().split("\n").pop()?.trim() ?? "?";
        const centers = /transform:[^;}]*translate(?:X)?\(\s*-50%/.test(body);
        const anim = /animation:\s*([\w-]+)/.exec(body);
        if (!centers || !anim) continue;
        const name = anim[1];
        if (name === "none") continue;
        const transforms = kf.get(name);
        if (!transforms || transforms.length === 0) continue; // transform을 안 건드리면 안전
        const keepsCentering = transforms.every((t) => t.includes("-50%") || t === "none");
        if (!keepsCentering) {
          broken.push(`${path.relative(process.cwd(), file)} | ${selector} | animation=${name}`);
        }
      }
    });

    expect(
      broken,
      "이 규칙들은 애니메이션이 시작되는 순간 가운데 정렬을 잃는다 — left/right + margin-inline:auto로 바꾸거나 키프레임에 -50%를 함께 적어라"
    ).toEqual([]);
  });

  it("검사기가 실제로 잡는지(자기 검증) — 깨진 CSS 표본에서 걸린다", () => {
    const bad = [
      `.x { position: fixed; left: 50%; transform: translateX(-50%); animation: boom 1s both; }`,
      `@keyframes boom { from { transform: scale(0.9); } to { transform: scale(1); } }`
    ].join("\n");
    const kf = collectKeyframes([bad]);
    expect(kf.get("boom")).toEqual(["scale(0.9)", "scale(1)"]);
    const keeps = (kf.get("boom") ?? []).every((t) => t.includes("-50%"));
    expect(keeps).toBe(false);
  });
});
