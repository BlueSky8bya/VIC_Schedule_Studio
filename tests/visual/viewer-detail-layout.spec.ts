import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { getTodayKst } from "@/lib/calendar/month";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { companionTraceMode } from "./helpers/companion-evidence-policy";
test.use({ serviceWorkers: "block", video: "on", trace: companionTraceMode() });

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

async function setup(page: Page, context: BrowserContext, base: string, previewData = previewFixture) {
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
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":${JSON.stringify(proof.build)}}\n1:${JSON.stringify(previewData)}\n` });
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
      metadata: box(".agenda-detail-metadata"), tags: box(".agenda-detail-tags"), calendar: box('[data-act="add-google-calendar"]'),
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
  expect(value.metadata!.y).toBeGreaterThanOrEqual(value.title.bottom);
  expect(value.badge!.right).toBeGreaterThan(value.tags!.right);
  expect(value.tags!.right + 4).toBeLessThanOrEqual(value.badge!.x);
  expect(value.body!.y).toBeGreaterThanOrEqual(value.metadata!.bottom);
  expect(value.calendar!.y).toBeGreaterThan(value.body!.bottom);
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

const metadataCases = ["many", "long", "tags-only", "rank-only", "empty", "single"] as const;
const stressTags = samplePublicScheduleData.tags.map((tag, i) => ({ ...tag,
  displayName: i === 0 ? "아주긴태그이름으로줄바꿈과인기도충돌여부를확인합니다".repeat(3) : tag.displayName
}));
const stressFixture = { ...previewFixture, tags: stressTags, events: metadataCases.map((kind, i) => ({
  ...previewFixture.events[0], id: `fixture-meta-${kind}`, startsAt: `2026-10-${String(i + 1).padStart(2, "0")}T20:00:00+09:00`, endsAt: `2026-10-${String(i + 1).padStart(2, "0")}T23:00:00+09:00`,
  heartCount: kind === "tags-only" || kind === "empty" ? 0 : 45,
  tagIds: kind === "rank-only" || kind === "empty" ? [] : kind === "many" ? stressTags.map(t => t.id) : kind === "long" ? [stressTags[0].id] : ["tag-full-track"],
  primaryTagIds: kind === "rank-only" || kind === "empty" ? [] : [kind === "many" || kind === "long" ? stressTags[0].id : "tag-full-track"]
})) };

for (const [width, theme] of [[320, "light"], [390, "dark"], [1440, "light"], [1920, "dark"]] as const)
test(`detail metadata preview ${width} ${theme}: many long missing tags and rank never overlap`, async ({ page, context, baseURL }, info) => {
  test.setTimeout(110_000);await page.setViewportSize({ width, height: 1000 });
  const proof = await setup(page, context, baseURL!, stressFixture);
  await context.addInitScript(theme => { localStorage.setItem("vic.dark", theme === "dark" ? "on" : "off"); }, theme);
  await page.goto("/visual-fixture/studio?viewer=1&role=owner&y=2026&m=10");await settlePanelLayout(page);
  if (theme === "dark") await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  else await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  const filterBounds = await page.locator(".avatar-slot .public-legend-vertical .legend-item").evaluateAll(nodes => nodes.map(node => {
    const n = node as HTMLElement, group = n.closest(".public-legend-vertical")!, a = n.getBoundingClientRect(), b = group.getBoundingClientRect(), p = n.closest(".avatar-slot")!.getBoundingClientRect();
    return { x:a.x, right:a.right, groupX:b.x, groupRight:b.right, panelX:p.x, panelRight:p.right, overflow:n.scrollWidth>n.clientWidth+1 };
  }));
  if (width >= 1680) expect(filterBounds.length).toBeGreaterThan(0);
  for (const b of filterBounds) {expect(b.overflow).toBe(false);expect(b.x).toBeGreaterThanOrEqual(b.groupX);expect(b.right).toBeLessThanOrEqual(b.groupRight);expect(b.groupX).toBeGreaterThanOrEqual(b.panelX - 1);expect(b.groupRight).toBeLessThanOrEqual(b.panelRight + 1);}
  const facts = [];
  for (const kind of metadataCases) {
    const card = page.locator(`${width < 640 ? ".agenda-event" : ".public-event"}[data-eventid="fixture-meta-${kind}"]`).first();
    await card.click();const detail = dialog(page);await expect(detail).toBeVisible();await settlePanelLayout(page);
    const hasTags = kind !== "rank-only" && kind !== "empty", hasRank = kind !== "tags-only" && kind !== "empty";
    await expect(detail.locator(".agenda-detail-tag")).toHaveCount(hasTags ? kind === "many" ? stressTags.length : 1 : 0);
    await expect(detail.locator(".adt-badge")).toHaveCount(hasRank ? 1 : 0);
    await expect(detail.locator(".agenda-detail-metadata")).toHaveCount(hasTags || hasRank ? 1 : 0);
    const toggle=detail.getByRole("button",{name:"태그 펼치기",exact:true});
    if (kind === "many" || kind === "long") {
      await expect(toggle).toBeVisible();await expect(toggle).toHaveAttribute("aria-expanded","false");
      const folded=await detail.locator(".agenda-detail-tags").evaluate(n=>({height:n.getBoundingClientRect().height,row:Number.parseFloat(getComputedStyle(n).maxHeight)}));
      expect(folded.height).toBeLessThanOrEqual(folded.row+1);expect(folded.row).toBeLessThanOrEqual(36);
      await info.attach(`folded-${kind}`,{body:await detail.screenshot(),contentType:"image/png"});
      await toggle.click();const fold=detail.getByRole("button",{name:"태그 접기",exact:true});await expect(fold).toHaveAttribute("aria-expanded","true");
      await fold.focus();await page.keyboard.press("Space");await expect(toggle).toHaveAttribute("aria-expanded","false");await page.keyboard.press("Enter");await expect(fold).toHaveAttribute("aria-expanded","true");
    } else await expect(detail.locator(".agenda-detail-tags-toggle")).toHaveCount(0);
    const layout = await detail.evaluate(node => {
      const rect = (n: Element) => {const r = n.getBoundingClientRect();return { x:r.x, right:r.right, y:r.y, bottom:r.bottom, height:r.height };};
      const tags = [...node.querySelectorAll<HTMLElement>(".agenda-detail-tag")], rank = node.querySelector(".adt-badge"), meta = node.querySelector(".agenda-detail-metadata");
      return { sheetOverflow:node.scrollWidth>node.clientWidth+1, pageOverflow:document.documentElement.scrollWidth>innerWidth+1,
        meta:meta ? rect(meta) : null, rank:rank ? rect(rank) : null,
        tags:tags.map(t => ({...rect(t),text:t.textContent,overflow:t.scrollWidth>t.clientWidth+1})),
        body:rect(node.querySelector(".agenda-detail-subs")!), title:rect(node.querySelector(".agenda-detail-title")!) };
    });
    expect(layout.sheetOverflow).toBe(false);expect(layout.pageOverflow).toBe(false);
    for (const t of layout.tags) {
      expect(t.overflow, t.text ?? "tag").toBe(false);
      expect(t.x).toBeGreaterThanOrEqual(layout.meta!.x);expect(t.right).toBeLessThanOrEqual(layout.meta!.right);
      if (layout.rank) expect(t.right + 4).toBeLessThanOrEqual(layout.rank.x);
    }
    if (layout.meta) {expect(layout.meta.y).toBeGreaterThanOrEqual(layout.title.bottom);expect(layout.body.y).toBeGreaterThanOrEqual(layout.meta.bottom);}
    if (kind === "many") expect(new Set(layout.tags.map(t => Math.round(t.y))).size).toBeGreaterThan(1);
    if (kind === "long") {expect(layout.tags[0].text).toBe(stressTags[0].displayName);expect(layout.tags[0].height).toBeGreaterThan(40);}
    if (kind === "many" || kind === "long" || kind === "empty") await info.attach(`metadata-${kind}`, { body:await detail.screenshot(),contentType:"image/png" });
    const link=detail.getByRole("link",{name:"Google 캘린더에 추가",exact:true});await expect(link).toBeVisible();await link.focus();await page.keyboard.press("Tab");expect(await detail.evaluate(n=>n.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");await expect(detail).toHaveCount(0);await expect(card).toBeFocused();facts.push({kind,layout});
  }
  await finish(page, info, proof, {width,theme,facts,filterBounds,sharedPreviewComponent:true,syntheticTagStress:true,emptyMetadataOmitted:true,limits:"Long/many metadata scenarios execute through the same public poster in credential-free preview; viewer's ordinary two-tag and all-tier paths run separately."});
});

test("detail tag disclosure: same open instance responds to resize without sticky overflow", async ({page,context,baseURL},info) => {
  const name="반가운가을방송소식안내예고";
  const fixture={...previewFixture,tags:previewFixture.tags.map(t=>({...t,displayName:name})),events:[{...previewFixture.events[0],tagIds:["tag-full-track"],primaryTagIds:["tag-full-track"]}]};
  // Stay within the same agenda topology; switching desktop/agenda remounts
  // the existing studio preview and closes its detail independently of tags.
  await page.setViewportSize({width:390,height:1000});const proof=await setup(page,context,baseURL!,fixture);
  await page.goto("/visual-fixture/studio?viewer=1&role=owner&y=2026&m=10");await settlePanelLayout(page);
  await page.locator('.agenda-event[data-eventid="fixture-detail-layout"]').first().click();const detail=dialog(page);await settlePanelLayout(page);
  const group=detail.locator(".agenda-detail-tag-group"),toggle=detail.getByRole("button",{name:"태그 펼치기",exact:true});
  await group.evaluate(n=>n.setAttribute("data-resize-canary","same"));await expect(toggle).toHaveCount(0);
  await page.setViewportSize({width:320,height:1000});await settlePanelLayout(page);await expect(toggle).toBeVisible();
  await expect(group).toHaveAttribute("data-resize-canary","same");await expect(detail.locator(".agenda-detail-tags")).toHaveCSS("max-height","36px");
  await toggle.click();await expect(detail.locator(".agenda-detail-tag-label")).toHaveText(name);await detail.getByRole("button",{name:"태그 접기",exact:true}).click();
  await page.setViewportSize({width:390,height:1000});await settlePanelLayout(page);await expect(toggle).toHaveCount(0);await expect(group).toHaveAttribute("data-resize-canary","same");
  await page.keyboard.press("Escape");await expect(detail).toHaveCount(0);
  await finish(page,info,proof,{sameInstance:true,widths:[390,320,390],toggleOnlyWhenOverflow:true,expandedFullText:true,limits:"Same agenda topology only; crossing desktop/agenda remount closes the existing preview detail."});
});

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
  await expect(dialog(page).locator(".agenda-detail-heading,.agenda-detail-metadata,.agenda-detail-footer,.agenda-detail-subs")).toHaveCount(0);
  await expect(dialog(page).locator('[data-act="dt-hope"]')).toBeVisible();
  await expect(dialog(page).locator('[data-act="add-google-calendar"]')).toHaveCount(0);
  await finish(page, info, proof, { supportWholeTitleAndOriginalLink: true, supportHasNoCalendarOrRank: true,
    unreleasedTeaserNoTitleTagsOrCalendar: true, noEmptyBodyCard: true });
});
