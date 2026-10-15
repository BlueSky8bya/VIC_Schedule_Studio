import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { expectCompanionPerchClear, expectQuietCompanionTail, expectQuietCompanionVisible, waitForOverlayEntrance } from "./helpers/companion-overlay";

const posts = new WeakMap<Page, string[]>();
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.locator(".vc-actor");
type ClosingWindow = Window & { companionClosing: { hidden: boolean; observer: MutationObserver } };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  // Every data request opened by these public UI checks is synthetic; no
  // search query, broadcast aggregate or schedule test reaches Supabase.
  await page.route("**/api/public/*/search**", route => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/trending")) return route.fulfill({ json: { trends: [] } });
    if (url.pathname.endsWith("/suggest")) return route.fulfill({ json: { items: [] } });
    return route.fulfill({ json: { query: url.searchParams.get("q"), hits: [{ kind: "event", eventId: "synthetic-overlay-event", dateKey: "2026-06-01", title: "기억 합성 공개 일정", snippet: "공개 fixture", score: 1, exact: true, popularity: .5 }] } });
  });
  await page.route("**/api/public/*/broadcast?**", route => route.request().method() === "GET" ? route.fulfill({ json: { months: [], daily: Array(30).fill(0) } }) : route.fallback());
  await page.addInitScript(({ epoch, epochKey, preferences, care }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, size: page.viewportSize()!.width === 390 ? "small" : "normal", roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false, feeding: false }, care: DEFAULT_COMPANION_CARE });
});
test.afterEach(async ({ page }) => expect(posts.get(page)).toEqual([]));

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test.describe(mobile ? "real touch ordinary overlays" : "desktop ordinary overlays", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });
  test("detail, search, records and settings keep one visible quiet companion without taking overlay focus", async ({ page }) => {
    test.setTimeout(90_000);
    const press = (button: Locator) => mobile ? button.tap() : button.click();
    await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
    await expect(actor(page)).toBeVisible();
    await page.evaluate(async () => {
      await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
    });
    await page.waitForTimeout(180); // final coalesced support geometry, no fake clock
    if (mobile) {
      // A real public input command gives this regression a calendar glyph
      // anchor instead of allowing initial timing to choose a fixed floor.
      // Manual placement intentionally uses the actual card top, including
      // dense agenda rows with no text-safe autonomous ledge at92px.
      const point = await page.locator(".agenda-event:visible,.agenda-item:visible").first().evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top - 12 }; });
      await actor(page).focus(); await actor(page).press("p");
      await expect(pet(page)).toHaveAttribute("data-placing", "");
      await page.touchscreen.tap(point.x, point.y);
      await expect(pet(page)).toHaveAttribute("data-platform", /^(?:card|date)-/);
      await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
      await page.waitForTimeout(220); // native landing's final coalesced safe-span clipping
      await expect(page.getByRole("dialog", { name: "일정 상세", exact: true })).toHaveCount(0);
    }
    const identity = (await pet(page).elementHandle())!;
    const originalPlatform = await pet(page).getAttribute("data-platform");
    const originalFeet = await pet(page).evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.bottom }; });
    expect(originalPlatform).toBeTruthy();
    const diagnostic = async (step: string) => {
      const sample = await page.evaluate(({ step, originalFeet }) => {
        const node = document.querySelector<HTMLElement>(".vc-companion")!, rect = node.getBoundingClientRect();
        const first = document.querySelector<HTMLElement>(".agenda-event,.public-event")!.getBoundingClientRect();
        const matches: { index: number; left: number; right: number; top: number }[] = [], range = document.createRange();
        [...document.querySelectorAll(".agenda-title-text,.agenda-subs li,.event-main p,.event-subs li")].forEach((element, index) => {
          range.selectNodeContents(element);
          for (const r of range.getClientRects()) if (originalFeet.x >= r.left - 1 && originalFeet.x <= r.right + 1 && Math.abs(originalFeet.y - r.top + 3) < 4) matches.push({ index, left: r.left, right: r.right, top: r.top });
        });
        return { step, scrollY, viewport: { width: innerWidth, height: innerHeight, top: visualViewport?.offsetTop }, firstCard: { top: first.top, bottom: first.bottom }, pet: { platform: node.dataset.platform, hidden: node.hidden, x: rect.left + rect.width / 2, y: rect.bottom }, originalFeet, matches };
      }, { step, originalFeet });
      console.log(JSON.stringify({ check: `overlay-world-${mobile ? 390 : 1920}`, ...sample }));
    };
    const sameCreature = async () => {
      await expect(pet(page)).toHaveCount(1);
      expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    };
    const closeAndResume = async (dialog: Locator) => {
      const name = await dialog.getAttribute("aria-label");
      await pet(page).evaluate(node => {
        const witness: ClosingWindow["companionClosing"] = (window as unknown as ClosingWindow).companionClosing = { hidden: false, observer: new MutationObserver(records => {
          if ((node as HTMLElement).hidden || records.some(record => record.oldValue !== null)) witness.hidden = true;
        }) };
        witness.observer.observe(node, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true });
      });
      await press(name === "설정" ? dialog.locator("[data-act=close-settings]") : dialog.getByRole("button", { name: "닫기", exact: true }));
      await expect(dialog).toHaveCount(0); await sameCreature();
      await diagnostic(`closed-${name}`);
      await expect(pet(page)).toHaveAttribute("data-platform", originalPlatform!);
      await expect(actor(page)).toBeEnabled();
      await expect.poll(() => actor(page).evaluate(node => getComputedStyle(node).pointerEvents)).toBe("auto");
      await expect.poll(() => pet(page).evaluate((node, point) => {
        const rect = node.getBoundingClientRect();
        return Math.hypot(rect.left + rect.width / 2 - point.x, rect.bottom - point.y);
      }, originalFeet)).toBeLessThan(3);
      expect(await page.evaluate(() => {
        const witness = (window as unknown as ClosingWindow).companionClosing;
        witness.observer.disconnect(); return witness.hidden;
      })).toBe(false);
      await press(actor(page)); await expect(pet(page)).toHaveAttribute("data-state", "petted");
    };
    const snapshot = (name: string) => page.screenshot({ path: `.scratch-pw/companion-overlay-${mobile ? "390" : "1920"}-${name}.png` });

    await diagnostic("before-detail");
    await press(page.locator(mobile ? ".agenda-event:visible" : ".public-event:visible").first());
    const detail = page.getByRole("dialog", { name: "일정 상세", exact: true });
    await expect(detail).toBeVisible(); await sameCreature();
    await diagnostic("opened-detail");
    const detailClose = detail.getByRole("button", { name: "닫기", exact: true });
    await waitForOverlayEntrance(detail);
    await detailClose.focus(); await expectQuietCompanionTail(page, detailClose);
    await expectCompanionPerchClear(page, detail); await snapshot("detail");
    if (!mobile) {
      const before = (await detail.boundingBox())!, body = (await actor(page).boundingBox())!, grip = (await detail.locator(".detail-grab").boundingBox())!;
      const target = { x: Math.max(12, Math.min(1920 - before.width - 12, body.x + body.width / 2 - before.width / 2)), y: Math.max(12, Math.min(1100 - before.height - 12, body.y + body.height / 2 - before.height / 2)) };
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2 + target.x - before.x, grip.y + grip.height / 2 + target.y - before.y, { steps: 14 }); await page.mouse.up();
      const after = (await detail.boundingBox())!;
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(80);
      expect(after.width).toBeCloseTo(before.width, 1); expect(after.height).toBeCloseTo(before.height, 1);
      await detailClose.focus(); await expectQuietCompanionTail(page, detailClose);
      await expectCompanionPerchClear(page, detail); await snapshot("detail-drag");
    }
    await closeAndResume(detail);

    await press(page.locator(mobile ? "[data-act=mb-search]:visible" : "[data-act=open-search]:visible"));
    const search = page.getByRole("dialog", { name: "검색", exact: true });
    const input = search.getByRole("searchbox", { name: "검색어", exact: true });
    await expect(input).toBeFocused(); await input.pressSequentially("기억", { delay: 70 });
    await expect(input).toHaveValue("기억"); await sameCreature();
    await expectQuietCompanionTail(page, input);
    await input.press("Enter"); await expect(search.locator(".ps-row")).toHaveCount(1);
    const sort = search.getByRole("button", { name: "최신", exact: true });
    await press(sort); await expect(sort).toHaveAttribute("aria-pressed", "true");
    await expectQuietCompanionVisible(page); await sameCreature();
    await expectCompanionPerchClear(page, search);
    await snapshot("search"); await closeAndResume(search);

    await press(page.locator(mobile ? "[data-act='이 달 기록 보기']:visible" : "[data-act=open-insights]:visible"));
    const records = page.getByRole("dialog", { name: "6월 기록", exact: true });
    await expect(records).toBeVisible(); await expect(records).toContainText("이번 달 컨텐츠");
    const recordClose = records.getByRole("button", { name: "닫기", exact: true });
    await waitForOverlayEntrance(records);
    await recordClose.focus(); await sameCreature(); await expectQuietCompanionTail(page, recordClose);
    await expectCompanionPerchClear(page, records);
    await snapshot("records"); await closeAndResume(records);

    await press(page.getByRole("button", { name: "설정", exact: true }));
    const settings = page.getByRole("dialog", { name: "설정", exact: true });
    await waitForOverlayEntrance(settings);
    const companionTab = settings.getByRole("tab", { name: "빅타민", exact: true });
    if (await companionTab.isVisible()) await press(companionTab);
    const prank = settings.getByRole("tab", { name: "장난", exact: true });
    await press(prank); await expect(prank).toHaveAttribute("aria-selected", "true");
    await prank.focus(); await sameCreature(); await expectQuietCompanionTail(page, prank);
    await expectCompanionPerchClear(page, settings);
    await snapshot("settings"); await closeAndResume(settings);

    await expect(page.locator("[data-export-surface] .vc-companion")).toHaveCount(0);
    await identity.dispose();
  });
});
