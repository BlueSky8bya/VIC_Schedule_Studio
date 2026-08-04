import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { startedAtFromBtime } from "@/lib/broadcast/soop";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

// 2026-08-04 회귀: 방송시간이 실제보다 30분 이상 짧게 찍혔다. 원인은 시작시각 출처가
// 방송국 API의 broad.broad_start 하나뿐이었는데 SOOP가 그 필드를 응답에서 빼버려(항상 null),
// 시작시각이 '첫 폴링이 방송을 발견한 시각'으로 굳은 것. 이제 라이브 응답의 BTIME(경과 초)이
// 1순위다 — 폴링이 아무리 늦어도 머리가 안 깎인다. 이 계약을 여기서 못박는다.
describe("방송 시작 시각(BTIME) — 머리 손실 방지", () => {
  const nowMs = Date.parse("2026-08-05T00:00:00.000Z");

  it("BTIME(경과 초)을 실제 시작 시각으로 되돌린다", () => {
    expect(startedAtFromBtime(30285, nowMs)).toBe("2026-08-04T15:35:15.000Z");
    expect(startedAtFromBtime("3600", nowMs)).toBe("2026-08-04T23:00:00.000Z");
  });

  it("이상치(0 이하·48시간 초과·파싱 불가)는 버린다 — 폴링 폴백으로 넘어가게", () => {
    for (const bad of [0, -1, 48 * 3600 + 1, "", null, undefined, "abc", Number.NaN]) {
      expect(startedAtFromBtime(bad, nowMs)).toBeNull();
    }
    // 경계값은 살린다(정확히 48시간).
    expect(startedAtFromBtime(48 * 3600, nowMs)).toBe("2026-08-03T00:00:00.000Z");
  });

  it("세션 기록기가 BTIME 시작시각을 1순위로 쓴다(신규 insert·머리 보정 양쪽)", () => {
    const source = readFileSync(join(repoRoot, "lib/broadcast/session.ts"), "utf8");
    const uses = source.match(/state\.startedAt \?\? \(await fetchSoopBroadStart\(/g) ?? [];
    expect(uses.length).toBe(2); // 새 세션 insert + 열린 세션 머리 보정
  });

  it("죽은 station API(broad_start)에 다시 의존하지 않는다", () => {
    const source = readFileSync(join(repoRoot, "lib/broadcast/soop.ts"), "utf8");
    expect(source).not.toMatch(/chapi\.sooplive\.co\.kr\/api\/\$\{BJ_ID\}\/station/);
    expect(source).toContain("BTIME");
  });

  it("폴링 라우트가 시작시각을 기록기에 넘긴다(둘 다)", () => {
    for (const rel of ["app/api/soop-live/route.ts", "app/api/cron/broadcast-poll/route.ts"]) {
      expect(readFileSync(join(repoRoot, rel), "utf8")).toMatch(/startedAt:\s*\w+\.startedAt/);
    }
  });
});
