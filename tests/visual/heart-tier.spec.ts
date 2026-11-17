import { expect, test } from "@playwright/test";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";

// 인기 표시 = 이 달 하트 1·2·3위 금·은·동 왕관(2026-11-17, 테두리 링·광택 대체) 회귀 게이트.
//  · 순위 카드마다 .tier-crown 1개(금·은·동), 옛 링(.tier-ring)·레일(.tier-signal)·진입 빛(.pop-bloom) 0.
//  · 왕관은 높이 0 — 하트가 있어도 표면 자연 높이가 하트 없을 때와 같다(달력 비율 보호).
//  · 범례(웹)·모바일 아젠다 도움말에 견본 3개, 모바일 행에도 왕관.
test.describe("heart tier — 금·은·동 왕관", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
      } catch {
        /* noop */
      }
    });
  });

  test("데스크탑: 왕관 렌더, 링·레일·빛 없음", async ({ page }) => {
    await page.goto("/visual-fixture/poster?hearts=1");
    await page.locator("[data-export-surface]").waitFor();
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const tiers = Array.from(document.querySelectorAll<HTMLElement>(".public-event[data-tier]"));
      return {
        keys: [...new Set(tiers.map((c) => c.dataset.tier))].sort(),
        retired: document.querySelectorAll(".tier-ring, .tier-signal, .pop-bloom, .event-popular").length,
        legend: document.querySelectorAll(".legend-tiers .tier-swatch").length,
        cards: tiers.map((c) => {
          const crowns = c.querySelectorAll<HTMLImageElement>(".tier-crown");
          const crown = crowns[0];
          const cr = crown?.getBoundingClientRect(), r = c.getBoundingClientRect();
          return {
            key: c.dataset.tier,
            count: crowns.length,
            src: crown?.getAttribute("src"),
            loaded: Boolean(crown?.complete && crown.naturalWidth > 0),
            pos: crown ? getComputedStyle(crown).position : null,
            // 왕관은 카드 오른쪽 위 모서리 근처에 얹힌다(2색 카드에서 왼쪽 아래로 밀리던 회귀 방지)
            nearTopRight: cr ? cr.right > r.right - cr.width * 3 && cr.bottom <= r.top + 8 : false,
            // 하트를 가리지 않는다(2026-11-17 소유자) — 왕관은 하트 왼쪽에 앉는다
            coversHeart: (() => {
              const h = c.querySelector(".event-heart")?.getBoundingClientRect();
              return Boolean(cr && h && cr.right > h.left + 1 && cr.left < h.right && cr.bottom > h.top && cr.top < h.bottom);
            })()
          };
        })
      };
    });
    expect(m.keys).toEqual(["bronze", "gold", "silver"]);
    expect(m.retired).toBe(0);
    expect(m.legend).toBe(3);
    for (const c of m.cards) {
      expect(c.count).toBe(1);
      expect(c.src).toBe(`/crowns/${c.key}.svg`);
      expect(c.loaded).toBe(true);
      expect(c.pos).toBe("absolute");
      expect(c.nearTopRight).toBe(true);
      expect(c.coversHeart).toBe(false);
    }
  });

  test("상세 팝오버 인기 순위 배지는 태그 오른쪽 메타 — 금·은·동 텍스트", async ({
    page, context, baseURL
  }, info) => {
    const proof = await guardCompanionQa(page, context, baseURL!);
    // The fixture also requests the bare public root. Its initiator remains
    // unconfirmed; isolate that exact GET instead of invoking the real loader.
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === baseURL && url.pathname === "/" && request.method() === "GET") {
        proof.syntheticReads.push("excluded-public-root-get");
        return route.fulfill({ status: 404, contentType: "text/plain", body: "Public root excluded from synthetic fixture QA." });
      }
      // 바닥글의 개인정보·약관 링크 미리 불러오기(2026-11-13 추가) — 정적 안내 페이지라 여기서 끊는다.
      if (url.origin === baseURL && ["/privacy", "/terms"].includes(url.pathname) && request.method() === "GET") {
        proof.syntheticReads.push("excluded-legal-prefetch");
        return route.fulfill({ status: 404, contentType: "text/plain", body: "Legal pages excluded from synthetic fixture QA." });
      }
      return route.fallback();
    });
    await page.addInitScript(() => {
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
      localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    });
    await page.goto("/visual-fixture/poster?hearts=1");
    await page.locator("[data-export-surface]").waitFor();
    await settlePanelLayout(page);
    const seen: Record<string, string> = {};
    const positions = [];
    for (const key of ["gold", "silver", "bronze"]) {
      const card = page.locator(`.public-event[data-tier="${key}"]`).first();
      await card.click();
      const badge = page.locator(".agenda-detail-sheet .agenda-detail-metadata > .adt-badge");
      await badge.waitFor();
      await settlePanelLayout(page);
      seen[key] = ((await badge.textContent()) ?? "").trim();
      await expect(badge).toHaveClass(new RegExp(`tier-${key}`));
      // Full-width title first, then rank docked right without covering tags.
      const [tb, bb, hb] = await Promise.all([
        page.locator(".agenda-detail-sheet .agenda-detail-heading > .agenda-detail-title").boundingBox(),
        badge.boundingBox(),
        page.locator(".agenda-detail-sheet .agenda-detail-metadata").boundingBox()
      ]);
      expect(bb!.x).toBeGreaterThan(tb!.x);
      expect(bb!.y).toBeGreaterThanOrEqual(tb!.y + tb!.height);
      expect(tb!.width).toBeGreaterThanOrEqual(hb!.width - 1);
      expect(bb!.x + bb!.width).toBeLessThanOrEqual(hb!.x + hb!.width + 1);
      positions.push({ key, title: tb, badge: bb, heading: hb });
      if (key === "gold") await info.attach("top-tier-meta", { body: await page.locator(".agenda-detail-sheet").screenshot(), contentType: "image/png" });
      await page.keyboard.press("Escape");
      await page.locator(".agenda-detail-sheet").waitFor({ state: "detached" });
    }
    expect(seen).toEqual({ gold: "이 달 1위", silver: "이 달 2위", bronze: "이 달 3위" });
    // 티어 없는 카드엔 배지가 없다
    await page.locator(".public-event:not([data-tier])").first().click();
    await page.locator(".agenda-detail-sheet").waitFor();
    await expect(page.locator(".agenda-detail-sheet .adt-badge")).toHaveCount(0);
    await Promise.all(proof.pending);
    expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]);
    expect(proof.mutations).toEqual([]); expect(proof.liveReads).toEqual([]);
    expect(proof.chunks.length).toBeGreaterThan(0);
    expect(proof.chunks.every(chunk => chunk.served === chunk.local)).toBe(true);
    await info.attach("tier-meta-observation", { body: JSON.stringify({ seen, positions, noTierHasNoBadge: true, build: proof.build,
      syntheticReads: proof.syntheticReads, fixtureOnly: true, noRealDbReadOrWrite: true }), contentType: "application/json" });
  });

  test("표면 자연 높이: 하트 유무 동일(왕관은 높이 0)", async ({ page }) => {
    const natural = async (url: string) => {
      await page.goto(url);
      await page.locator("[data-export-surface]").waitFor();
      await page.waitForTimeout(600);
      return page.evaluate(
        () => (document.querySelector("[data-export-surface]") as HTMLElement).offsetHeight
      );
    };
    const base = await natural("/visual-fixture/poster");
    const hearts = await natural("/visual-fixture/poster?hearts=1");
    expect(hearts).toBe(base);
  });

  test.describe("모바일 아젠다", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    test("행 왕관·도움말 견본, 가로 넘침 없음", async ({ page }) => {
      await page.goto("/visual-fixture/poster?hearts=1");
      await page.locator(".agenda-event").first().waitFor();
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({
        retired: document.querySelectorAll(".agenda-event :is(.tier-ring, .tier-signal)").length,
        crowns: document.querySelectorAll(".agenda-event .tier-crown").length,
        swatches: document.querySelectorAll(".agenda-tier-help .tier-swatch").length,
        overflowX: document.documentElement.scrollWidth > window.innerWidth
      }));
      expect(m.retired).toBe(0);
      expect(m.crowns).toBeGreaterThanOrEqual(1);
      expect(m.swatches).toBe(3);
      expect(m.overflowX).toBe(false);
    });
  });
});
