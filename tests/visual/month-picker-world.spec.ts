import { test, expect, type Page, type BrowserContext, type TestInfo, type ElementHandle, type Locator } from "@playwright/test";
import { guardCompanionQa } from "./helpers/companion-qa";
import { companionTraceMode } from "./helpers/companion-evidence-policy";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";

test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", video: "on", trace: companionTraceMode() });
test.describe.configure({ mode: "default" });
test.setTimeout(120000);
type Surface = "viewer" | "studio" | "preview";
type Handles = Record<"house" | "actor" | "food" | "toy", ElementHandle<HTMLElement>>;
type Proof = Awaited<ReturnType<typeof guardCompanionQa>>;
const title = (page: Page) => page.locator('[data-act="month-title"]:visible').first();
const picker = (page: Page) => page.getByRole("dialog", { name: "월 선택", exact: true });

async function setup(page: Page, context: BrowserContext, base: string) {
  const proof = await guardCompanionQa(page, context, base);
  await page.addInitScript(({ preferences, care }) => {
    if (window.top !== window) return;
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", v: 3, at: Date.now() }));
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.premiereStage", "off"); localStorage.setItem("vic_avatar_side", "left");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, feeding: true, activeWhileVisible: true, heartPrank: false, ambientPrank: false, personality: "balanced", personalitySource: "manual" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care, fullness: .99, energy: .95 }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
  return proof;
}
async function move(page: Page, item: Locator, x: number, y: number) {
  const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(x, y, { steps: 18 }); await page.waitForTimeout(180); await page.mouse.up(); await page.mouse.move(2, 2);
}
async function sample(page: Page, handles: Handles, label: string) {
  return page.evaluate(({ nodes, label }) => {
    const describe = (node: HTMLElement, current: Element | null) => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      let visible = node.isConnected && rect.width > 0 && rect.height > 0;
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
        const paint = getComputedStyle(parent);
        if (parent.hidden || paint.display === "none" || paint.visibility === "hidden" || Number(paint.opacity) <= 0) visible = false;
      }
      const name = style.getPropertyValue("position-anchor").trim();
      const source = name && [...document.querySelectorAll<HTMLElement>('[style*="anchor-name"]')].find(item => item.style.getPropertyValue("anchor-name").split(",").map(value => value.trim()).includes(name));
      return { connected: node.isConnected, sameCurrent: node === current, visible, nativeHidden: node.hidden, inert: Boolean(node.closest("[inert]")), ariaHidden: Boolean(node.closest('[aria-hidden="true"]')), disabled: node instanceof HTMLButtonElement && node.disabled,
        id: node.dataset.food ?? node.dataset.toyId ?? null, support: node.dataset.platform ?? null, state: node.dataset.state ?? null, falling: node.dataset.falling ?? null, presence: node.dataset.presence ?? null,
        point: { x: rect.left + rect.width / 2, y: rect.bottom }, rect: rect.toJSON(), transform: style.transform, nativeAnchor: node.hasAttribute("data-native-item-anchor"), anchorName: name,
        anchorSource: source ? { connected: source.isConnected, className: source.className, rect: source.getBoundingClientRect().toJSON() } : null };
    };
    const foodId = nodes.food.dataset.food!, toyId = nodes.toy.dataset.toyId!;
    const currentTitle = [...document.querySelectorAll<HTMLElement>('[data-act="month-title"]')].find(node => node.getClientRects().length);
    return { label, at: performance.now(), month: currentTitle?.textContent?.trim(), focusedAct: (document.activeElement as HTMLElement | null)?.dataset.act ?? null, picker: Boolean(document.querySelector(".mp-panel")),
      house: describe(nodes.house, document.querySelector(".vc-home")), actor: describe(nodes.actor, document.querySelector(".vc-companion")),
      food: describe(nodes.food, document.querySelector(`.vc-food[data-food="${CSS.escape(foodId)}"]`)), toy: describe(nodes.toy, document.querySelector(`.vc-toy[data-toy-id="${CSS.escape(toyId)}"]`)) };
  }, { nodes: handles, label });
}
async function prepareWorld(page: Page, surface: Surface) {
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?monthLink=1&month=2026-06" : `/visual-fixture/studio?role=developer&y=2026&m=6${surface === "preview" ? "&viewer=1" : ""}`);
  await page.bringToFront(); await settlePanelLayout(page);
  await expect(page.locator(".vc-actor")).toBeVisible({ timeout: 20000 });
  const home = await openCompanionHome(page); await settlePanelLayout(page); await placeCompanionOnHomeFloor(page);
  await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const food = page.locator(".vc-food").last(); await expect(food).not.toHaveAttribute("data-falling");
  await move(page, food, 90, 990); await expect(food).toHaveAttribute("data-platform", /^viewport-floor/);
  await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
  const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false"); await expect(toy).toHaveAttribute("data-platform", /^companion-home/);
  await settlePanelLayout(page);
  const handles: Handles = { house: (await page.locator(".vc-home").elementHandle())! as ElementHandle<HTMLElement>, actor: (await page.locator(".vc-companion").elementHandle())! as ElementHandle<HTMLElement>, food: (await food.elementHandle())! as ElementHandle<HTMLElement>, toy: (await toy.elementHandle())! as ElementHandle<HTMLElement> };
  const settling: Awaited<ReturnType<typeof sample>>[] = [];
  await expect.poll(async () => {
    settling.push(await sample(page, handles, "settling"));
    const last = settling.slice(-3);
    return last.length === 3 && last.every(row => Math.hypot(row.food.point.x - last[0].food.point.x, row.food.point.y - last[0].food.point.y) < .1 && Math.hypot(row.toy.point.x - last[0].toy.point.x, row.toy.point.y - last[0].toy.point.y) < .1);
  }, { timeout: 7000, intervals: [100] }).toBe(true);
  return { handles, food, toy, baseline: await sample(page, handles, "baseline"), settling };
}
async function finish(page: Page, info: TestInfo, proof: Proof, facts: unknown) {
  await Promise.all(proof.pending);
  await info.attach("actual-ui", { body: await page.screenshot(), contentType: "image/png" });
  await info.attach("observation", { body: JSON.stringify({ facts, proof: { ...proof, pending: undefined }, syntheticFixture: true, fullCertification: false, normal36: "UNVERIFIED" }), contentType: "application/json" });
  expect(proof.errors).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.liveReads).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(chunk => chunk.local === chunk.served)).toBe(true);
}

for (const surface of ["viewer", "studio", "preview"] as const) test(`${surface}: month chooser preserves the painted house resident food and settled toy through repeated Escape`, async ({ page, context, baseURL }, info) => {
  const proof = await setup(page, context, baseURL!), world = await prepareWorld(page, surface);
  const observations = [world.baseline], cycles = surface === "viewer" ? 5 : 3;
  let actionError: unknown;
  try {
    for (let cycle = 1; cycle <= cycles; cycle++) {
      await title(page).click(); await picker(page).waitFor(); await settlePanelLayout(page);
      observations.push(await sample(page, world.handles, `cycle-${cycle}-opened`));
      if (cycle === 1) await info.attach("world-behind-first-chooser", { body: await page.screenshot(), contentType: "image/png" });
      for (let tab = 0; tab < 20; tab++) await page.keyboard.press("Tab");
      observations.push(await sample(page, world.handles, `cycle-${cycle}-after20Tabs`));
      await page.keyboard.press("Escape"); await picker(page).waitFor({ state: "detached" }); await settlePanelLayout(page);
      observations.push(await sample(page, world.handles, `cycle-${cycle}-closed`));
    }
  } catch (error) { actionError = error; observations.push(await sample(page, world.handles, "action-failure")); }
  const violations: string[] = [];
  for (const row of observations) {
    if (row.month !== world.baseline.month) violations.push(`${row.label}: viewed month changed without selection`);
    for (const key of ["house", "actor", "food", "toy"] as const) {
      if (!row[key].connected || !row[key].sameCurrent || !row[key].visible) violations.push(`${row.label}: ${key} lost its connected original painted node`);
    }
    for (const key of ["food", "toy"] as const) {
      if (row[key].id !== world.baseline[key].id || row[key].support !== world.baseline[key].support) violations.push(`${row.label}: ${key} ownership/support changed`);
      const drift = Math.hypot(row[key].point.x - world.baseline[key].point.x, row[key].point.y - world.baseline[key].point.y);
      if (drift >= 1) violations.push(`${row.label}: ${key} painted foot drift=${drift.toFixed(3)}px`);
    }
    if (row.picker && !row.food.inert) violations.push(`${row.label}: food layer remained interactive behind modal`);
    if (row.label.endsWith("-closed") && row.focusedAct !== "month-title") violations.push(`${row.label}: Escape did not return focus to month title`);
  }
  await finish(page, info, proof, { surface, cycles, nativeTabsPerCycle: 20, baseline: world.baseline, observations, violations, settling: world.settling, actionError: actionError ? String(actionError) : null, actorOnHomeFloor: true, foodOnViewportFloor: true, toyOnHomeFloor: true });
  if (actionError) throw actionError;
  expect(violations, "All cycles are observed before evaluating visibility, identity, ownership and drift").toEqual([]);
});

test("actual month selection still navigates while home and screen-floor objects retain their own sources", async ({ page, context, baseURL }, info) => {
  const proof = await setup(page, context, baseURL!), world = await prepareWorld(page, "viewer");
  await title(page).click(); await picker(page).getByRole("button", { name: "2026년 7월", exact: true }).click(); await picker(page).waitFor({ state: "detached" });
  await expect(title(page)).toContainText(/2026년\s*07월/); await settlePanelLayout(page);
  const after = await sample(page, world.handles, "selected-July");
  await finish(page, info, proof, { before: world.baseline, after, actualMonthSelection: true, observedSources: ["home-floor toy", "viewport-floor food"], notCovered: ["Anonymous calendar-source disposal is not exercised by this case."] });
  expect(after.month).not.toBe(world.baseline.month); expect(after.food.connected && after.food.sameCurrent && after.food.visible).toBe(true); expect(after.toy.connected && after.toy.sameCurrent && after.toy.visible).toBe(true);
  expect(after.food.id).toBe(world.baseline.food.id); expect(after.toy.id).toBe(world.baseline.toy.id);
});

test("settings still hides food and master OFF stays authoritative after closing the month chooser", async ({ page, context, baseURL }, info) => {
  const proof = await setup(page, context, baseURL!), world = await prepareWorld(page, "viewer");
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  const settingsDialog = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(settingsDialog).toBeVisible();
  const companionTab = settingsDialog.getByRole("tab", { name: "빅타민", exact: true });
  await expect(companionTab).toBeVisible(); await companionTab.click();
  const panel = page.locator("#rhh-tab-companion-panel"); await panel.waitFor();
  const settings = await sample(page, world.handles, "settings-open");
  await panel.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  const master = panel.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }); await master.click(); await expect(master).not.toBeChecked();
  await page.keyboard.press("Escape"); await panel.waitFor({ state: "hidden" });
  const off = await sample(page, world.handles, "master-off");
  await title(page).click(); await picker(page).waitFor(); await page.keyboard.press("Escape"); await picker(page).waitFor({ state: "detached" });
  const after = await sample(page, world.handles, "master-off-after-chooser");
  await finish(page, info, proof, { settings, off, after, nativeMasterOff: true });
  expect(settings.food.visible).toBe(false); expect(off.actor.visible).toBe(false); expect(after.actor.visible).toBe(false); expect(after.food.visible).toBe(false); expect(after.toy.visible).toBe(false);
});

test.describe("compact desktop", () => {
  test.use({ viewport: { width: 1100, height: 1100 } });
  test("viewer month chooser preserves home-floor food and viewport-floor toy on both axes through five Escape cycles", async ({ page, context, baseURL }, info) => {
    const proof = await setup(page, context, baseURL!);
    await page.goto("/visual-fixture/poster?monthLink=1&month=2026-06"); await page.bringToFront(); await settlePanelLayout(page);
    await expect(page.locator(".vc-actor")).toBeVisible({ timeout: 20000 });
    const home = await openCompanionHome(page); await settlePanelLayout(page); await placeCompanionOnHomeFloor(page);
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    const food = page.locator(".vc-food").last(); await expect(food).not.toHaveAttribute("data-falling"); await expect(food).toHaveAttribute("data-platform", /^companion-home/);
    await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false");
    await move(page, toy, 550, 990); await expect(toy).toHaveAttribute("data-platform", /^viewport-floor/); await expect(toy).toHaveAttribute("data-falling", "false");
    await settlePanelLayout(page);
    const handles: Handles = { house: (await page.locator(".vc-home").elementHandle())! as ElementHandle<HTMLElement>, actor: (await page.locator(".vc-companion").elementHandle())! as ElementHandle<HTMLElement>, food: (await food.elementHandle())! as ElementHandle<HTMLElement>, toy: (await toy.elementHandle())! as ElementHandle<HTMLElement> };
    const settling: Awaited<ReturnType<typeof sample>>[] = [];
    await expect.poll(async () => {
      settling.push(await sample(page, handles, "compact-settling"));
      const last = settling.slice(-3);
      return last.length === 3 && last.every(row => Math.hypot(row.food.point.x - last[0].food.point.x, row.food.point.y - last[0].food.point.y) < .1 && Math.hypot(row.toy.point.x - last[0].toy.point.x, row.toy.point.y - last[0].toy.point.y) < .1);
    }, { timeout: 7000, intervals: [100] }).toBe(true);
    const baseline = await sample(page, handles, "compact-baseline"), observations = [baseline];
    let actionError: unknown;
    try {
      for (let cycle = 1; cycle <= 5; cycle++) {
        await title(page).click(); await picker(page).waitFor(); await settlePanelLayout(page);
        observations.push(await sample(page, handles, `compact-${cycle}-opened`));
        if (cycle === 1) await info.attach("compact-world-behind-first-chooser", { body: await page.screenshot(), contentType: "image/png" });
        for (let tab = 0; tab < 20; tab++) await page.keyboard.press("Tab");
        observations.push(await sample(page, handles, `compact-${cycle}-after20Tabs`));
        await page.keyboard.press("Escape"); await picker(page).waitFor({ state: "detached" }); await settlePanelLayout(page);
        observations.push(await sample(page, handles, `compact-${cycle}-closed`));
      }
    } catch (error) { actionError = error; observations.push(await sample(page, handles, "compact-action-failure")); }
    const violations: string[] = [];
    const displacement = observations.map(row => ({ label: row.label, food: { dx: row.food.point.x - baseline.food.point.x, dy: row.food.point.y - baseline.food.point.y }, toy: { dx: row.toy.point.x - baseline.toy.point.x, dy: row.toy.point.y - baseline.toy.point.y } }));
    for (const [index, row] of observations.entries()) {
      if (row.month !== baseline.month) violations.push(`${row.label}: month changed without selection`);
      for (const key of ["house", "actor", "food", "toy"] as const) if (!row[key].visible || !row[key].connected || !row[key].sameCurrent) violations.push(`${row.label}: ${key} lost original painted node`);
      for (const key of ["food", "toy"] as const) {
        if (row[key].id !== baseline[key].id || row[key].support !== baseline[key].support) violations.push(`${row.label}: ${key} ID/support changed`);
        const { dx, dy } = displacement[index][key];
        if (Math.hypot(dx, dy) >= 1) violations.push(`${row.label}: ${key} drift dx=${dx.toFixed(3)}px dy=${dy.toFixed(3)}px`);
      }
      if (row.picker && !row.food.inert) violations.push(`${row.label}: food remained interactive behind picker`);
      if (row.label.endsWith("-closed") && row.focusedAct !== "month-title") violations.push(`${row.label}: Escape focus did not return`);
    }
    await finish(page, info, proof, { width: 1100, height: 1100, desktop: true, cycles: 5, nativeTabsPerCycle: 20, baseline, observations, displacement, settling, violations, actionError: actionError ? String(actionError) : null, foodOnHomeFloor: true, toyOnViewportFloor: true, limits: ["This case measures both axes; no prior horizontal drift reproduction is asserted. The preserved 1920px old-build failure observed toy vertical displacement and unchanged x."] });
    if (actionError) throw actionError;
    expect(violations, "All five compact desktop cycles are observed before evaluating either axis").toEqual([]);
  });
});
