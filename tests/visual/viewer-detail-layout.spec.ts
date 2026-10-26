import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { getTodayKst } from "@/lib/calendar/month";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";

// The guarded poster fixture supplies the same synthetic public event. Preview
// reads below are fulfilled locally; no studio loader or external Google request runs.
const title = "새로운 방송을 함께 준비하는 가을 이야기와 앞으로의 계획";
const lines = ["- 첫 번째 소식", "함께 나눌 이야기와 앞으로의 방송 계획", "- 시청자 질문", "여러분이 보내 주신 질문을 소개합니다"];
const previewFixture = {
  ...samplePublicScheduleData,
  calendar: { ...samplePublicScheduleData.calendar, defaultYear: 2026, defaultMonth: 10 },
  events: [{ ...samplePublicScheduleData.events[0], id: "fixture-detail-layout",
    startsAt: "2026-10-01T20:00:00+09:00", endsAt: "2026-10-01T23:00:00+09:00",
    publicTitle: [title, ...lines].join("\n"), heartCount: 45,
    tagIds: ["tag-full-track", "tag-collab"], primaryTagIds: ["tag-full-track"] }]
};
const dialog = (page: Page) => page.getByRole("dialog", { name: "일정 상세", exact: true });
type NativeObservation = Window & { detailActivations?: { target: string; trusted: boolean }[] };

async function setup(page: Page, context: BrowserContext, base: string) {
  const proof = await guardCompanionQa(page, context, base);
  context.on("requestfailed", request => proof.syntheticReads.push(`denied:${new URL(request.url()).pathname}`));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewActions = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  const restoreActions = new Map(Object.entries(manifest).filter(([, action]) => ["getAnonHeartIdsAction", "getTeaserHopeIdsAction"].includes(action.exportedName ?? "")).map(([id, action]) => [id, action.exportedName]));
  await context.addInitScript(({ epoch, key }) => {
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
    for (const name of ["vic.ambient", "vic.sound", "vic.gfxPref"]) localStorage.setItem(name, "off");
    localStorage.setItem("vic.font", "base");
    localStorage.setItem("vic.reduceMotion", "off");
    (window as NativeObservation).detailActivations = [];
    document.addEventListener("click", event => {
      const control = event.target instanceof Element ? event.target.closest("[data-act]") : null;
      if (control) (window as NativeObservation).detailActivations!.push({ target: control.getAttribute("data-act")!, trusted: event.isTrusted });
    }, true);
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
  await context.route("**/visual-fixture/studio**", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base && request.method() === "POST" && previewActions.has(request.headers()["next-action"])) {
      proof.syntheticReads.push("detail-preview-read-fixture");
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":${JSON.stringify(proof.build)}}\n1:${JSON.stringify(previewFixture)}\n` });
    }
    return route.fallback();
  });
  // Exact root GETs observed in this isolated fixture have no RSC/prefetch
  // headers and their initiator remains unconfirmed. Never run the real loader.
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    const restore = restoreActions.get(request.headers()["next-action"]);
    if (url.origin === base && ["/visual-fixture/poster", "/visual-fixture/studio"].includes(url.pathname) && request.method() === "POST" && restore) {
      proof.syntheticReads.push(`local-empty-read:${restore}`);
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":${JSON.stringify(proof.build)}}\n1:[]\n` });
    }
    // This exact guarded route only calls buildPremiereFixture (no DB helpers).
    if (url.origin === base && url.pathname === "/api/visual-fixture/premiere" && request.method() === "GET") {
      proof.syntheticReads.push("guarded-premiere-fixture");
      return route.continue();
    }
    if (url.origin === base && url.pathname === "/" && request.method() === "GET") {
      proof.syntheticReads.push(`excluded-public-root-get:${request.resourceType()}:rsc=${request.headers()["rsc"] ?? "0"}:prefetch=${request.headers()["next-router-prefetch"] ?? "0"}`);
      return route.fulfill({ status: 404, contentType: "text/plain", body: "Public root excluded from synthetic fixture QA." });
    }
    return route.fallback();
  });
  await context.route("https://calendar.google.com/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/calendar/r/eventedit") {
      proof.syntheticReads.push("google-calendar-local-navigation-sink");
      return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Synthetic calendar destination</title>" });
    }
    if (request.method() === "GET" && url.pathname === "/favicon.ico") return route.fulfill({ status: 204, body: "" });
    return route.fallback();
  });
  return proof;
}

async function finish(page: Page, info: TestInfo, proof: Awaited<ReturnType<typeof setup>>, facts: unknown) {
  await settlePanelLayout(page);
  await Promise.all(proof.pending);
  expect(proof.errors).toEqual([]);
  expect(proof.rejected, JSON.stringify(proof.syntheticReads)).toEqual([]);
  expect(proof.mutations).toEqual([]);
  expect(proof.liveReads).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0);
  expect(proof.chunks.every(chunk => chunk.served === chunk.local)).toBe(true);
  await info.attach("detail-layout", { body: await page.screenshot(), contentType: "image/png" });
  await info.attach("detail-observation", { body: JSON.stringify({ facts, build: proof.build, syntheticReads: proof.syntheticReads,
    noLiveReadsOrWrites: true, limitations: "Responsive Chromium fixtures; no physical phone, real login or external Google service tested." }), contentType: "application/json" });
}

async function inspect(page: Page) {
  return dialog(page).evaluate(node => {
    const box = (selector: string) => {
      const target = node.querySelector<HTMLElement>(selector);
      if (!target) return null;
      const rect = target.getBoundingClientRect(), style = getComputedStyle(target);
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
        scrollWidth: target.scrollWidth, clientWidth: target.clientWidth, fontSize: style.fontSize,
        weight: style.fontWeight, whiteSpace: style.whiteSpace, ellipsis: style.textOverflow === "ellipsis", nativeHit: Boolean(hit && (target === hit || target.contains(hit))) };
    };
    const rect = node.getBoundingClientRect();
    return { sheet: { x: rect.x, right: rect.right, width: rect.width, height: rect.height, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth },
      title: box(".agenda-detail-title")!, badge: box(".adt-badge"), body: box(".agenda-detail-subs"),
      tags: box(".agenda-detail-tags"), calendar: box('[data-act="add-google-calendar"]'),
      date: box(".agenda-detail-date")!, close: box(".agenda-detail-close")!,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      activeInside: node.contains(document.activeElement), surface: { background: getComputedStyle(node).backgroundColor, blur: getComputedStyle(node).backdropFilter } };
  });
}

function assertLayout(value: Awaited<ReturnType<typeof inspect>>, width: number) {
  expect(value.sheet.x).toBeGreaterThanOrEqual(0);
  expect(value.sheet.right).toBeLessThanOrEqual(width + 1);
  expect(value.sheet.scrollWidth, JSON.stringify(value)).toBeLessThanOrEqual(value.sheet.clientWidth + 1);
  expect(value.pageOverflow).toBe(false);
  expect(value.title.ellipsis).toBe(false);
  expect(value.title.scrollWidth).toBeLessThanOrEqual(value.title.clientWidth + 1);
  expect(value.title.width).toBeGreaterThan(value.sheet.width * .75);
  expect(value.date.bottom).toBeLessThanOrEqual(value.title.y);
  expect(value.close.width).toBeGreaterThanOrEqual(44);
  expect(value.close.height).toBeGreaterThanOrEqual(44);
  expect(value.close.nativeHit).toBe(true);
  expect(value.surface.background).not.toMatch(/rgba\([^)]*,\s*0\./);
  expect(value.surface.blur).toBe("none");
  expect(value.badge).not.toBeNull();
  expect(value.badge!.y).toBeGreaterThanOrEqual(value.title.bottom);
  expect(Math.abs(value.badge!.x - value.title.x)).toBeLessThan(1);
  expect(value.body!.y).toBeGreaterThanOrEqual(value.badge!.bottom);
  expect(value.tags!.y).toBeGreaterThanOrEqual(value.body!.bottom);
  expect(value.calendar!.y).toBeGreaterThan(value.tags!.bottom);
  expect(value.calendar!.height).toBeGreaterThanOrEqual(44);
  expect(value.calendar!.scrollWidth).toBeLessThanOrEqual(value.calendar!.clientWidth + 1);
}

for (const width of [320, 390, 1440]) for (const surface of ["viewer", "preview"] as const) {
  test(`detail ${surface} ${width}: long title rank body tags and native calendar action`, async ({ page, context, baseURL }, info) => {
    test.setTimeout(75_000);
    await page.setViewportSize({ width, height: 1000 });
    const proof = await setup(page, context, baseURL!);
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?detailUX=1" : "/visual-fixture/studio?viewer=1&role=owner&y=2026&m=10");
    const card = page.locator(`${width < 640 ? ".agenda-event" : ".public-event"}[data-eventid="fixture-detail-layout"]`).first();
    await expect(card).toBeVisible();
    await card.click();
    const detail = dialog(page);
    await expect(detail.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(detail.locator(".adt-badge")).toContainText("최고 인기");
    await expect(detail.locator(".agenda-detail-subs li")).toHaveText(lines);
    await expect(detail.locator(".agenda-detail-tags .agenda-detail-tag")).toHaveCount(2);
    await expect(detail.locator('[data-act="copy-event-link"],[data-act="detail-next-event"],[data-act="detail-previous-event"],.agenda-detail-navigation')).toHaveCount(0);
    await settlePanelLayout(page);
    const before = await inspect(page); assertLayout(before, width);
    const calendar = detail.getByRole("link", { name: "Google 캘린더에 추가", exact: true });
    const href = new URL((await calendar.getAttribute("href"))!);
    expect(href.origin).toBe("https://calendar.google.com");
    expect(href.searchParams.get("text")).toBe(title);
    expect(href.searchParams.get("dates")).toBe("20261001T110000Z/20261001T140000Z");
    await expect(calendar).toHaveAttribute("target", "_blank");
    await expect(calendar).toHaveAttribute("rel", /noopener/);
    await calendar.hover(); await settlePanelLayout(page);
    expect((await inspect(page)).sheet.width).toBe(before.sheet.width);
    await calendar.focus();
    const popupPromise = context.waitForEvent("page");
    await page.keyboard.press("Enter");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(new URL(popup.url()).searchParams.get("text")).toBe(title);
    await popup.close();
    const actions = await page.evaluate(() => (window as NativeObservation).detailActivations!.filter(action => action.target === "add-google-calendar"));
    expect(actions).toEqual([{ target: "add-google-calendar", trusted: true }]);
    for (let count = 0; count < 5; count++) {
      await page.keyboard.press("Tab");
      expect(await detail.evaluate(node => node.contains(document.activeElement))).toBe(true);
    }
    await info.attach("open-detail", { body: await detail.screenshot(), contentType: "image/png" });
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0); await expect(card).toBeFocused();
    await card.click(); await expect(detail).toBeVisible(); await settlePanelLayout(page);
    await detail.locator('[data-act="close-detail"]').click();
    await expect(detail).toHaveCount(0); await expect(card).toBeFocused();
    await card.click(); await expect(detail).toBeVisible(); await settlePanelLayout(page);
    await detail.locator('[data-act="close-detail"]').focus(); await page.keyboard.press("Enter");
    await expect(detail).toHaveCount(0); await expect(card).toBeFocused();
    if (surface === "preview") expect(proof.syntheticReads).toContain("detail-preview-read-fixture");
    await finish(page, info, proof, { surface, width, before, sharedReadingOrder: true, singleTrustedCalendarActivation: actions,
      nativeNewTabLocallyFulfilled: true, keyboardTrapAndEscapeReturn: true, pointerAndKeyboardCloseReturn: true, retiredControlsAbsent: true });
  });
}

test("detail support and teaser: actions stay type-specific without empty content cards", async ({ page, context, baseURL }, info) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const proof = await setup(page, context, baseURL!);
  await page.goto("/visual-fixture/poster?supportUX=cozy");
  await page.locator(`.agenda-day[data-flip-key="${getTodayKst()}"]`).scrollIntoViewIfNeeded();
  const board = page.locator(".agenda-support-board");
  await expect(board.locator('.asc-row[data-notice-id="cozy-period-vote"]')).toBeVisible();
  await board.locator('.asc-row[data-notice-id="cozy-period-vote"]').click();
  await board.locator('[data-act="agenda-support-detail"]').click();
  await expect(dialog(page).getByRole("heading")).toHaveText("빅토리의 다음 무대를 응원하는 시청자 인기 투표에 참여해 주세요");
  await expect(dialog(page).locator(".agenda-detail-subs,.adt-badge,.public-event-calendar")).toHaveCount(0);
  await expect(dialog(page).locator('[data-act="agenda-link"]')).toHaveAttribute("href", "https://example.com/period-vote");
  expect(await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.keyboard.press("Escape");
  await page.goto("/visual-fixture/poster?teaser=600");
  await page.locator('.agenda [data-eventid="00000000-0000-4000-8000-000000000001"]').first().click();
  await expect(dialog(page)).toHaveClass(/is-teaser/);
  await expect(dialog(page).locator(".agenda-detail-heading,.agenda-detail-footer,.agenda-detail-subs")).toHaveCount(0);
  await expect(dialog(page).locator('[data-act="dt-hope"]')).toBeVisible();
  await expect(dialog(page).locator('[data-act="add-google-calendar"]')).toHaveCount(0);
  await finish(page, info, proof, { supportWholeTitleAndOriginalLink: true, supportHasNoCalendarOrRank: true,
    unreleasedTeaserNoTitleTagsOrCalendar: true, noEmptyBodyCard: true });
});
