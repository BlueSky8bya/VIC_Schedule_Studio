// 편집실에서 일정을 고르면 뜨던 **관심(하트) 수**는 개발자에게만 보인다(2026-09-07 소유자:
// "방송에 보이기 껄끄러울 수 있으니까"). 편집실은 방송 중 화면이 공유되는 곳이고 그 줄은 선택만 하면
// 저절로 뜬다 — 시청자 화면조차 원본 수를 안 보여주고 상대 단계(테두리 링·👑)만 쓰는데 편집실만 숫자를 냈다.
// 조용히 되돌아오는 것을 막는 회귀 가드다.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const SHELL = readFileSync("components/studio/studio-shell.tsx", "utf8");

describe("편집실 관심 수 — 개발자 전용", () => {
  test("`.editor-hearts` 줄은 effectiveRole === \"developer\" 게이트 안에서만 렌더된다", () => {
    const at = SHELL.indexOf('className="editor-hearts"');
    expect(at, "`.editor-hearts` 줄이 사라졌다면 이 테스트도 함께 지운다").toBeGreaterThan(0);
    // 그 줄을 여는 JSX 조건은 바로 위에 있다 — 앞 400자 안에 게이트가 있어야 한다.
    const before = SHELL.slice(Math.max(0, at - 400), at);
    expect(before).toContain('effectiveRole === "developer"');
    // 실제 역할(actor.role)로 판정하면 개발자가 관리자로 미리보기해도 계속 보인다 — 미리보기는
    // "그 역할이 보는 화면"이어야 하므로 effectiveRole이어야 한다.
    expect(before).not.toContain("actor.role === \"developer\"");
  });

  test("편집실에는 하트 수를 그리는 다른 자리가 없다", () => {
    const hits = SHELL.match(/heartCountOfSelected/g) ?? [];
    // 선언 1 + 게이트 조건 1 + 출력 1 = 3. 늘어났다면 게이트 없는 자리가 생긴 것이다.
    expect(hits.length).toBe(3);
  });
});
