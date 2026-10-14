import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compile = (path: string) => ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const heartsCode = compile("lib/ui/viewer-companion/hearts.ts");
const geometryCode = compile("lib/ui/viewer-companion/geometry.ts");
type HeartAdapter = { attemptAt: (point: { x: number; y: number }) => "added" | "blocked" | "missing"; dispose: () => void };
type FixtureWindow = Window & { __hearts: HeartAdapter; __createHearts: () => HeartAdapter; __stopPlatforms: () => void; __platforms: { heart?: { blocked?: boolean } }[]; __humanClicks: number };

test.beforeEach(async ({ page }) => {
  // An isolated public-DOM fixture executes the actual adapter source. No
  // product debug API, authenticated session, server action or DB is involved.
  await page.route("**/companion-hearts-fixture", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><style>.public-event{position:relative;width:400px;height:80px;margin:30px}.event-heart{position:absolute;right:10px;top:10px;width:32px;height:32px}</style><main id="root"><article class="public-event" data-eventid="synthetic-public-a"><p>SYNTHETIC_PUBLIC_TITLE</p><span class="human-count">17</span><button class="event-heart" id="a" aria-pressed="false"><svg width="14" height="14"><path d="M1 1h10v10H1z"/></svg></button></article><article class="public-event" data-eventid="synthetic-public-b"><span class="human-count">23</span><button class="event-heart" id="b" aria-pressed="true">heart</button></article></main>` }));
  await page.route("**/*", route => route.request().method() === "POST" ? route.abort() : route.fallback());
  await page.goto("/companion-hearts-fixture");
  await page.evaluate(({ hearts, geometry }) => {
    const load = (code: string) => {
      const compiledModule = { exports: {} as Record<string, unknown> };
      new Function("module", "exports", code)(compiledModule, compiledModule.exports);
      return compiledModule.exports;
    };
    const win = window as unknown as FixtureWindow;
    const root = document.getElementById("root")!;
    localStorage.removeItem("vic.viewerCompanion.hearts");
    const create = load(hearts).createCompanionHearts as (root: HTMLElement) => HeartAdapter;
    win.__createHearts = () => create(root);
    win.__hearts = win.__createHearts();
    win.__humanClicks = 0;
    for (const button of root.querySelectorAll("button")) button.addEventListener("click", () => win.__humanClicks++);
    const observe = load(geometry).observeCompanionPlatforms as (root: HTMLElement, changed: (platforms: FixtureWindow["__platforms"]) => void) => () => void;
    win.__stopPlatforms = observe(root, platforms => { win.__platforms = platforms; });
  }, { hearts: heartsCode, geometry: geometryCode });
});

const attempt = (page: Page, selector: string) => page.evaluate(selector => {
  const rect = document.querySelector(selector)!.getBoundingClientRect();
  return (window as unknown as FixtureWindow).__hearts.attemptAt({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
}, selector);

test("a pet souvenir marks violet once without clicking or changing any human data", async ({ page }) => {
  const before = await page.locator("#root").textContent();
  expect(await attempt(page, "#a")).toBe("added");
  await expect(page.locator("#a")).toHaveAttribute("data-companion-hearted", "");
  await expect(page.locator("#a")).toHaveAttribute("aria-pressed", "false");
  expect(await attempt(page, "#a")).toBe("blocked");
  expect(await attempt(page, "#b")).toBe("blocked");
  await expect(page.locator("#b")).not.toHaveAttribute("data-companion-hearted");
  expect(await page.locator("#root").textContent()).toBe(before);
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).__humanClicks)).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!))).toEqual({ version: 1, ids: ["synthetic-public-a"] });
  await expect.poll(() => page.evaluate(() => (window as unknown as FixtureWindow).__platforms.filter(platform => platform.heart?.blocked).length)).toBe(2);
});

test("human hearts take priority immediately, including duplicate event cards", async ({ page }) => {
  await page.evaluate(() => {
    const clone = document.querySelector(".public-event")!.cloneNode(true) as HTMLElement;
    clone.querySelector("button")!.id = "copy";
    document.getElementById("root")!.append(clone);
  });
  expect(await attempt(page, "#a")).toBe("added");
  await expect(page.locator("#copy")).toHaveAttribute("data-companion-hearted", "");
  await page.locator("#copy").evaluate(node => node.setAttribute("aria-pressed", "true"));
  await expect(page.locator("#a")).not.toHaveAttribute("data-companion-hearted");
  await expect(page.locator("#copy")).not.toHaveAttribute("data-companion-hearted");
  expect(await attempt(page, "#a")).toBe("blocked");
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).__humanClicks)).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as FixtureWindow).__platforms.filter(platform => platform.heart?.blocked).length)).toBe(3);
});

test("month reuse, resize, OFF cleanup and remount preserve only correct public markers", async ({ page }) => {
  expect(await attempt(page, "#a")).toBe("added");
  await page.locator("#a").evaluate(node => node.closest("[data-eventid]")!.setAttribute("data-eventid", "synthetic-public-c"));
  await expect(page.locator("#a")).not.toHaveAttribute("data-companion-hearted");
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await attempt(page, "#a")).toBe("added");
  await page.evaluate(() => (window as unknown as FixtureWindow).__hearts.dispose());
  await expect(page.locator("[data-companion-hearted]")).toHaveCount(0);
  await expect(page.locator("[data-companion-heart-blocked]")).toHaveCount(0);
  expect(await attempt(page, "#a")).toBe("missing");
  await page.evaluate(() => { const win = window as unknown as FixtureWindow; win.__hearts = win.__createHearts(); });
  await expect(page.locator("#a")).toHaveAttribute("data-companion-hearted", "");
  expect(await attempt(page, "#a")).toBe("blocked");
  expect(await page.evaluate(() => (window as unknown as FixtureWindow).__humanClicks)).toBe(0);
});
