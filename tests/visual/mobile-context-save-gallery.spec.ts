import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTodayKst, nowKstHm } from "@/lib/calendar/month";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

// Before is an observation, never a PASS for the known date-reading defect.
const phase = process.env.CONTEXT_GALLERY_PHASE ?? "after";
if (phase !== "before" && phase !== "after") throw new Error("CONTEXT_GALLERY_PHASE must be before or after");
const baseURL = process.env.CONTEXT_GALLERY_BASE_URL ?? "http://127.0.0.1:3100";
const origin = new URL(baseURL).origin;
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname)) throw new Error("Gallery requires a loopback synthetic-fixture server");
const artifacts = resolve(".scratch-pw/mobile-reading", `${phase}-${getTodayKst()}-${nowKstHm().replace(":", "")}-${process.pid}-${Date.now()}`);
const today = "2026-10-20", yesterday = "2026-10-19", eventId = "reading-stream-20-a";
const active20 = ["reading-goods", "reading-story", "reading-vote"].sort();
const active19 = ["reading-ended-19", "reading-goods", "reading-vote"].sort();
const endedURL = "https://example.com/ended-19";
type Write = { op?: string; payload?: { id?: string; dateKey?: string; publicTitle?: string; visibilityScope?: string } };
type Proof = {
  buildManifestSha256: string;
  writes: Write[];
  blockedMutations: string[];
  pageErrors: string[];
  probes: Record<string, unknown>;
  states: Record<string, unknown>;
  screenshots: string[];
  release?: (ok: boolean) => void;
};
const proofs = new WeakMap<Page, Proof>();
const root = (page: Page) => page.locator(".studio-mobile");
const board = (page: Page) => root(page).locator(".agenda-support-board");
const flow = (page: Page) => root(page).locator(".agenda-flow");
const feedback = (page: Page) => root(page).locator(".mobile-save-feedback");
const status = (page: Page) => root(page).locator(".m-settings-slot [role=status]");
const editor = (page: Page) => page.locator('.m-edit-sheet[role="dialog"]');
const editable = (page: Page) => flow(page).locator(`.agenda-event[data-eventid="${eventId}"]`);

test.use({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  const manifest = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"));
  const proof: Proof = {
    buildManifestSha256: createHash("sha256").update(manifest).digest("hex"),
    writes: [], blockedMutations: [], pageErrors: [], probes: {}, states: {}, screenshots: []
  };
  proofs.set(page, proof);
  page.on("pageerror", error => proof.pageErrors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method());
    if (url.origin !== origin) {
      if (mutation) proof.blockedMutations.push(`${request.method()} external:${url.pathname}`);
      return route.abort();
    }
    if (request.method() === "POST" && url.pathname === "/api/studio-write") {
      let body: Write | undefined;
      try { body = request.postDataJSON() as Write; } catch { /* Fail closed below. */ }
      // Exercise the real client queue/form/recovery. Never execute a server
      // action or DB write, and never accept an arbitrary fixture event.
      if (body?.op === "save" && body.payload?.id === eventId && body.payload.visibilityScope === "public"
        && /^(합성|검증)/.test(body.payload.publicTitle ?? "")) {
        if (proof.release) throw new Error("Unexpected concurrent gallery write");
        proof.writes.push(body);
        const ok = await new Promise<boolean>(release => { proof.release = release; });
        proof.release = undefined;
        return route.fulfill({ status: ok ? 200 : 403, json: ok ? { ok: true, id: eventId } : { ok: false, error: "합성 저장 실패" } });
      }
    }
    // These tests stay in the actual owner/developer surface. No preview read
    // Server Action is required or allowlisted; all unexpected POSTs fail.
    if (mutation) {
      proof.blockedMutations.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, body: "Synthetic gallery rejected an unknown mutation" });
    }
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { isLive: false } });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "Synthetic gallery blocks live API reads" });
    return route.continue();
  });
  await page.addInitScript(({ key, epoch, preferences }) => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.reduceMotion", "on"); localStorage.setItem("vic.dark", "on");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: false }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES });
});

test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  proof.release?.(false);
  const name = info.titlePath.join("-").replace(/[^a-zA-Z0-9-]+/g, "-");
  const passed = info.status === "passed" && proof.blockedMutations.length === 0 && proof.pageErrors.length === 0;
  // Keep the raw observation even when a semantic assertion fails.
  writeFileSync(resolve(artifacts, `${name}.json`), JSON.stringify({
    phase, status: info.status,
    verdict: phase === "before" ? "baseline_observation" : passed ? "verified_after" : "failed_after",
    readingCorrectnessPassed: phase === "after" && passed,
    syntheticWritesOnly: true, realLogin: false, physicalDevice: false,
    ...proof, release: undefined
  }, null, 2), { flag: "wx" });
  if (!page.isClosed()) await page.screenshot({ path: resolve(artifacts, `${name}-final.png`) });
  expect(proof.blockedMutations, "No unrecognised mutation may reach a server").toEqual([]);
  expect(proof.pageErrors).toEqual([]);
});

/** Capture in the browser immediately after two render frames. No 180ms sleep
 * or retrying date assertion may conceal a delayed reading-context update. */
async function measure(page: Page, anchor?: { date: string; top: number }) {
  return root(page).evaluate(async (surface, anchor) => {
    const flow = surface.querySelector<HTMLElement>(".agenda-flow")!;
    const board = surface.querySelector<HTMLElement>(".agenda-support-board")!;
    const header = surface.querySelector<HTMLElement>(".agenda-header")!;
    const footer = surface.querySelector<HTMLElement>(".m-actionrail")!;
    const started = performance.now();
    if (anchor) {
      const day = flow.querySelector<HTMLElement>(`.agenda-day[data-flip-key="${anchor.date}"]`);
      if (!day) throw new Error(`Missing synthetic day ${anchor.date}`);
      flow.scrollTo({ top: flow.scrollTop + day.getBoundingClientRect().top - flow.getBoundingClientRect().top - anchor.top, behavior: "instant" });
    }
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await frame(); await frame();
    const bounds = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const f = flow.getBoundingClientRect(), h = header.getBoundingClientRect(), b = board.getBoundingClientRect(), foot = footer.getBoundingClientRect();
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const top = Math.max(f.top, h.bottom, viewportTop, b.bottom > viewportTop && b.top < innerHeight ? b.bottom : viewportTop);
    const bottom = Math.min(f.bottom, innerHeight, foot.top);
    const rows = [...flow.querySelectorAll<HTMLElement>(".agenda-day[data-flip-key]")].map(day => {
      const rect = day.getBoundingClientRect();
      return { date: day.dataset.flipKey!, ...bounds(day), visible: Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top)) };
    });
    const dominant = rows.reduce<typeof rows[number] | undefined>((previous, row) => row.visible > (previous?.visible ?? 0) ? row : previous, undefined);
    const notices = [...board.querySelectorAll<HTMLElement>(".asc-stack > .asc-row")].map(row => {
      const title = row.querySelector<HTMLElement>(".asc-title")!, rect = row.getBoundingClientRect();
      const ink = document.createRange(); ink.selectNodeContents(title);
      const style = getComputedStyle(title);
      return { id: row.dataset.noticeId!, active: row.dataset.active === "true", title: title.textContent,
        ...bounds(row), titleFull: [...ink.getClientRects()].every(r => r.left >= rect.left - .5 && r.right <= rect.right + .5 && r.top >= rect.top - .5 && r.bottom <= rect.bottom + .5)
          && style.textOverflow !== "ellipsis" && ["none", "0", ""].includes(style.webkitLineClamp) };
    });
    const month = surface.querySelector<HTMLElement>('[data-act="month-title"]')!, monthBox = month.getBoundingClientRect();
    const ink = document.createRange(); ink.selectNodeContents(month.querySelector(".mobile-month-label")!);
    const caption = month.querySelector<HTMLElement>(".mobile-month-caption");
    const captionInk = document.createRange();
    if (caption) captionInk.selectNodeContents(caption);
    const controls = [...header.querySelectorAll<HTMLElement>("button")].filter(node => node.getBoundingClientRect().width > 0).map(node => {
      const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { name: node.getAttribute("aria-label") ?? node.textContent?.trim(), ...bounds(node), right: rect.right, bottom: rect.bottom, hit: Boolean(hit && (hit === node || node.contains(hit))) };
    });
    const follow = board.querySelector<HTMLElement>('[data-act="agenda-support-follow-view"]');
    const meta = board.querySelector(".asc-meta")?.cloneNode(true) as HTMLElement | undefined;
    meta?.querySelectorAll(".asc-range").forEach(node => node.remove());
    const active = document.activeElement;
    const link = board.querySelector<HTMLAnchorElement>(".asc-link");
    return {
      frameCount: 2, elapsedMs: performance.now() - started, anchor,
      boxes: [".agenda-header", ".viewer-settings-open", ".agenda-support-board", ".agenda-flow", ".agenda-rail", ".m-actionrail"].map(selector => ({ selector, ...bounds(surface.querySelector(selector)!) })),
      month: { ...bounds(month), centreX: monthBox.x + monthBox.width / 2,
        labelFull: [...ink.getClientRects()].every(r => r.left >= monthBox.left - .5 && r.right <= monthBox.right + .5 && r.top >= monthBox.top - .5 && r.bottom <= monthBox.bottom + .5) },
      saveCaption: { text: caption?.textContent, full: Boolean(caption && captionInk.getClientRects().length > 0 && [...captionInk.getClientRects()].every(r => r.left >= monthBox.left - .5 && r.right <= monthBox.right + .5 && r.top >= monthBox.top - .5 && r.bottom <= monthBox.bottom + .5)) },
      rows, dominantDate: dominant?.date, notices, controls,
      cards: [...flow.querySelectorAll<HTMLElement>(".agenda-event[data-eventid]")].map(node => ({ id: node.dataset.eventid!, ...bounds(node) })),
      readingDate: board.dataset.readingDate, presentedDate: board.dataset.presentedDate, held: board.dataset.held,
      dateLabel: `${meta?.textContent ?? ""} ${follow?.textContent ?? ""}`.trim(), followName: follow?.getAttribute("aria-label"),
      highlightedDates: [...flow.querySelectorAll<HTMLElement>('.agenda-day[data-notice-reading="true"]')].map(node => node.dataset.flipKey!),
      highlights: [...flow.querySelectorAll<HTMLElement>('.agenda-day[data-notice-reading="true"]')].map(node => ({
        date: node.dataset.flipKey!, shadow: getComputedStyle(node).boxShadow,
        visible: Math.max(0, Math.min(node.getBoundingClientRect().bottom, bottom) - Math.max(node.getBoundingClientRect().top, top))
      })),
      focusedLink: Boolean(link && active === link), linkHref: link?.href, linkRel: link?.rel, linkTarget: link?.target,
      scrollY, flowScrollTop: flow.scrollTop, documentHeight: document.documentElement.scrollHeight, viewport: { width: innerWidth, height: innerHeight }
    };
  }, anchor);
}
type Metrics = Awaited<ReturnType<typeof measure>>;

function controlsAreUsable(metrics: Metrics) {
  expect(metrics.month.labelFull, "Full month remains readable in the centred 44px control").toBe(true);
  for (const [index, control] of metrics.controls.entries()) {
    expect(control.width, control.name).toBeGreaterThanOrEqual(44);
    expect(control.height, control.name).toBeGreaterThanOrEqual(44);
    expect(control.hit, control.name).toBe(true);
    for (const previous of metrics.controls.slice(0, index)) {
      const area = Math.max(0, Math.min(control.right, previous.right) - Math.max(control.x, previous.x))
        * Math.max(0, Math.min(control.bottom, previous.bottom) - Math.max(control.y, previous.y));
      expect(area, `${control.name}/${previous.name} must not overlap`).toBe(0);
    }
  }
}

function stable(before: Metrics, after: Metrics) {
  for (const key of ["scrollY", "flowScrollTop", "documentHeight"] as const) expect(Math.abs(after[key] - before[key]), key).toBeLessThan(.5);
  for (const [index, box] of after.boxes.entries()) {
    expect(box.selector).toBe(before.boxes[index].selector);
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(box[key] - before.boxes[index][key]), `${box.selector} ${key}`).toBeLessThan(.5);
  }
  // Failure adds a real 44px recovery action. The shared month slot is allowed
  // to narrow symmetrically; centre, top, height and readable text must hold.
  for (const key of ["centreX", "y", "height"] as const) expect(Math.abs(after.month[key] - before.month[key]), `month ${key}`).toBeLessThan(.5);
  expect(after.rows.map(row => row.date)).toEqual(before.rows.map(row => row.date));
  expect(after.cards.map(card => card.id)).toEqual(before.cards.map(card => card.id));
  for (const [index, row] of after.rows.entries()) for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(row[key] - before.rows[index][key]), `${row.date} ${key}`).toBeLessThan(.5);
  for (const [index, card] of after.cards.entries()) for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(card[key] - before.cards[index][key]), `${card.id} ${key}`).toBeLessThan(.5);
  controlsAreUsable(after);
}

function contextIs20(metrics: Metrics) {
  // Direct assertions on the two-rAF capture: no locator auto-wait/poll here.
  expect(metrics.readingDate).toBe(today);
  expect(metrics.presentedDate).toBe(today);
  expect(metrics.highlightedDates).toEqual([today]);
  expect(metrics.highlights[0].visible).toBeGreaterThan(0);
  expect(metrics.highlights[0].shadow, "The reading-day highlight must be rendered, not just tagged in the DOM").not.toBe("none");
  expect(metrics.dateLabel).toMatch(/(?:20일|10[./]\s*20|2026-10-20)/);
  expect(metrics.notices.filter(notice => notice.active).map(notice => notice.id).sort()).toEqual(active20);
  expect(metrics.notices.map(notice => notice.id).sort()).toEqual(active20);
  expect(metrics.notices.every(notice => notice.titleFull)).toBe(true);
  expect(metrics.linkTarget).toBe("_blank");
  expect(metrics.linkRel?.split(/\s+/)).toContain("noopener");
  expect(metrics.linkRel?.split(/\s+/)).toContain("noreferrer");
}

async function saveScreenshot(page: Page, name: string) {
  const path = resolve(artifacts, `${name}.png`);
  await page.screenshot({ path }); proofs.get(page)!.screenshots.push(path);
}

async function capture(page: Page, role: string, state: string) {
  await expect(page.locator(".copy-toast")).toHaveCount(0);
  if (phase === "after") {
    const caption = page.locator(".studio-mobile .mobile-month-caption");
    await expect(caption).toBeVisible();
    await expect(caption).toHaveText(state === "saving" ? "저장 중…" : state === "saved" ? "저장됨" : "저장 실패");
  }
  const metrics = await measure(page);
  proofs.get(page)!.states[state] = metrics;
  controlsAreUsable(metrics);
  if (phase === "after") expect(metrics.saveCaption.full, "The visible save-state caption must fit its month control").toBe(true);
  // Titles are a baseline requirement too. Reading correctness is deliberately
  // separate, so an observation cannot become a false defect-resolution PASS.
  expect(metrics.notices.filter(notice => notice.active).map(notice => notice.id).sort()).toEqual(active20);
  expect(metrics.notices.every(notice => notice.titleFull)).toBe(true);
  if (phase === "after") contextIs20(metrics);
  await saveScreenshot(page, `${role}-${state}-${metrics.viewport.width}`);
  return metrics;
}

async function waitWrite(page: Page, count: number) {
  const proof = proofs.get(page)!;
  await expect.poll(() => proof.writes.length).toBe(count);
  await expect.poll(() => Boolean(proof.release)).toBe(true);
  await expect(feedback(page)).toHaveAttribute("data-state", "saving");
  await expect(status(page)).toContainText("저장 중");
}

async function releaseWrite(page: Page, ok: boolean) {
  const release = proofs.get(page)!.release;
  expect(release).toBeDefined(); release!(ok);
  await expect(feedback(page)).toHaveAttribute("data-state", ok ? "saved" : "failed");
}

async function verifyFollowControl(page: Page) {
  const follow = board(page).locator('[data-act="agenda-support-follow-view"]');
  const hit = await follow.evaluate(node => {
    const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { width: r.width, height: r.height, hit: Boolean(hit && (hit === node || node.contains(hit))) };
  });
  expect(hit.width).toBeGreaterThanOrEqual(44); expect(hit.height).toBeGreaterThanOrEqual(44); expect(hit.hit).toBe(true);
  return follow;
}

for (const role of ["owner", "developer"] as const) {
  test(`${role} reading context and actual saving saved failed gallery retain date geometry`, async ({ page }) => {
    test.setTimeout(75_000);
    const proof = proofs.get(page)!;
    await page.goto(`/visual-fixture/studio?supportUX=reading&role=${role}`);
    await expect(board(page)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // The pre-existing calendar entrance has a staggered delay even with app
    // motion reduction enabled. Settle only that initial presentation before
    // issuing any test scroll; date updates themselves still get two rAFs.
    proof.probes.initialPresentation = await page.evaluate(async () => {
      const animations = document.getAnimations().filter(animation => animation.playState === "running"
        && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
      const started = performance.now();
      const initial = animations.map(animation => ({
        name: animation instanceof CSSAnimation ? animation.animationName : "transition",
        endTime: animation.effect?.getComputedTiming().endTime
      }));
      await Promise.allSettled(animations.map(animation => animation.finished));
      return { animations: initial, elapsedMs: performance.now() - started };
    });
    await expect(feedback(page)).toHaveAttribute("data-state", "idle");
    await expect(feedback(page)).toHaveAttribute("aria-hidden", "true");
    await expect(feedback(page).locator("*")).toHaveCount(0);
    await expect(feedback(page)).not.toHaveAttribute("title"); await expect(status(page)).toHaveText("");

    // Independent geometry oracle: 19 is just a visible tail, 20 is the day
    // occupying the largest clipped height. The fixture includes a long 19th.
    const partial = await measure(page, { date: today, top: 48 });
    proof.probes.partialPredecessor = { intent: "19 tail with dominant 20", correctnessAsserted: phase === "after", ...partial };
    expect(partial.rows.find(row => row.date === yesterday)?.visible).toBeGreaterThan(0);
    expect(partial.dominantDate, "Fixture arrangement must independently establish dominant 20").toBe(today);
    if (phase === "after") contextIs20(partial);
    await saveScreenshot(page, `${role}-partial-predecessor-${phase}`);

    if (phase === "after") {
      // Focus must keep this exact action/URL alive while the independent
      // reading date/highlight advance. Follow explicitly releases that scope.
      const nineteen = await measure(page, { date: yesterday, top: 12 });
      proof.probes.nineteen = nineteen;
      expect(nineteen.readingDate).toBe(yesterday);
      expect(nineteen.notices.filter(notice => notice.active).map(notice => notice.id).sort()).toEqual(active19);
      await board(page).locator('.asc-row[data-notice-id="reading-ended-19"]').tap();
      const link = board(page).locator(".asc-link");
      await expect(link).toHaveAttribute("href", endedURL); await link.focus();
      const held = await measure(page, { date: today, top: 48 });
      proof.probes.heldLink = held;
      expect(held.dominantDate).toBe(today); expect(held.readingDate).toBe(today);
      expect(held.presentedDate).toBe(yesterday); expect(held.held).toBe("true");
      expect(held.focusedLink).toBe(true); expect(held.linkHref).toBe(endedURL);
      await expect(link).toBeFocused();
      await saveScreenshot(page, `${role}-focused-held-link`);
      const follow = await verifyFollowControl(page); await follow.tap();
      const following = await measure(page);
      proof.probes.following = following;
      contextIs20(following); expect(following.held).toBe("false"); expect(following.linkHref).not.toBe(endedURL);
      await expect(follow).toBeFocused(); stable(held, following);
      await saveScreenshot(page, `${role}-following-view`);
    }

    // Give the complete day20 a stable top anchor for all six gallery images.
    // Save-state waiting below never participates in the immediate date oracle.
    await flow(page).focus();
    const anchored = await measure(page, { date: today, top: 12 });
    proof.probes.galleryAnchor = anchored;
    if (phase === "after") contextIs20(anchored);
    await editable(page).tap(); await expect(editor(page)).toBeVisible();
    const original = await editor(page).locator(".me-title").inputValue();
    const titleA = `합성${original.slice(2)}`, titleB = `검증${original.slice(2)}`;
    expect(titleA.length).toBe(original.length); expect(titleB.length).toBe(original.length);
    await editor(page).locator(".me-title").fill(titleA);
    await editor(page).locator('[data-act="m-save"]').tap(); await expect(editor(page)).toHaveCount(0);
    await waitWrite(page, 1);
    const saving = await capture(page, role, "saving");
    await releaseWrite(page, true); await expect(status(page)).toContainText("저장됨");
    await expect(status(page)).toContainText(/\d{2}:\d{2}.*KST/);
    await expect(feedback(page)).toHaveAttribute("title", /\d{2}:\d{2}.*KST/);
    const saved = await capture(page, role, "saved"); stable(saving, saved);

    await editable(page).tap(); await editor(page).locator(".me-title").fill(titleB);
    await editor(page).locator('[data-act="m-save"]').tap(); await expect(editor(page)).toHaveCount(0);
    await waitWrite(page, 2);
    const failing = await measure(page); proof.states.pendingFailure = failing; stable(saved, failing);
    await releaseWrite(page, false); await expect(status(page)).toContainText("저장 실패");
    await expect(root(page).locator(".mobile-month-caption")).toHaveText("저장 실패");
    const failed = await capture(page, role, "failed"); stable(saving, failed);

    if (role === "owner") {
      await page.setViewportSize({ width: 320, height: 568 });
      // Font/layout settling is allowed for a viewport change, not for date
      // detection. The subsequent date observation still happens in two rAFs.
      await page.evaluate(() => document.fonts.ready);
      const critical = await measure(page, { date: today, top: 12 });
      proof.probes.critical320 = critical;
      if (phase === "after") contextIs20(critical);
      await capture(page, role, "failed-critical");
      await page.setViewportSize({ width: 390, height: 844 });
      await flow(page).evaluate((node, top) => node.scrollTo({ top, behavior: "instant" }), failed.flowScrollTop);
      const restored = await measure(page); proof.probes.restored390 = restored; stable(failed, restored);
    }

    const recover = root(page).locator('[data-act="editor-recover-failed-save"]');
    await recover.tap(); await expect(editor(page).locator(".me-title")).toHaveValue(titleB);
    await editor(page).locator('[data-act="m-save"]').tap(); await expect(editor(page)).toHaveCount(0);
    await waitWrite(page, 3); await releaseWrite(page, true);
    await expect(recover).toHaveCount(0); await expect(status(page)).toContainText(/저장됨.*\d{2}:\d{2}.*KST/);
    const recovered = await measure(page); proof.states.recovered = recovered; stable(saving, recovered);
    if (phase === "after") contextIs20(recovered);
    expect(proof.writes).toHaveLength(3);
    expect(proof.writes.every(write => write.payload?.id === eventId)).toBe(true);
  });
}
