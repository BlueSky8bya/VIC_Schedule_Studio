import { expect, test, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";

const posts = new WeakMap<Page, string[]>(), errors = new WeakMap<Page, string[]>();
const publicReads = new WeakMap<Page, number[]>();
const artifactPrefix = process.env.COMPANION_HEADER_ARTIFACT_PREFIX ?? "companion-066-header-placement";
const windowOf = (page: Page) => page.getByRole("dialog", { name: "설정", exact: true });
const gearOf = (page: Page) => page.locator(".agenda-header > .viewer-settings-open,.m-month-nav > .viewer-settings-open");

test.beforeEach(async ({ page }) => {
  const attempted: string[] = [], failures: string[] = [], reads: number[] = [];
  posts.set(page, attempted); errors.set(page, failures); publicReads.set(page, reads);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const readActions = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(readActions.size).toBe(1);
  page.on("pageerror", error => failures.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    // Preview cold entry uses this existing public read over POST transport.
    // Fulfil only its exact built action with the public fixture; no request
    // reaches a real server action. Every mutation/unknown POST stays blocked.
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && readActions.has(request.headers()["next-action"])) {
      reads.push(Date.now());
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (request.method() === "POST") {
      attempted.push(pathname);
      return route.fulfill({ status: 500, body: "" });
    }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => {
  expect(posts.get(page)).toEqual([]);
  expect(errors.get(page)).toEqual([]);
});

async function seed(page: Page, dark: boolean) {
  await page.addInitScript(({ key, epoch, preferences, dark }) => {
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.dark", dark ? "on" : "off");
    // A remembered desktop preference must survive using mobile settings.
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, dark });
}

async function headerMetrics(page: Page) {
  return gearOf(page).evaluate(node => {
    const gear = node.getBoundingClientRect();
    const studio = node.closest(".studio-mobile");
    const header = studio?.querySelector(".agenda-header") ?? node.parentElement!;
    const title = header.querySelector("h1")!.getBoundingClientRect();
    const account = header.querySelector<HTMLElement>(".agenda-account button,.agenda-account > a,.m-head-logout button,a.m-head-logout");
    const accountRect = account?.getBoundingClientRect();
    const accountSlot = account?.closest<HTMLElement>(".agenda-account,.m-head-logout");
    const leftSlot = header.querySelector<HTMLElement>(".m-head-left");
    const leftRect = leftSlot?.getBoundingClientRect();
    const leftHit = leftRect ? document.elementFromPoint(leftRect.x + leftRect.width / 2, leftRect.y + leftRect.height / 2) : null;
    const hit = document.elementFromPoint(gear.x + gear.width / 2, gear.y + gear.height / 2);
    const accountHit = accountRect ? document.elementFromPoint(accountRect.x + accountRect.width / 2, accountRect.y + accountRect.height / 2) : null;
    const overlap = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const monthGroup = studio?.querySelector(".m-month-switch");
    const month = monthGroup ? (() => {
      const r = monthGroup.getBoundingClientRect(), buttons = [...monthGroup.querySelectorAll("button")];
      const previous = buttons[0].getBoundingClientRect();
      return { centreX: r.x + r.width / 2, centreY: r.y + r.height / 2,
        gearGap: previous.left - gear.right,
        targets: buttons.map(button => { const r = button.getBoundingClientRect(); return { width: r.width, height: r.height }; }),
        nativeHits: buttons.map(button => { const b = button.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return Boolean(hit && (hit === button || button.contains(hit))); }) };
    })() : null;
    const alphaOf = (color: string) => {
      const rgba = color.match(/rgba?\(([^)]+)\)/)?.[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return color === "transparent" ? 0 : rgba?.length === 4 ? rgba[3] : 1;
    };
    const chrome = [header, ...(studio ? [...studio.querySelectorAll(".m-topstick,.m-month-nav")] : [])].map(element => {
      const style = getComputedStyle(element);
      return { className: element.className, backgroundColor: style.backgroundColor,
        outer: studio ? element.matches(".m-topstick") : element === header,
        alpha: alphaOf(style.backgroundColor),
        image: style.backgroundImage, blur: style.backdropFilter, webkitBlur: style.getPropertyValue("-webkit-backdrop-filter"), filter: style.filter, shadow: style.boxShadow,
        borders: ["top", "right", "bottom", "left"].map(side => ({ width: parseFloat(style.getPropertyValue(`border-${side}-width`)), style: style.getPropertyValue(`border-${side}-style`), alpha: alphaOf(style.getPropertyValue(`border-${side}-color`)) })) };
    });
    return {
      x: gear.x, y: gear.y, width: gear.width, height: gear.height,
      right: document.documentElement.clientWidth - gear.right,
      titleCentreX: title.x + title.width / 2,
      titleOverlap: overlap(gear, title),
      titleLeftSlotOverlap: leftRect ? overlap(title, leftRect) : 0,
      leftSlot: leftSlot && leftRect ? { left: leftRect.left, right: leftRect.right, top: leftRect.top, width: leftRect.width, height: leftRect.height,
        titleGap: title.left - leftRect.right, saveState: leftSlot.querySelector(".save-status")?.textContent?.trim(),
        nativeHit: Boolean(leftHit && (leftSlot === leftHit || leftSlot.contains(leftHit))) } : null,
      titleCentreY: title.y + title.height / 2,
      account: account && accountRect ? { tag: account.tagName, label: account.textContent?.trim(), action: account.closest("form")?.getAttribute("action") ?? account.getAttribute("href"),
        width: accountRect.width, height: accountRect.height, right: document.documentElement.clientWidth - accountRect.right,
        gearOverlap: overlap(gear, accountRect), titleOverlap: overlap(accountRect, title), row: accountSlot ? getComputedStyle(accountSlot).gridRowStart : null,
        centreY: accountRect.y + accountRect.height / 2,
        nativeHit: Boolean(accountHit && (account === accountHit || account.contains(accountHit))) } : null,
      month, chrome, canvasColor: getComputedStyle(document.body).backgroundColor,
      nativeHit: Boolean(hit?.closest(".viewer-settings-open") === node),
      scrollWidth: document.documentElement.scrollWidth,
      widthOfPage: document.documentElement.clientWidth,
      innerWidth, visualWidth: visualViewport?.width ?? innerWidth,
    };
  });
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
}

function assertDarkScrolledHeader(metric: Awaited<ReturnType<typeof headerMetrics>>) {
  expect(metric.nativeHit).toBe(true);
  expect(metric.titleOverlap).toBe(0); expect(metric.titleLeftSlotOverlap).toBe(0);
  expect(Math.abs(metric.titleCentreX - metric.widthOfPage / 2)).toBeLessThan(.5);
  if (metric.account) {
    expect(metric.account.nativeHit).toBe(true);
    expect(metric.account.gearOverlap).toBe(0); expect(metric.account.titleOverlap).toBe(0);
  }
  if (metric.leftSlot) { expect(metric.leftSlot.nativeHit).toBe(true); expect(metric.leftSlot.titleGap).toBeGreaterThanOrEqual(0); }
  if (metric.month) {
    expect(Math.abs(metric.month.centreX - metric.widthOfPage / 2)).toBeLessThan(.5);
    expect(metric.month.gearGap).toBeGreaterThanOrEqual(8);
    expect(metric.month.nativeHits).toEqual([true, true, true]);
  }
  for (const chrome of metric.chrome) {
    expect(chrome.alpha, chrome.className).toBe(chrome.outer ? 1 : 0);
    if (chrome.outer) expect(chrome.backgroundColor, chrome.className).toBe(metric.canvasColor);
    expect(chrome.image, chrome.className).toBe("none");
    expect(chrome.blur, chrome.className).toBe("none"); expect(["", "none"], chrome.className).toContain(chrome.webkitBlur);
    expect(chrome.filter, chrome.className).toBe("none"); expect(chrome.shadow, chrome.className).toBe("none");
    expect(chrome.borders.every(border => border.width === 0 || border.style === "none" || border.alpha === 0), chrome.className).toBe(true);
  }
}

for (const topology of [
  { name: "native390", width: 390, height: 844, dark: false },
  // Wider than both agenda width cutoffs: the coarse/short-height clause,
  // rather than a narrow desktop viewport, must supply this same header.
  { name: "coarse-landscape", width: 1120, height: 600, dark: true },
  { name: "native320-dark", width: 320, height: 740, dark: true },
  { name: "native360-light", width: 360, height: 800, dark: false },
]) test.describe(topology.name, () => {
  test.use({ viewport: { width: topology.width, height: topology.height }, isMobile: true, hasTouch: true });

  test("left settings and right accounts preserve centered mobile headers and dark canvas material, native X, Back and focus", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, topology.dark);
    const measured: Record<string, Awaited<ReturnType<typeof headerMetrics>>> = {};
    const scrolled: Record<string, { beforeY: number; afterY: number; header: Awaited<ReturnType<typeof headerMetrics>> }> = {};
    for (const route of [
      { name: "anonymous", path: "/visual-fixture/poster?avatar=1&signedIn=0", surface: ".poster-agenda", account: "로그인", action: "/api/auth/login", studio: false, preview: false },
      { name: "signed-in", path: "/visual-fixture/poster?avatar=1&signedIn=1", surface: ".poster-agenda", account: "로그아웃", action: "/api/auth/logout", studio: false, preview: false },
      { name: "studio", path: "/visual-fixture/studio?role=owner", surface: ".studio-mobile", account: "로그아웃", action: "/api/auth/logout", studio: true, preview: false },
      { name: "preview", path: "/visual-fixture/studio?role=owner&viewer=1", surface: ".viewer-fullscreen .poster-agenda", account: null, action: null, studio: false, preview: true },
    ]) {
      await page.goto(route.path);
      await expect(page.locator(route.surface)).toBeVisible();
      await settle(page);
      if (route.studio) await expect(page.locator(".studio-mobile .m-head-left .save-status")).toContainText("저장됨");
      if (route.preview) {
        await expect.poll(() => publicReads.get(page)?.length).toBe(1);
        await expect(page.getByRole("button", { name: "편집실로 가기", exact: true })).toBeVisible();
      }
      const gear = gearOf(page);
      await expect(gear).toHaveCount(1);
      await expect(gear).toBeVisible();
      await expect(gear).toHaveAccessibleName("설정");
      await expect(page.locator(".agenda-rail .viewer-settings-open")).toHaveCount(0);
      const metric = measured[route.name] = await headerMetrics(page);
      // Preserve raw geometry/material even when a following strict assertion
      // fails. Each run supplies a fresh artifact prefix; prior receipts stay.
      writeFileSync(`.scratch-pw/${artifactPrefix}-${topology.name}.json`, JSON.stringify({ measured, scrolled, readTransports: publicReads.get(page)?.length, posts: posts.get(page), errors: errors.get(page) }, null, 2));
      await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-${route.name}-${topology.name}.png` });
      expect(metric.width).toBe(44); expect(metric.height).toBe(44);
      expect(metric.y).toBeGreaterThanOrEqual(0);
      expect(metric.x).toBeCloseTo(14, 1);
      expect(metric.titleOverlap).toBe(0);
      expect(metric.titleLeftSlotOverlap).toBe(0);
      expect(Math.abs(metric.titleCentreX - metric.widthOfPage / 2)).toBeLessThan(.5);
      if (!route.studio) {
        await expect(page.locator(".agenda-header > .viewer-settings-open")).toHaveCount(1);
        expect(metric.y).toBe(9); expect(metric.month).toBeNull();
      } else {
        await expect(page.locator(".agenda-header > .viewer-settings-open")).toHaveCount(0);
        await expect(page.locator(".m-month-nav > .viewer-settings-open")).toHaveCount(1);
        expect(metric.leftSlot).not.toBeNull();
        expect(metric.leftSlot!.nativeHit).toBe(true); expect(metric.leftSlot!.titleGap).toBeGreaterThanOrEqual(0);
        expect(metric.month).not.toBeNull();
        expect(Math.abs(metric.month!.centreX - metric.widthOfPage / 2)).toBeLessThan(.5);
        expect(Math.abs(metric.month!.centreY - metric.y - metric.height / 2)).toBeLessThan(.5);
        expect(metric.month!.gearGap).toBeGreaterThanOrEqual(8);
        expect(metric.month!.nativeHits).toEqual([true, true, true]);
        // The existing text month picker keeps its shared link geometry;
        // both visible arrow controls retain their 44px native targets.
        for (const target of [metric.month!.targets[0], metric.month!.targets.at(-1)!]) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); }
      }
      if (route.account) {
        expect(metric.account).not.toBeNull();
        expect(metric.account!.label).toBe(route.account); expect(metric.account!.action).toBe(route.action);
        expect(metric.account!.row).toBe("1"); expect(metric.account!.right).toBeCloseTo(14, 1);
        expect(metric.account!.width).toBeGreaterThanOrEqual(44); expect(metric.account!.height).toBeGreaterThanOrEqual(44);
        expect(metric.account!.gearOverlap).toBe(0); expect(metric.account!.titleOverlap).toBe(0);
        expect(Math.abs(metric.account!.centreY - metric.titleCentreY)).toBeLessThan(.5);
        expect(metric.account!.nativeHit).toBe(true);
      } else expect(metric.account).toBeNull();
      for (const chrome of metric.chrome) {
        if (!chrome.outer) expect(chrome.alpha, chrome.className).toBe(0);
        if (topology.dark) {
          // A sticky outer layer must cover scrolling ink using the actual
          // canvas paper. Only the nested studio header/month row is clear.
          if (chrome.outer) {
            expect(chrome.alpha, chrome.className).toBe(1);
            expect(chrome.backgroundColor, chrome.className).toBe(metric.canvasColor);
          }
          expect(chrome.image, chrome.className).toBe("none");
          expect(chrome.borders.every(border => border.width === 0 || border.style === "none" || border.alpha === 0), chrome.className).toBe(true);
        }
        expect(chrome.blur, chrome.className).toBe("none"); expect(["", "none"], chrome.className).toContain(chrome.webkitBlur);
        expect(chrome.filter, chrome.className).toBe("none"); expect(chrome.shadow, chrome.className).toBe("none");
      }
      expect(metric.nativeHit).toBe(true);
      expect(metric.scrollWidth).toBeLessThanOrEqual(metric.widthOfPage + 1);
      expect(Math.abs(metric.innerWidth - topology.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(metric.visualWidth - topology.width)).toBeLessThanOrEqual(1);

      if (topology.dark) {
        const beforeY = await page.evaluate(() => scrollY);
        // Genuine wheel over the schedule column, away from the inner legend
        // scroller. Verify real movement before inspecting sticky paint/hits.
        await page.mouse.move(topology.width * .4, topology.height * .66);
        await page.mouse.wheel(0, 180);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeY + 24);
        await settle(page);
        scrolled[route.name] = { beforeY, afterY: await page.evaluate(() => scrollY), header: await headerMetrics(page) };
        writeFileSync(`.scratch-pw/${artifactPrefix}-${topology.name}.json`, JSON.stringify({ measured, scrolled, readTransports: publicReads.get(page)?.length, posts: posts.get(page), errors: errors.get(page) }, null, 2));
        await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-${route.name}-${topology.name}-scrolled.png` });
        assertDarkScrolledHeader(scrolled[route.name].header);
      }

      await gear.tap(); await expect(windowOf(page)).toBeVisible();
      await expect(gear).toHaveAttribute("aria-expanded", "true");
      await expect.poll(() => windowOf(page).evaluate(node => node.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Shift+Tab");
      await expect.poll(() => windowOf(page).evaluate(node => node.contains(document.activeElement))).toBe(true);
      await windowOf(page).locator(".modal-head .modal-close").tap();
      await expect(windowOf(page)).toHaveCount(0); await expect(gear).toBeFocused();
      await expect(gear).toHaveAttribute("aria-expanded", "false");
      await gear.tap(); await expect(windowOf(page)).toBeVisible();
      await page.goBack(); await expect(windowOf(page)).toHaveCount(0);
      await expect(page.locator(route.surface)).toBeVisible(); await expect(gear).toBeFocused();
      expect(new URL(page.url()).pathname).toBe(new URL(route.path, "http://fixture").pathname);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).enabled)).toBe(true);
    }
    // Latest owner placement supersedes064's right-side exception: all three
    // viewer contexts use upper-left settings; studio uses month-row left.
    for (const name of ["anonymous", "signed-in", "preview"]) {
      expect(Math.abs(measured[name].x - measured.studio.x)).toBeLessThan(.5);
      expect(measured.studio.y - measured[name].y).toBeGreaterThan(44);
    }
    writeFileSync(`.scratch-pw/${artifactPrefix}-${topology.name}.json`, JSON.stringify({ measured, scrolled, readTransports: publicReads.get(page)?.length, posts: posts.get(page), errors: errors.get(page) }, null, 2));
  });
});
