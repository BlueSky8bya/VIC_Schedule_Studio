import { expect, test } from "@playwright/test";

// 달력 옆 패널 회귀 게이트(2026-08-27 아바타 scene → 2026-09-17 패널 모델) — 방송 화면(OBS 1920×1080 브라우저 소스) 기준.
//  · 패널은 표면 밖 fixed 한 줄: [정보·라이브 카드 | 태그 필터 | 계절 배경 | 아바타 빈 자리(관리자만)].
//  · 달력은 평소처럼 '폭 기준' fit만(높이 fit은 당일 철회 — 긴 달에서 글씨가 작아짐).
//  · 패널 열: 정보 카드가 열 전폭 — D+ 줄바꿈 0. 카드↔빈 자리 겹침 0. 열은 1920에서 정확히 360px(고정 컴포지션).
//  · 고정 scene(fixed=right, /onair와 동일 경로): 알약 없이 scene이 켜진다.
//  · 하단 알약 [⇤ | 패널 | ⇥]: 가운데가 접기/펼치기. 접히면 슬롯이 화면 밖(visibility hidden)이고 달력이 전폭.
//  · 좁은 창(<1280): 자동으로 접히고, '패널'로 열면 달력을 밀지 않고 위에 뜬다(scrim 밖을 누르면 닫힘).
type Box = { x: number; y: number; w: number; h: number; b: number; r: number } | null;
const overlaps = (a: Box, b: Box) => !!(a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b);

async function readScene(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector<HTMLElement>(s);
    const rect = (el: HTMLElement | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right };
    };
    const scaler = q(".poster-scaler")!;
    // 카드는 데뷔 D+ 전용(연·월은 상단 제목) — 줄바꿈 검사 대상도 D+ 숫자.
    const monthB = q(".avatar-top-cards .ric-dplus");
    const monthLine = monthB ? parseFloat(getComputedStyle(monthB).fontSize) * 1.15 : 0;
    const slot = q(".avatar-slot");
    return {
      stage: rect(q(".poster-stage")),
      natH: scaler.offsetHeight,
      scale: parseFloat(getComputedStyle(scaler).getPropertyValue("--poster-scale")),
      slot: rect(slot),
      slotVisible: slot ? getComputedStyle(slot).visibility === "visible" : false,
      cards: rect(q(".avatar-top-cards")),
      info: rect(q(".avatar-top-cards .rail-info-card")),
      legend: rect(q(".avatar-slot .slot-legend")),
      monthWrapped: monthB ? monthB.getBoundingClientRect().height > monthLine * 1.6 : false,
      ctl: rect(q(".poster-panel-ctl")),
      ctlButtons: document.querySelectorAll(".poster-panel-ctl .panel-place-ctl button").length,
      dock: rect(q(".avatar-dock-inner")),
      scrim: rect(q(".panel-scrim")),
      pageW: document.documentElement.clientWidth
    };
  });
}

test.describe("달력 옆 패널 — 방송 화면(1920×1080)", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
        window.localStorage.setItem("vic_avatar_side", "left");
        window.localStorage.removeItem("vic_panel_collapsed");
      } catch {
        /* noop */
      }
    });
  });

  test("시청자 미리보기(관리자): 폭 fit + 한 줄 패널 + 겹침 0 + 360px 열 + 알약 셋", async ({ page }) => {
    await page.goto("/visual-fixture/poster?avatar=1");
    await page.locator(".poster-page.avatar-scene.panel-open").waitFor();
    await page.waitForTimeout(700);
    const m = await readScene(page);
    // 폭 기준 fit: stage 높이 = 자연높이 × 배율(높이 fit 없음).
    expect(Math.abs(m.stage!.h - m.natH * m.scale)).toBeLessThan(1);
    expect(m.ctl).not.toBeNull();
    expect(m.ctlButtons).toBe(3); // ⇤ 패널 ⇥ — 관리자는 자리 선택까지
    // 패널 열: 정보 카드·태그 필터가 열 전폭, D+ 한 줄.
    expect(Math.abs(m.info!.w - m.cards!.w)).toBeLessThan(1.5);
    expect(m.legend).not.toBeNull();
    expect(m.legend!.x).toBeGreaterThanOrEqual(m.slot!.x);
    expect(m.legend!.r).toBeLessThanOrEqual(m.slot!.r + 0.5);
    expect(m.monthWrapped).toBe(false);
    expect(m.dock).not.toBeNull(); // 관리자 = 아바타 빈 자리 있음
    expect(overlaps(m.cards, m.dock)).toBe(false);
    expect(overlaps(m.legend, m.dock)).toBe(false);
    // 슬롯 '박스'는 stage가 안쪽 패딩으로 4px 파고들도록 설계(여백 다이어트) — 겹침 판정은 실제 콘텐츠 기준.
    expect(overlaps(m.cards, m.stage)).toBe(false);
    expect(overlaps(m.legend, m.stage)).toBe(false);
    expect(overlaps(m.dock, m.stage)).toBe(false);
    expect(Math.round(m.slot!.w)).toBe(360);
  });

  test("고정 scene(fixed=right, /onair 경로): 알약 없이 켜지고 오른쪽", async ({ page }) => {
    await page.goto("/visual-fixture/poster?fixed=right");
    await page.locator(".poster-page.avatar-scene.avatar-right.panel-open").waitFor();
    await page.waitForTimeout(700);
    const m = await readScene(page);
    expect(m.ctl).toBeNull();
    expect(m.slot).not.toBeNull();
    expect(m.cards!.x).toBeGreaterThan(m.stage!.r);
    expect(Math.abs(m.info!.w - m.cards!.w)).toBeLessThan(1.5);
  });

  test("월 이동 때 패널·정보 카드·슬롯이 깜빡이지 않는다(probe가 scene 클래스를 안 뗀다)", async ({ page }) => {
    // 동작 줄이기를 끄고(등장 애니가 살아 있는 상태에서) 실측 — 옛 구현은 canon 리셋→probe에서
    // avatar-scene 클래스를 뗐다 붙여 슬롯 display:none↔flex·레일 opacity 0→1 재생으로 깜빡였다.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem("vic.reduceMotion");
      } catch {
        /* noop */
      }
    });
    await page.goto("/visual-fixture/poster?fixed=left");
    await page.locator(".poster-page.avatar-scene").waitFor();
    await page.waitForTimeout(1500); // 등장 애니 종료
    const r = await page.evaluate(async () => {
      const legend = document.querySelector(".avatar-slot .slot-legend")!;
      const card = document.querySelector(".avatar-top-cards .rail-info-card")!;
      const slot = document.querySelector(".avatar-slot")!;
      const btn = document.querySelector<HTMLElement>('[data-act="다음 달"]');
      if (!btn) return { err: "no next button", min: 0, hidden: true };
      const mins: number[] = [];
      let hidden = false;
      btn.click();
      for (let i = 0; i < 24; i++) {
        await new Promise((res) => requestAnimationFrame(res));
        mins.push(
          Math.min(
            +getComputedStyle(legend).opacity,
            +getComputedStyle(card).opacity,
            +getComputedStyle(slot).opacity
          )
        );
        if (getComputedStyle(slot).display === "none" || getComputedStyle(slot).visibility === "hidden") hidden = true;
      }
      return { err: null, min: Math.min(...mins), hidden };
    });
    expect(r.err).toBeNull();
    expect(r.hidden).toBe(false);
    expect(r.min).toBeGreaterThanOrEqual(0.999);
  });

  test("'패널' 버튼: 접으면 슬롯이 화면 밖이고 달력이 전폭, 다시 누르면 돌아온다", async ({ page }) => {
    await page.goto("/visual-fixture/poster?avatar=1");
    await page.locator(".poster-page.avatar-scene.panel-open").waitFor();
    await page.waitForTimeout(500);
    const open = await readScene(page);
    await page.locator('[data-act="panel-toggle"]').click();
    await page.locator(".poster-page.panel-closed").waitFor();
    await page.waitForTimeout(600); // 미닫이 트랜지션(0.42s) 종료
    const closed = await readScene(page);
    expect(closed.slotVisible).toBe(false);
    expect(closed.stage!.w).toBeGreaterThan(open.stage!.w + 200); // 패널 자리(360−4)만큼 달력이 넓어진다
    expect(Math.abs(closed.stage!.h - closed.natH * closed.scale)).toBeLessThan(1);
    // 접힌 동안엔 패널 안 버튼이 닿지 않는다(inert).
    expect(await page.locator(".avatar-slot[inert]").count()).toBe(1);
    await page.locator('[data-act="panel-toggle"]').click();
    await page.locator(".poster-page.panel-open").waitFor();
    await page.waitForTimeout(700);
    const again = await readScene(page);
    expect(again.slotVisible).toBe(true);
    expect(Math.abs(again.stage!.w - open.stage!.w)).toBeLessThan(1);
  });

  test("일반 시청자(아바타 자리 없음): 패널은 카드까지만, 알약은 셋(자리 선택도 시청자에게)", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator(".poster-page.avatar-scene.panel-open").waitFor();
    await page.waitForTimeout(500);
    const m = await readScene(page);
    expect(m.slot).not.toBeNull();
    expect(m.legend).not.toBeNull();
    expect(m.dock).toBeNull();
    expect(m.ctlButtons).toBe(3);
  });
});

test.describe("달력 옆 패널 — 좁은 창(1200×900)", () => {
  test.use({ viewport: { width: 1200, height: 900 } });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
        window.localStorage.setItem("vic_avatar_side", "left");
      } catch {
        /* noop */
      }
    });
  });

  test("자동으로 접히고, '패널'로 열면 달력을 밀지 않고 위에 뜬다(scrim 밖을 누르면 닫힘)", async ({ page }) => {
    await page.goto("/visual-fixture/poster?avatar=1");
    await page.locator(".poster-page.avatar-scene.panel-closed.panel-overlay").waitFor();
    await page.waitForTimeout(500);
    const closed = await readScene(page);
    expect(closed.slotVisible).toBe(false);
    expect(closed.scrim).toBeNull();
    await page.locator('[data-act="panel-toggle"]').click();
    await page.locator(".poster-page.panel-open.panel-overlay").waitFor();
    await page.waitForTimeout(700);
    const open = await readScene(page);
    expect(open.slotVisible).toBe(true);
    expect(open.scrim).not.toBeNull();
    // 떠서 덮기: 달력 폭 그대로(밀리지 않는다) — 슬롯이 달력 위에 겹친다.
    expect(Math.abs(open.stage!.w - closed.stage!.w)).toBeLessThan(1);
    expect(overlaps(open.slot, open.stage)).toBe(true);
    // 밖(scrim)을 누르면 닫힌다 — 달력 오른쪽 아래 빈 곳.
    await page.mouse.click(open.pageW - 40, 860);
    await page.locator(".poster-page.panel-closed").waitFor();
    await page.waitForTimeout(600);
    const again = await readScene(page);
    expect(again.slotVisible).toBe(false);
    expect(again.scrim).toBeNull();
  });
});
