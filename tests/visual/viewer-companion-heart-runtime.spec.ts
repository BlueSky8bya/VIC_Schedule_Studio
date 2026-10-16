import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { safeCompanionSurfaces } from "@/lib/ui/viewer-companion/geometry";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const heart = (page: Page) => page.locator("#companion-runtime-heart");
const posts = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(preferences => {
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.sound", "off");
    // Deterministic utility draw, with the real monotonic clock untouched.
    Math.random = () => .999999;
  }, { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: false, sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, feeding: false });
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function cardAnchor(page: Page, card: Locator) {
  const geometry = await card.evaluate(element => {
    const root = element.closest(".poster-page")!;
    const rect = (box: DOMRect) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom });
    const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,svg,.sr-only,[hidden]")) continue;
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (box.width > 0 && box.height > 0) obstacles.push(rect(box));
    }
    const lines: { x: number; y: number; width: number }[] = [];
    for (const title of element.querySelectorAll(".event-main p,.event-subs li")) {
      range.selectNodeContents(title);
      for (const box of range.getClientRects()) if (box.width > 0 && box.height > 0) lines.push({ x: box.left, y: box.top - 3, width: box.width });
    }
    range.detach();
    const controls = [...root.querySelectorAll("button,a[href],input,select,textarea,[role=button]")]
      .filter(node => !node.matches(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],.public-day,.agenda-day") && !node.closest(".vc-companion,.vc-cushion-button"))
      .map(node => node.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0).map(rect);
    const house = document.querySelector(".vc-home:not([data-panel-collapsed])")?.getBoundingClientRect();
    if (house && house.width > 0 && house.height > 0) controls.push(rect(house));
    const card = element.getBoundingClientRect(), heart = element.querySelector(".event-heart")?.getBoundingClientRect();
    return { obstacles: [...obstacles, ...controls], controls, lines, card: { x: card.left, y: card.top - 3, width: card.width },
      heart: heart && heart.width > 0 && heart.height > 0 ? { x: heart.left + heart.width / 2, y: heart.top + heart.height / 2 } : { x: card.right, y: card.top },
      viewport: { width: innerWidth, height: innerHeight } };
  });
  // Both surfaces use the actual92px cell and its registered76% body. Find
  // one x that is safe on BOTH the physical card top and an autonomous line;
  // a native P drop into a title's interior must not fake text-ledge landing.
  const size = 92, footprint = { width: size * .76, height: size * .76 };
  const tops = safeCompanionSurfaces(geometry.card, geometry.controls, size, geometry.viewport, footprint);
  const lines = geometry.lines.flatMap(line => safeCompanionSurfaces(line, geometry.obstacles, size, geometry.viewport, footprint));
  const candidates = lines.flatMap(line => tops.flatMap(top => {
    const x = Math.max(line.x, top.x), right = Math.min(line.x + line.width, top.x + top.width);
    return right - x >= 1 ? [{ x, y: line.y, width: right - x, dropY: top.y - 12 }] : [];
  }));
  const distance = (line: { x: number; y: number; width: number }) => Math.hypot(Math.max(line.x - geometry.heart.x, 0, geometry.heart.x - line.x - line.width), line.y - geometry.heart.y);
  return candidates.sort((a, b) => distance(a) - distance(b) || b.width - a.width)[0];
}

async function addSyntheticHeart(page: Page, humanPressed: boolean, requiredId?: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  let card: Locator | undefined;
  if (requiredId) {
    expect(requiredId).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/);
    card = page.locator(`.public-event[data-eventid="${requiredId}"]:not(.teaser)`).first();
    await expect(card).toBeVisible();
    await expect.poll(async () => Boolean(await cardAnchor(page, card!)), { timeout: 5000 }).toBe(true);
  } else await expect.poll(async () => {
    for (const candidate of await page.locator(".public-event[data-eventid]:visible:not(.teaser)").all()) {
      if (await cardAnchor(page, candidate)) { card = candidate; return true; }
    }
    return false;
  }, { timeout: 5000 }).toBe(true);
  expect(card, "fixture must expose an actual safe title ledge for the companion").toBeTruthy();
  const target = card!;
  const id = await target.getAttribute("data-eventid");
  expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/);
  await target.evaluate((card, pressed) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "event-heart"; button.id = "companion-runtime-heart";
    button.setAttribute("aria-label", "Synthetic human heart");
    button.setAttribute("aria-pressed", String(pressed)); button.setAttribute("data-native-clicks", "0");
    button.style.cssText = "position:absolute;right:4px;top:4px;width:24px;height:24px;display:block;opacity:1;pointer-events:auto;z-index:5";
    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21 3 11a5 5 0 0 1 9-6 5 5 0 0 1 9 6Z"/></svg>';
    const count = document.createElement("span"); count.id = "companion-runtime-human-count"; count.textContent = "17";
    count.style.cssText = "position:absolute;right:32px;top:32px;font-size:10px";
    button.addEventListener("click", () => {
      button.setAttribute("data-native-clicks", String(Number(button.getAttribute("data-native-clicks")) + 1));
      button.setAttribute("aria-pressed", "true"); count.textContent = String(Number(count.textContent) + 1);
    });
    card.append(count, button);
  }, humanPressed);
  return { card: target, id: id! };
}

async function standOnCard(page: Page, requiredId?: string) {
  await expect(actor(page)).toBeVisible();
  const { card, id } = await addSyntheticHeart(page, false, requiredId);
  // The preference init script leaves autonomous hearts OFF after reload.
  // Observe the saved marker on this exact event before enabling its next
  // autonomous attempt; selecting a new safe card would test a different ID.
  if (requiredId) await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
  const anchor = (await cardAnchor(page, card))!;
  expect(anchor).toBeTruthy();
  await actor(page).focus(); await actor(page).press("p");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(anchor.x + anchor.width / 2, anchor.dropY);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/, { timeout: 5000 });
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(() => card.evaluate(node => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - node.getBoundingClientRect().top + 3))).toBeLessThan(2);

  // Exercise the real settings/controller remount: its private transient
  // lastPose retains this physical point, then fresh geometry resolves the
  // closest autonomous line. This proves remount/heart binding, not an
  // autonomous navigation path or a browser-persisted position feature.
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tab", { name: "장난", exact: true }).click();
  const enabled = dialog.getByRole("switch", { name: "빅타민 하트 콩 켜기/끄기", exact: true });
  await expect(enabled).not.toBeChecked(); await enabled.click(); await expect(enabled).toBeChecked();
  await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toBeHidden(); await page.mouse.move(4, 4);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+(?:-line-\d+)?(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(() => card.evaluate(node => {
    const cell = document.querySelector(".vc-companion")!.getBoundingClientRect(), x = cell.left + cell.width / 2;
    const range = document.createRange(), errors: number[] = [];
    for (const line of node.querySelectorAll(".event-main p,.event-subs li")) {
      range.selectNodeContents(line);
      for (const rect of range.getClientRects()) if (rect.width > 0 && x >= rect.left && x <= rect.right) errors.push(Math.abs(cell.bottom - rect.top + 3));
    }
    range.detach(); return errors.length ? Math.min(...errors) : Infinity;
  })).toBeLessThan(2);
  return { card, id };
}

test("the real companion toggles only its violet souvenir and remembers both states after reload", async ({ page }) => {
  test.setTimeout(95_000);
  await page.goto("/visual-fixture/poster");
  const { id } = await standOnCard(page);
  await expect(pet(page)).toHaveAttribute("data-heart-result", "added", { timeout: 45_000 });
  await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!))).toEqual({ version: 1, ids: [id] });
  const colors = await heart(page).evaluate(button => {
    const probe = document.createElement("span"); probe.style.color = "var(--teaser)"; button.append(probe);
    const violet = getComputedStyle(probe).color; probe.remove();
    return { actual: getComputedStyle(button).color, violet };
  });
  expect(colors.actual).toBe(colors.violet);
  expect(await heart(page).evaluate(button => getComputedStyle(button, "::before").content)).toBe("none");
  await page.screenshot({ path: ".scratch-pw/companion-heart-runtime-added.png" });
  await page.reload();
  await expect(actor(page)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!))).toEqual({ version: 1, ids: [id] });
  await standOnCard(page, id);
  await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
  await expect(heart(page)).not.toHaveAttribute("data-companion-heart-blocked");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  await expect(pet(page)).toHaveAttribute("data-heart-result", "removed", { timeout: 45_000 });
  await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!))).toEqual({ version: 1, ids: [] });
  await page.reload();
  await expect(actor(page)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!))).toEqual({ version: 1, ids: [] });
  await addSyntheticHeart(page, false, id);
  await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
});

test("the real companion bumps an existing human heart and cannot replace or increment it", async ({ page }) => {
  test.setTimeout(55_000);
  await page.goto("/visual-fixture/poster");
  await standOnCard(page);
  await heart(page).evaluate(button => button.setAttribute("aria-pressed", "true"));
  const humanColor = await heart(page).evaluate(button => getComputedStyle(button).color);
  await expect(pet(page)).toHaveAttribute("data-heart-result", "blocked", { timeout: 45_000 });
  await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  expect(await heart(page).evaluate(button => getComputedStyle(button).color)).toBe(humanColor);
  await expect(page.locator(".vc-effect")).toHaveText("◌");
  await page.screenshot({ path: ".scratch-pw/companion-heart-runtime-blocked.png" });
});

for (const input of ["pointer", "keyboard"] as const) {
  test(`the bundled adapter consumes the first purple ${input} click and preserves the following human handler`, async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await expect(actor(page)).toBeVisible();
    await page.evaluate(() => {
      const preferences = { ...JSON.parse(localStorage.getItem("vic.viewerCompanion")!), roam: false, heartPrank: false };
      localStorage.setItem("vic.viewerCompanion", JSON.stringify(preferences));
      window.dispatchEvent(new CustomEvent("vic:viewer-companion", { detail: preferences }));
    });
    const { id } = await addSyntheticHeart(page, false);
    await page.evaluate(id => {
      const value = JSON.stringify({ version: 1, ids: [id] });
      localStorage.setItem("vic.viewerCompanion.hearts", value);
      window.dispatchEvent(new StorageEvent("storage", { key: "vic.viewerCompanion.hearts", newValue: value }));
    }, id);
    await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
    if (input === "pointer") await heart(page).locator("svg path").click();
    else { await heart(page).focus(); await page.keyboard.press("Enter"); }
    await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
    await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!))).toEqual({ version: 1, ids: [] });
    expect(posts.get(page)).toEqual([]);

    // The fixture has no authenticated real-heart prop. Its inserted native
    // sentinel verifies original-handler delivery, not server authorization.
    if (input === "pointer") { await heart(page).focus(); await page.keyboard.press("Enter"); }
    else await heart(page).locator("svg path").click();
    await expect(heart(page)).toHaveAttribute("data-native-clicks", "1");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#companion-runtime-human-count")).toHaveText("18");
    await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  });
}
