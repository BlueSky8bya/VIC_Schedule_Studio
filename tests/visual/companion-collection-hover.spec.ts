import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY, COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_MEMORY_BOOK } from "@/lib/ui/viewer-companion/memory-book-order";
import { COMPANION_FOOD_BOOK_ORDER, COMPANION_TOY_BOOK_ORDER } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { guardCompanionQa } from "./helpers/companion-qa";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

const output = process.env.COMPANION_QA_OUTPUT ?? ".scratch-pw/collection-hover-20261023/native";
const base = process.env.COMPANION_QA_NODE_ORIGIN ?? "http://127.0.0.1:3100";
const buildDir = process.env.VISUAL_TEST_BUILD_DIR ?? ".next";
const warm = (value: string) => { const rgb = value.match(/[\d.]+/g)?.map(Number) ?? []; return rgb[0] > rgb[2]; };
const cool = (value: string) => { const rgb = value.match(/[\d.]+/g)?.map(Number) ?? []; return rgb[2] > rgb[0]; };
const seen = (page: Page) => page.evaluate(key => ({ collection: JSON.parse(localStorage.getItem(key)!).seen, toys: JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!).seen }), COMPANION_COLLECTION_KEY);
const paint = (dot: Locator) => dot.evaluate(node => {
  const style = getComputedStyle(node), box = node.getBoundingClientRect(), transform = new DOMMatrixReadOnly(style.transform);
  const ink = style.getPropertyValue("--companion-discovery").trim(), channels = /^#([a-f\d]{6})$/i.exec(ink)?.[1];
  const discovery = channels ? `rgb(${[0, 2, 4].map(i => Number.parseInt(channels.slice(i, i + 2), 16)).join(", ")})` : ink;
  return { page: node.getAttribute("data-page"), unread: node.hasAttribute("data-unread"), current: node.getAttribute("aria-current"), hover: node.hasAttribute("data-hover"), background: style.backgroundColor, discovery, image: style.backgroundImage, opacity: Number(style.opacity), scale: transform.a, box: { x: box.x, y: box.y, width: box.width, height: box.height } };
});
async function pointAt(page: Page, dot: Locator) {
  const box = await dot.boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(dot).toHaveAttribute("data-hover", "");
}

test.use({ baseURL: base, serviceWorkers: "block", isMobile: false, hasTouch: false });
for (const surface of ["viewer", "studio", "preview"] as const) for (const dark of [false, true]) {
  const name = `${surface}-${dark ? "dark" : "light"}`;
  test(`collection hover ${name}: discovery color survives native hover, press, selection and keyboard paging`, async ({ page, context }, info) => {
    test.setTimeout(100000); mkdirSync(output, { recursive: true });
    const proof = await guardCompanionQa(page, context, base), observations: unknown[] = [];
    let completed = false, originalError: string | undefined;
    const source = ["components/shared/settings-modal.css", "components/shared/companion-collection-pager.tsx", "tests/visual/companion-collection-hover.spec.ts"].map(path => ({ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") }));
    await page.addInitScript(({ preferences, memory, epoch, epochKey, dark, food, toy, behavior, wardrobe }) => {
      for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "off", "vic.dark": dark ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, feeding: false, ambientPrank: false, heartPrank: false, panelPrank: false, cardPrank: false, learnFromYou: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory }));
      localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: food, behaviors: behavior, situations: [], gifts: { pending: null, unlocked: wardrobe, equipped: null, activeMs: 0, interactionCredit: 0 }, seen: { foods: [food[0]], behaviors: [behavior[0]], situations: [], accessories: [wardrobe[0]] } }));
      localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys: toy, seen: [toy[0]], toyTastes: {}, foodTastes: {} }));
    }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, dark,
      // Prime display positions never become the first item of the measured
      // 2–5 column page. The selected detail remains unknown while its page
      // still has a discovery, separating pagination from legitimate reading.
      food: [0, 1, 13].map(i => COMPANION_FOOD_BOOK_ORDER[i]), toy: [0, 1, 13].map(i => COMPANION_TOY_BOOK_ORDER[i]),
      behavior: [COMPANION_BEHAVIOR_IDS[0], COMPANION_BEHAVIOR_IDS[1], COMPANION_MEMORY_BOOK[31].id], wardrobe: [0, 1, 13].map(i => COMPANION_WEARABLE_IDS[i]) });
    try {
      await page.setViewportSize({ width: 1600, height: 1100 });
      await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2025&m=11");
      await page.bringToFront(); await settlePanelLayout(page);
      if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
      let dialog: Locator;
      if (surface === "viewer") { const home = await openCompanionHome(page); await home.locator('[data-home-action="book"]').click(); dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); }
      else {
        if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) { await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page); }
        if (!await page.getByRole("button", { name: "설정", exact: true }).isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
        await page.getByRole("button", { name: "설정", exact: true }).click(); dialog = page.getByRole("dialog", { name: "설정", exact: true }); await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
      }
      await waitForOverlayEntrance(dialog);
      if (dark) await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      else await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
      const profile = dialog.locator(".rhh-companion-profile"), nav = profile.getByRole("tablist", { name: "빅타민 프로필", exact: true });
      await nav.getByRole("tab", { name: "도감", exact: true }).click();
      for (const kind of ["food", "toy", "memory", "wardrobe"] as const) {
        if (kind === "wardrobe") await nav.getByRole("tab", { name: "옷장", exact: true }).click();
        else await profile.locator(`[data-act="companion-collection-category"][data-act-opt="${kind === "memory" ? "behavior" : kind}"]`).click();
        const book = profile.locator(kind === "toy" ? ".rhh-companion-toy-discovery" : kind === "wardrobe" ? ".rhh-companion-wardrobe" : ".rhh-companion-discovery");
        const rail = book.getByRole("slider");
        await rail.focus(); await rail.press("Home"); await expect(rail).toHaveValue("1");
        await book.locator('ul [data-collection-index="0"]').click();
        await page.mouse.move(2, 2);
        const initialSeen = await seen(page);
        const unreadPage = await book.locator('.rhh-collection-page-dots > span[data-unread]:not([aria-current])').first().getAttribute("data-page");
        const unread = book.locator(`.rhh-collection-page-dots > span[data-page="${unreadPage}"]`), ordinary = book.locator('.rhh-collection-page-dots > span:not([data-unread]):not([aria-current])').last();
        await expect(unread).toHaveCount(1); await expect(ordinary).toHaveCount(1);
        // Newly mounted dots animate from their base ink. Observe the settled
        // discovery token before comparing native hover, rather than treating
        // an intermediate entrance color as the intended discovery color.
        await expect.poll(async () => { const sample = await paint(unread); return sample.background === sample.discovery; }).toBe(true);
        const before = await paint(unread); expect(warm(before.background)).toBe(true);
        await pointAt(page, unread); await expect.poll(async () => (await paint(unread)).scale).toBeGreaterThan(2.4);
        const hover = await paint(unread); expect(warm(hover.background)).toBe(true); expect(hover.background).toBe(before.background);
        expect(await seen(page)).toEqual(initialSeen);
        await dialog.screenshot({ path: `${output}/${name}-${kind}-unread-hover.png` });
        await page.mouse.down();
        await expect.poll(async () => (await paint(unread)).scale).toBeLessThan(2.15);
        const pressed = await paint(unread); expect(warm(pressed.background)).toBe(true); expect(pressed.background).toBe(before.background);
        await page.mouse.up(); await expect(rail).toHaveValue(String(Number(before.page) + 1));
        await expect(unread).toHaveAttribute("aria-current", "page");
        await expect(book.locator(".rhh-collection-detail")).not.toHaveAttribute("data-found");
        const current = await paint(unread); expect(current.image).toContain("linear-gradient");
        const colors = current.image.match(/rgba?\([^)]+\)/g) ?? []; expect(colors.some(warm)).toBe(true); expect(colors.some(cool)).toBe(true);
        await dialog.screenshot({ path: `${output}/${name}-${kind}-current-unread.png` });
        await pointAt(page, ordinary); await expect.poll(async () => (await paint(ordinary)).scale).toBeGreaterThan(2.4);
        const normalHover = await paint(ordinary); expect(cool(normalHover.background)).toBe(true);
        await page.mouse.move(2, 2); await rail.focus(); await rail.press("End"); await expect(rail).toHaveValue((await rail.getAttribute("max"))!);
        const lastCurrent = book.locator('.rhh-collection-page-dots > span[aria-current="page"]');
        await expect(lastCurrent).not.toHaveAttribute("data-unread"); await expect.poll(async () => cool((await paint(lastCurrent)).background)).toBe(true);
        await rail.press("Home"); await expect(rail).toHaveValue("1");
        expect(await seen(page)).toEqual(initialSeen);
        observations.push({ kind, before, hover, pressed, current, normalHover, unreadPreserved: true, keyboardPagingPreserved: true });
      }
      await Promise.allSettled(proof.pending);
      expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]);
      expect(proof.chunks.length).toBeGreaterThan(5); expect(proof.chunks.every(chunk => chunk.served === chunk.local)).toBe(true);
      expect(readFileSync(resolve(buildDir, "BUILD_ID"), "utf8").trim()).toBe(proof.build);
      completed = true;
    } catch (error) {
      originalError = error instanceof Error ? error.message : String(error); throw error;
    } finally {
      await Promise.allSettled(proof.pending);
      writeFileSync(`${output}/${name}-hover.json`, JSON.stringify({ status: completed ? "passed" : "needs-review", frameworkStatusAtFinally: info.status, originalError, name, build: proof.build, source, observations, proof: { ...proof, pending: undefined }, scope: "Synthetic prior local discoveries; native pointer hover/press/click and range keyboard paging; no runtime, clock, RNG, geometry or earned-discovery claim." }, null, 2), { flag: "wx" });
    }
  });
}
