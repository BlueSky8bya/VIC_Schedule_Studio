import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { supportContextFixture } from "@/app/visual-fixture/support-context";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { getTodayKst, nowKstHm } from "@/lib/calendar/month";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const artifacts = resolve(".scratch-pw/mobile-header-save", `${getTodayKst()}-${nowKstHm().replace(":", "")}-${process.pid}`);
type Write = { op: string; payload: { id?: string; publicTitle?: string; visibilityScope?: string } };
type Proof = { writes: Write[]; blocked: string[]; errors: string[]; measurements: Record<string, unknown>; release?: (ok: boolean) => void };
const proofs = new WeakMap<Page, Proof>();
const feedback = (page: Page) => page.locator(".studio-mobile .mobile-save-feedback");
const status = (page: Page) => page.locator(".studio-mobile .m-settings-slot [role=status]");
const gear = (page: Page) => page.locator(".agenda-header .viewer-settings-open:visible");
const editor = (page: Page) => page.locator('.m-edit-sheet[role="dialog"]');

test.beforeEach(async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  const proof: Proof = { writes: [], blocked: [], errors: [], measurements: {} }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const reads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(reads.size).toBe(1);
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return route.abort();
    if (request.method() === "POST" && url.pathname === "/api/studio-write") {
      const body = request.postDataJSON() as Write;
      // Only this test's existing public fixture event may use the simulated
      // write transport. The real route/action/DB is never executed.
      if (body.op === "save" && body.payload.id?.startsWith("cozy-stream-") && body.payload.visibilityScope === "public" && body.payload.publicTitle?.startsWith("합성 헤더")) {
        proof.writes.push(body);
        const ok = await new Promise<boolean>(resolve => { proof.release = resolve; }); proof.release = undefined;
        return route.fulfill({ status: ok ? 200 : 403, json: ok ? { ok: true, id: body.payload.id } : { ok: false, error: "합성 저장 실패" } });
      }
    }
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && reads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify({ ...samplePublicScheduleData, events: supportContextFixture().events })}\n` });
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      proof.blocked.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 500, body: "" });
    }
    if (url.pathname.startsWith("/api/") && url.pathname !== "/api/soop-live") return route.fulfill({ status: 404, body: "No live API reads in synthetic header QA" });
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { isLive: false } }) : route.fallback());
});

test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  // Release a failed test's held response without leaving a pending route.
  proof.release?.(false);
  const name = info.titlePath.join("-").replace(/[^a-zA-Z0-9-]+/g, "-");
  writeFileSync(resolve(artifacts, `${name}.json`), JSON.stringify({ status: info.status, ...proof, release: undefined, allWriteResponsesSynthetic: true, realLogin: false, physicalDevice: false }, null, 2));
  if (!page.isClosed()) await page.screenshot({ path: resolve(artifacts, `${name}.png`) });
  expect(proof.blocked).toEqual([]); expect(proof.errors).toEqual([]);
});

async function seed(page: Page, dark: boolean) {
  await page.addInitScript(({ key, epoch, preferences, dark }) => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.reduceMotion", "on"); localStorage.setItem("vic.dark", dark ? "on" : "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: false }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, dark });
}

async function layout(page: Page) {
  return page.locator(".studio-mobile").evaluate(root => {
    const flow = root.querySelector<HTMLElement>(".agenda-flow")!;
    const boxes = [".agenda-header", ".mobile-calendar-title", ".viewer-settings-open", ".agenda-support-board", ".agenda-flow", ".agenda-rail", ".m-actionrail"].map(selector => {
      const r = root.querySelector(selector)!.getBoundingClientRect(); return { selector, x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const month = root.querySelector<HTMLElement>('[data-act="month-title"]')!, label = month.querySelector(".mobile-month-label")!, monthBox = month.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(label);
    const labelReadable = [...range.getClientRects()].every(r => r.left >= monthBox.left - .5 && r.right <= monthBox.right + .5 && r.top >= monthBox.top - .5 && r.bottom <= monthBox.bottom + .5);
    const controls = [...root.querySelectorAll<HTMLElement>(".agenda-header button")].filter(node => node.getBoundingClientRect().width > 0).map(node => {
      const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { name: node.getAttribute("aria-label") ?? node.textContent?.trim(), x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, hit: Boolean(hit && (hit === node || node.contains(hit))) };
    });
    return { boxes, scrollY, flowScrollTop: flow.scrollTop, documentHeight: document.documentElement.scrollHeight, labelReadable, controls };
  });
}

function stable(before: Awaited<ReturnType<typeof layout>>, after: Awaited<ReturnType<typeof layout>>) {
  expect(Math.abs(before.scrollY - after.scrollY)).toBeLessThan(.5); expect(Math.abs(before.flowScrollTop - after.flowScrollTop)).toBeLessThan(.5);
  expect(before.documentHeight).toBe(after.documentHeight);
  // The explicit recovery action reserves a second 44px header cell on both
  // sides. Its month slot may narrow; its centre and reading frame stay fixed.
  for (const [i, box] of after.boxes.entries()) {
    if (box.selector === ".mobile-calendar-title") {
      expect(Math.abs(box.x + box.width / 2 - before.boxes[i].x - before.boxes[i].width / 2)).toBeLessThan(.5);
      for (const key of ["y", "height"] as const) expect(Math.abs(box[key] - before.boxes[i][key])).toBeLessThan(.5);
    } else for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(box[key] - before.boxes[i][key]), `${box.selector} ${key}`).toBeLessThan(.5);
  }
  expect(after.labelReadable, "full month label stays inside its 44px control").toBe(true);
  for (const [i, control] of after.controls.entries()) {
    expect(control.height, control.name).toBeGreaterThanOrEqual(44); expect(control.width, control.name).toBeGreaterThanOrEqual(44); expect(control.hit, control.name).toBe(true);
    for (const previous of after.controls.slice(0, i)) expect(Math.max(0, Math.min(control.right, previous.right) - Math.max(control.x, previous.x)) * Math.max(0, Math.min(control.bottom, previous.bottom) - Math.max(control.y, previous.y)), `${control.name}/${previous.name} overlap`).toBe(0);
  }
}

async function editFirst(page: Page, title: string) {
  const card = page.locator('.agenda-flow [data-companion-event="ordinary"]').first();
  await card.tap(); await expect(editor(page)).toBeVisible(); await editor(page).locator(".me-title").fill(title);
  await editor(page).locator('[data-act="m-save"]').tap();
  await expect(editor(page)).toHaveCount(0);
}

async function waitWrite(page: Page, count: number) {
  await expect.poll(() => proofs.get(page)!.writes.length).toBe(count);
  await expect.poll(() => Boolean(proofs.get(page)!.release)).toBe(true);
  await expect(feedback(page)).toHaveAttribute("data-state", "saving");
  await expect(status(page)).toContainText("저장 중");
}

async function release(page: Page, ok: boolean) {
  proofs.get(page)!.release!(ok);
  await expect(feedback(page)).toHaveAttribute("data-state", ok ? "saved" : "failed");
}

for (const view of [
  { width: 320, height: 568, role: "owner", dark: true },
  { width: 390, height: 844, role: "developer", dark: false },
]) test.describe(`save-${view.width}-${view.role}`, () => {
  test.use({ viewport: { width: view.width, height: view.height }, isMobile: true, hasTouch: true });
  test("actual delayed success failure and explicit recovery keep header and reading frame stable", async ({ page }) => {
    test.setTimeout(60_000); await seed(page, view.dark);
    await page.goto(`/visual-fixture/studio?supportUX=cozy&role=${view.role}`);
    await expect(feedback(page)).toHaveAttribute("data-state", "idle");
    await expect(feedback(page)).toHaveAttribute("aria-hidden", "true");
    await expect(feedback(page).locator("*")).toHaveCount(0); await expect(feedback(page)).not.toHaveAttribute("title");
    await expect(status(page)).toHaveText(""); await expect(gear(page)).toHaveAccessibleName("설정");
    await editFirst(page, "합성 헤더 성공"); await waitWrite(page, 1);
    const pending = await layout(page); proofs.get(page)!.measurements.pending = pending;
    // A pending save must not disable unrelated settings or move the gear.
    await gear(page).tap(); const settings = page.getByRole("dialog", { name: "설정", exact: true });
    await expect(settings).toBeVisible(); await settings.locator(".modal-close").tap();
    await expect(settings).toHaveCount(0); await expect(gear(page)).toBeFocused(); stable(pending, await layout(page));
    await release(page, true); await expect(status(page)).toContainText("저장됨");
    await expect(feedback(page)).toHaveAttribute("title", /\d{2}:\d{2}.*KST/);
    const saved = await layout(page); stable(pending, saved);
    const completedTitle = await feedback(page).getAttribute("title");
    await page.keyboard.press("Control+s"); await page.waitForTimeout(850);
    expect(proofs.get(page)!.writes).toHaveLength(1); await expect(feedback(page)).toHaveAttribute("title", completedTitle!);
    await expect(page.locator(".copy-toast")).toHaveCount(0);

    await editFirst(page, "합성 헤더 복구"); await waitWrite(page, 2); const pendingFailure = await layout(page);
    proofs.get(page)!.measurements.pendingFailure = pendingFailure;
    await release(page, false); await expect(status(page)).toContainText("저장 실패");
    await expect(page.locator(".mobile-month-caption")).toContainText("저장 실패");
    const recovery = page.locator('.m-head-actions [data-act="editor-recover-failed-save"]');
    await expect(recovery).toBeVisible();
    const hit = await recovery.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { width: r.width, height: r.height, hit: Boolean(hit && (hit === node || node.contains(hit))) }; });
    expect(hit.width).toBeGreaterThanOrEqual(44); expect(hit.height).toBeGreaterThanOrEqual(44); expect(hit.hit).toBe(true);
    const failed = await layout(page); proofs.get(page)!.measurements.failed = failed; stable(pendingFailure, failed);
    await page.screenshot({ path: resolve(artifacts, `failed-${view.width}-${view.role}.png`) });
    await page.keyboard.press("Control+s"); await page.waitForTimeout(850);
    expect(proofs.get(page)!.writes).toHaveLength(2); await expect(feedback(page)).toHaveAttribute("data-state", "failed");
    await expect(page.locator(".copy-toast")).toHaveCount(0);
    await recovery.tap(); await expect(editor(page).locator(".me-title")).toHaveValue("합성 헤더 복구");
    await editor(page).locator('[data-act="m-save"]').tap(); await expect(editor(page)).toHaveCount(0); await waitWrite(page, 3);
    await release(page, true); await expect(status(page)).toContainText("저장됨"); await expect(recovery).toHaveCount(0);
    stable(failed, await layout(page));
    await page.screenshot({ path: resolve(artifacts, `recovered-${view.width}-${view.role}.png`) });
    proofs.get(page)!.measurements = { ...proofs.get(page)!.measurements, saved, failed, recoveryHit: hit, recovered: await layout(page) };
  });
});

test.describe("read-only-preview-settings", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("developer role preview blocks save and public preview exposes only viewer settings", async ({ page }) => {
    test.setTimeout(60_000); await seed(page, false);
    await page.goto("/visual-fixture/studio?supportUX=cozy&role=developer");
    const menu = page.locator('.m-actionrail [data-act="preview-dd-trigger"]');
    await menu.tap(); await page.locator('[data-act="role-preview-owner"]').tap();
    await gear(page).tap(); const settings = page.getByRole("dialog", { name: "설정", exact: true });
    await expect(settings.locator('[data-act="settings-tab"][data-act-opt="edit"]')).toHaveCount(0);
    await settings.locator(".modal-close").tap(); await expect(gear(page)).toBeFocused();
    await editFirst(page, "합성 헤더 미리보기 차단");
    await expect(page.locator(".copy-toast")).toContainText("미리보기 중엔 변경 불가");
    expect(proofs.get(page)!.writes).toHaveLength(0);
    await menu.tap(); await page.locator('[data-act="role-preview-viewer"]').tap();
    await expect(page.locator(".viewer-fullscreen")).toBeVisible();
    await expect(page.locator(".mobile-save-feedback,[data-act=editor-recover-failed-save]")).toHaveCount(0);
    await gear(page).tap(); await expect(settings).toBeVisible();
    await expect(settings.locator('[data-act="settings-tab"][data-act-opt="edit"]')).toHaveCount(0);
    await expect(settings.locator('[data-act="settings-tab"][data-act-opt="dev"]')).toHaveCount(0);
    await settings.locator(".modal-close").tap(); await expect(gear(page)).toBeFocused();
    await expect(page.locator(".agenda-legend-nav").getByRole("button", { name: "편집실로 가기", exact: true })).toBeVisible();
    expect(proofs.get(page)!.writes).toHaveLength(0);
  });
});
