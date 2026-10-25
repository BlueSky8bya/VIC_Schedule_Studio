import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { supportContextFixture } from "@/app/visual-fixture/support-context";
import { getTodayKst, nowKstHm } from "@/lib/calendar/month";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

// A feature folder follows scripts/scratch-retention's 14-day policy. A fresh
// run folder preserves failures and never overwrites a previous receipt.
const artifacts = resolve(".scratch-pw/mobile-support-context", `${getTodayKst()}-${nowKstHm().replace(":", "")}-${process.pid}`);
const expectedNotices = [
  { id: "cozy-period-vote", title: "빅토리의 다음 무대를 응원하는 시청자 인기 투표에 참여해 주세요", url: "https://example.com/period-vote", kind: "period" },
  { id: "cozy-period-goods", title: "가을 한정 굿즈 사전 신청과 배송 일정 안내를 확인해 주세요", url: "https://example.com/period-goods", kind: "period" },
  { id: "cozy-support", title: "새 방송 코너에서 함께 나눌 시청자 여러분의 사연을 모집합니다", url: "https://example.com/support", kind: "up" }
];
type Receipt = { mutations: string[]; errors: string[]; previewReads: number; actionRequests: { path: string; id: string; exportedName: string }[]; measurements: Record<string, unknown> };
const receipts = new WeakMap<Page, Receipt>();
const hostOf = (page: Page) => page.locator(".agenda-with-notices:visible");
const boardOf = (page: Page) => hostOf(page).locator(".agenda-support-board");
const rowsOf = (page: Page) => boardOf(page).locator(".asc-stack > .asc-row[data-notice-id]");
const round = (n: number) => Math.round(n * 1000) / 1000;

test.beforeEach(async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  const receipt: Receipt = { mutations: [], errors: [], previewReads: 0, actionRequests: [], measurements: {} };
  receipts.set(page, receipt);
  page.on("pageerror", error => receipt.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const readActions = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  const anonHeartReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getAnonHeartIdsAction").map(([id]) => id));
  expect(readActions.size).toBe(1);
  expect(anonHeartReads.size).toBe(1);
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    const actionId = request.headers()["next-action"];
    if (request.method() === "POST") receipt.actionRequests.push({ path: url.pathname, id: actionId ?? "", exportedName: manifest[actionId]?.exportedName ?? "unknown" });
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && readActions.has(request.headers()["next-action"])) {
      receipt.previewReads++;
      const fixture = supportContextFixture();
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify({ ...samplePublicScheduleData, events: fixture.events })}\n` });
    }
    // Verified against the built action manifest and the preserved retry1
    // request: anonymous heart restoration is a read over POST transport.
    // Answer it locally; the real action never executes or reaches Supabase.
    if (request.method() === "POST" && url.pathname === "/visual-fixture/poster" && anonHeartReads.has(actionId)) {
      return route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":[],"b":"fixture"}\n1:[]\n' });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      receipt.mutations.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, body: "" });
    }
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});

test.afterEach(async ({ page }, testInfo) => {
  const name = testInfo.titlePath.join("-").replace(/[^a-zA-Z0-9-]+/g, "-");
  const receipt = receipts.get(page)!;
  writeFileSync(resolve(artifacts, `${name}.json`), JSON.stringify({ status: testInfo.status, ...receipt }, null, 2));
  if (!page.isClosed()) await page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: false });
  expect(receipt.mutations).toEqual([]);
  expect(receipt.errors).toEqual([]);
});

async function seed(page: Page, reduced = false, dark = false) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(({ key, epoch, preferences, reduced, dark }) => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.dark", dark ? "on" : "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: false }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, reduced, dark });
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
}

async function geometry(page: Page) {
  return hostOf(page).evaluate(node => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
    };
    const board = node.querySelector<HTMLElement>(".agenda-support-board")!;
    const rows = [...board.querySelectorAll<HTMLElement>(".asc-stack > .asc-row[data-notice-id]")];
    const hearts = [...node.querySelectorAll<HTMLElement>(".agenda-heart")];
    const overlap = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return {
      scrollY, pageWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      readingDate: board.dataset.readingDate, board: rect(board), stack: rect(board.querySelector(".asc-stack")!),
      rows: rows.map(row => {
        const title = row.querySelector<HTMLElement>(".asc-title")!, style = getComputedStyle(title);
        const textRange = document.createRange(); textRange.selectNodeContents(title);
        const ink = [...textRange.getClientRects()], box = title.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const nativeHit = document.elementFromPoint(rowRect.x + rowRect.width / 2, rowRect.y + rowRect.height / 2);
        return { id: row.dataset.noticeId, title: title.textContent, ...rect(row),
          titleClip: title.scrollWidth > title.clientWidth + 1 || title.scrollHeight > title.clientHeight + 1,
          overflow: style.overflow, ellipsis: style.textOverflow, clamp: style.webkitLineClamp,
          allInkInside: ink.every(r => r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1),
          nativeHit: Boolean(nativeHit && (nativeHit === row || row.contains(nativeHit))),
          rawOverlapsHeart: hearts.some(heart => overlap(rowRect, heart.getBoundingClientRect()) > 0),
          overlapsHeart: hearts.some(heart => {
            const h = heart.getBoundingClientRect();
            if (overlap(rowRect, h) === 0) return false;
            // A sticky board is meant to occlude earlier cards. Detect a heart
            // actually painting/hit-testing above its title, not hidden ink.
            const hit = document.elementFromPoint((Math.max(rowRect.left, h.left) + Math.min(rowRect.right, h.right)) / 2,
              (Math.max(rowRect.top, h.top) + Math.min(rowRect.bottom, h.bottom)) / 2);
            return Boolean(hit && (hit === heart || heart.contains(hit)));
          }) };
      }),
      cards: [...node.querySelectorAll<HTMLElement>(".agenda-event[data-eventid]")].map(card => ({ id: card.dataset.eventid, ...rect(card) })),
      heartCount: hearts.length,
      footer: [...board.querySelectorAll<HTMLElement>(".asc-detail > *")].map(el => ({ ...rect(el), right: el.getBoundingClientRect().right })),
      detailTransform: getComputedStyle(board.querySelector(".asc-detail")!).transform
    };
  });
}

type Geometry = Awaited<ReturnType<typeof geometry>>;

function assertReadable(g: Geometry) {
  expect(g.scrollWidth).toBeLessThanOrEqual(g.pageWidth + 1);
  expect(g.rows.map(row => [row.id, row.title])).toEqual(expectedNotices.map(item => [item.id, item.title]));
  expect(g.board.x).toBeGreaterThanOrEqual(0);
  expect(g.board.x + g.board.width).toBeLessThanOrEqual(g.pageWidth + 1);
  expect(g.cards.length).toBeGreaterThan(3);
  for (const [index, row] of g.rows.entries()) {
    expect(row.titleClip, row.id).toBe(false);
    expect(row.allInkInside, row.id).toBe(true);
    expect(row.ellipsis, row.id).not.toBe("ellipsis");
    expect(["none", "0", ""], row.id).toContain(row.clamp);
    expect(row.overlapsHeart, row.id).toBe(false);
    expect(row.nativeHit, row.id).toBe(true);
    expect(row.height, row.id).toBeGreaterThanOrEqual(44);
    expect(Math.abs(row.width - g.stack.width), row.id).toBeLessThan(1);
    if (index) expect(row.y).toBeGreaterThanOrEqual(g.rows[index - 1].y + g.rows[index - 1].height - .5);
  }
  for (const [index, footer] of g.footer.entries()) {
    expect(footer.x).toBeGreaterThanOrEqual(g.board.x);
    expect(footer.right).toBeLessThanOrEqual(g.board.x + g.board.width);
    if (index) expect(footer.x).toBeGreaterThanOrEqual(g.footer[index - 1].right - .5);
  }
}

function assertStable(before: Geometry, after: Geometry, sameScroll = true) {
  expect(Math.abs(after.board.height - before.board.height)).toBeLessThan(.5);
  if (sameScroll) expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThan(.5);
  expect(after.cards.map(card => card.id)).toEqual(before.cards.map(card => card.id));
  for (const [index, card] of after.cards.entries()) {
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(card[key] - before.cards[index][key]), `${card.id} ${key}`).toBeLessThan(.5);
    }
  }
}

async function sampleSelection(page: Page, row: Locator) {
  await hostOf(page).evaluate(node => {
    type Frame = { ms: number; scrollY: number; boardHeight: number; cardX: number; cardY: number; cardWidth: number; transform: string };
    const win = window as unknown as { __cozyFrames: Promise<Frame[]> };
    win.__cozyFrames = new Promise(resolveFrames => {
      node.addEventListener("click", () => {
        const frames: Frame[] = [], start = performance.now();
        const tick = () => {
          const board = node.querySelector(".agenda-support-board")!, card = node.querySelector(".agenda-event[data-eventid]")!;
          const r = card.getBoundingClientRect(), ms = performance.now() - start;
          frames.push({ ms, scrollY, boardHeight: board.getBoundingClientRect().height, cardX: r.x, cardY: r.y + scrollY, cardWidth: r.width,
            transform: getComputedStyle(board.querySelector(".asc-detail")!).transform });
          if (ms < 650) requestAnimationFrame(tick); else resolveFrames(frames);
        };
        requestAnimationFrame(tick);
      }, { once: true, capture: true });
    });
  });
  await row.tap();
  return page.evaluate(async () => (window as unknown as { __cozyFrames: Promise<{ ms: number; scrollY: number; boardHeight: number; cardX: number; cardY: number; cardWidth: number; transform: string }[]> }).__cozyFrames);
}

async function wheelToDate(page: Page, date: string) {
  const day = hostOf(page).locator(`.agenda-day[data-flip-key="${date}"]`);
  await expect(day).toHaveCount(1);
  for (let attempt = 0; attempt < 8; attempt++) {
    const target = await day.boundingBox(), board = await boardOf(page).boundingBox();
    const delta = target!.y - board!.y - board!.height - 12;
    if (Math.abs(delta) < 2) break;
    const viewport = page.viewportSize()!;
    // The right rail owns its own scroller; wheel over the schedule column.
    await page.mouse.move(viewport.width * .4, viewport.height * .82);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(230);
  }
  receipts.get(page)!.measurements[`wheel-${date}`] = await day.evaluate(node => {
    const host = node.closest(".agenda-with-notices")!, board = host.querySelector<HTMLElement>(".agenda-support-board")!;
    return { scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight, targetTop: node.getBoundingClientRect().top,
      boardBottom: board.getBoundingClientRect().bottom, readingDate: board.dataset.readingDate,
      focusedClass: document.activeElement?.className };
  });
  await expect(boardOf(page)).toHaveAttribute("data-reading-date", date);
  await settle(page);
}

async function openCozy(page: Page, path: string) {
  await page.goto(path);
  await expect(hostOf(page)).toHaveCount(1);
  await expect(rowsOf(page)).toHaveCount(3);
  await settle(page);
  // The initial fallback is today, but a month begins with older rows. Align
  // the actual reading position before checking selection/focusout stability.
  await wheelToDate(page, supportContextFixture().focusDate);
}

async function leaveBoardFocus(page: Page) {
  // Context intentionally stays pinned while changing it would remove a focused
  // row or footer action. Use real keyboard navigation to leave that context.
  for (let i = 0; i < 8 && await boardOf(page).evaluate(node => node.contains(document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect.poll(() => boardOf(page).evaluate(node => node.contains(document.activeElement))).toBe(false);
}

const surfaces = [
  { name: "anonymous", path: "/visual-fixture/poster?supportUX=cozy", edit: false },
  { name: "signed-in", path: "/visual-fixture/poster?supportUX=cozy&signedIn=1", edit: false },
  { name: "owner", path: "/visual-fixture/studio?supportUX=cozy&role=owner", edit: true },
  { name: "developer", path: "/visual-fixture/studio?supportUX=cozy&role=developer", edit: true },
  { name: "preview", path: "/visual-fixture/studio?supportUX=cozy&role=owner&viewer=1", edit: false }
];

for (const width of [320, 390]) test.describe(`mobile${width}`, () => {
  test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

  for (const surface of surfaces) test(`${surface.name}-three-overlaps-and-scroll-stability`, async ({ page }) => {
    test.setTimeout(90_000);
    await seed(page);
    await openCozy(page, surface.path);
    const receipt = receipts.get(page)!;
    const before = await geometry(page);
    receipt.measurements.initial = before;
    assertReadable(before);
    if (!surface.edit) expect(before.heartCount).toBeGreaterThan(0);
    await expect(boardOf(page).locator('[data-act="m-support-edit"]')).toHaveCount(surface.edit ? 1 : 0);
    await page.screenshot({ path: resolve(artifacts, `${width}-${surface.name}-three-overlaps.png`) });

    // Goods/up/vote each change metadata; no schedule geometry may move during
    // any frame of the real shared 520 ms spring.
    const summaries = [];
    for (const item of [expectedNotices[1], expectedNotices[2], expectedNotices[0]]) {
      const frames = await sampleSelection(page, boardOf(page).locator(`.asc-row[data-notice-id="${item.id}"]`));
      await expect(boardOf(page).locator(`.asc-row[data-notice-id="${item.id}"]`)).toHaveAttribute("aria-pressed", "true");
      await expect(boardOf(page).locator(".asc-detail")).toHaveAttribute("data-kind", item.kind);
      const link = boardOf(page).locator("a.asc-link");
      await expect(link).toHaveAttribute("href", item.url);
      await expect(link).toHaveAttribute("target", "_blank");
      expect((await link.getAttribute("rel"))?.split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
      const source = supportContextFixture().events.find(event => event.id === item.id)!;
      const short = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
      await expect(boardOf(page).locator(".asc-range")).toHaveText(`${short(source.startsAt.slice(0, 10))}–${short(source.endDateKey!)}`);
      expect(frames.at(-1)!.ms).toBeGreaterThanOrEqual(520);
      expect(frames.some(frame => frame.transform !== "none")).toBe(true);
      const first = before.cards[0];
      for (const frame of frames) {
        expect(Math.abs(frame.scrollY - before.scrollY)).toBeLessThan(.5);
        expect(Math.abs(frame.boardHeight - before.board.height)).toBeLessThan(.5);
        expect(Math.abs(frame.cardX - first.x)).toBeLessThan(.5);
        expect(Math.abs(frame.cardY - first.y)).toBeLessThan(.5);
        expect(Math.abs(frame.cardWidth - first.width)).toBeLessThan(.5);
      }
      const after = await geometry(page); assertStable(before, after); assertReadable(after);
      summaries.push({ id: item.id, frames: frames.length, lastMs: round(frames.at(-1)!.ms), animatedFrames: frames.filter(frame => frame.transform !== "none").length });
    }
    receipt.measurements.selection = summaries;

    if (!surface.edit) {
      const opener = boardOf(page).locator('[data-act="agenda-support-detail"]');
      await opener.tap();
      const detailTitle = page.locator(".agenda-detail-title");
      await expect(detailTitle).toHaveText(expectedNotices[0].title);
      // Mobile's existing close control is its grabber; the X class belongs to
      // the desktop popover. Exercise the actual accessible mobile control.
      await page.getByRole("dialog", { name: "일정 상세" }).getByRole("button", { name: "닫기", exact: true }).tap();
      await expect(detailTitle).toHaveCount(0);
      await expect(opener).toBeFocused();
      const afterDetail = await geometry(page);
      assertStable(before, afterDetail);
      receipt.measurements.detail = { title: expectedNotices[0].title, restoredFooterFocus: true, afterClose: afterDetail };
    }

    const fixture = supportContextFixture();
    const nextDate = fixture.events.find(event => event.id === "cozy-period-vote")!.endDateKey!;
    await leaveBoardFocus(page);
    await wheelToDate(page, nextDate);
    const scrolled = await geometry(page);
    receipt.measurements.scrolled = scrolled;
    expect(scrolled.scrollY).toBeGreaterThan(before.scrollY + 20);
    assertStable(before, scrolled, false); assertReadable(scrolled);

    if (surface.edit) {
      await boardOf(page).getByRole("button", { name: "수정", exact: true }).tap();
      const dialog = page.locator('.m-edit-sheet[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".m-edit-head strong")).toHaveText("수정");
      const titleInput = dialog.locator(".me-title");
      await expect(titleInput).toHaveValue(expectedNotices[0].title);
      await dialog.locator('[data-act="close-mobile-edit"]').tap();
      await expect(dialog).toHaveCount(0);
    }

    const oneDay = fixture.events.find(event => event.id === "cozy-one-day")!.startsAt.slice(0, 10);
    await leaveBoardFocus(page);
    await wheelToDate(page, oneDay);
    await expect(rowsOf(page)).toHaveCount(1);
    await expect(rowsOf(page)).toHaveAttribute("data-notice-id", "cozy-one-day");
    await expect(boardOf(page).locator(".asc-range")).toHaveCount(0);
    const single = await geometry(page);
    receipt.measurements.singleDay = single;
    assertStable(before, single, false);
    if (surface.name === "preview") expect(receipt.previewReads).toBe(1);
  });

  test("app-reduced-motion-and-focused-link-context", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, true, true);
    await openCozy(page, "/visual-fixture/poster?supportUX=cozy&signedIn=1");
    await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
    await expect(boardOf(page)).toHaveAttribute("data-reduced", "true");
    const before = await geometry(page);
    const frames = await sampleSelection(page, boardOf(page).locator('.asc-row[data-notice-id="cozy-period-goods"]'));
    expect(frames.every(frame => frame.transform === "none")).toBe(true);
    assertStable(before, await geometry(page));
    const link = boardOf(page).locator("a.asc-link");
    await link.focus();
    await expect(link).toBeFocused();
    const date = await boardOf(page).getAttribute("data-reading-date");
    const href = await link.getAttribute("href");
    await page.mouse.move(width * .4, 700);
    await page.mouse.wheel(0, 220);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before.scrollY + 20);
    await page.waitForTimeout(250);
    await expect(boardOf(page)).toHaveAttribute("data-reading-date", date!);
    await expect(link).toHaveAttribute("href", href!);
    await expect(link).toBeFocused();
    const focused = await geometry(page);
    assertStable(before, focused, false);
    await page.keyboard.press("Tab");
    await expect(boardOf(page)).not.toHaveAttribute("data-reading-date", date!);
    receipts.get(page)!.measurements = { before, focused, reducedFrames: frames.length, afterBlur: await geometry(page) };
  });
});

test.describe("mobile390-hidden-support", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("masked-notice-opens-existing-password-gate-without-leaking-title-or-link", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, true);
    const roles = [];
    for (const role of ["owner", "developer"]) {
      await openCozy(page, `/visual-fixture/studio?supportUX=cozy&role=${role}`);
      await expect(boardOf(page).locator('[data-notice-id="cozy-hidden-support"]')).toHaveCount(0);
      const masked = hostOf(page).locator('.agenda-event[data-eventid="cozy-hidden-support"]');
      await expect(masked).toContainText("???");
      await expect(hostOf(page).getByText("STUDIO_HIDDEN_SUPPORT_CANARY", { exact: false })).toHaveCount(0);
      await expect(hostOf(page).locator('a[href="https://example.com/hidden-support"]')).toHaveCount(0);
      expect((await masked.getAttribute("aria-label")) ?? "").not.toContain("STUDIO_HIDDEN_SUPPORT_CANARY");
      await masked.tap();
      const dialog = page.locator('.m-edit-sheet[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".teaser-gate-sheet .teaser-gate")).toBeVisible();
      await expect(dialog.getByLabel("비공개 레이어 비밀번호")).toBeVisible();
      await expect(dialog.locator('input[type="password"]')).toHaveValue("");
      await expect(dialog.locator('[data-act="teaser-gate-submit"]')).toBeDisabled();
      await expect(dialog.locator(".me-title")).toHaveCount(0);
      await expect(dialog).not.toContainText("STUDIO_HIDDEN_SUPPORT_CANARY");
      await expect(dialog.locator('a[href="https://example.com/hidden-support"]')).toHaveCount(0);
      roles.push({ role, maskedTitle: await masked.textContent(), passwordGate: true, editorForm: false });
      await dialog.locator('[data-act="close-mobile-edit"]').tap();
      await expect(dialog).toHaveCount(0);
    }
    receipts.get(page)!.measurements.hiddenSupport = roles;
  });
});
