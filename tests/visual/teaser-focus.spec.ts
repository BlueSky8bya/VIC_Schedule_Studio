import { expect, test } from "@playwright/test";
import { samplePublicScheduleData } from "../../lib/schedules/sample-public-data";
import { buildPremiereFixture } from "../../lib/schedules/premiere-fixture";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

for (const width of [1440, 390]) {
  test(`card/detail/dock hand off one countdown at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/visual-fixture/poster?premiere=170");
    await expect(page.locator(".pm-stage")).toBeVisible();
    const card = page.locator("[data-pm-target]");
    await card.evaluate(el => el.scrollIntoView({ block: "center" }));
    await expect(page.locator(".pm-stage")).toHaveAttribute("data-clock-owner", "card");
    await expect(page.locator(".pm-readout")).toHaveCount(0);
    await card.click();
    await expect(page.locator(".pm-stage")).toHaveAttribute("data-clock-owner", "detail");
    await expect(card.locator(".teaser-count-quiet")).toHaveText("최초공개");
    await expect(page.locator(".pm-readout")).toHaveCount(0);
    await expect(page.getByRole("timer")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.locator(".pm-stage")).toHaveCount(0);
  });

  test(`release separates a long title from indented subtopics at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/visual-fixture/poster?premiere=4&scenario=outline");
    await expect(page.locator(".pm-story h2")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".pm-story h2")).not.toContainText("첫 번째 편지");
    await expect(page.locator(".pm-subtopics li")).toHaveCount(7);
    const sizes = await page.locator(".pm-story").evaluate(el => ({ title: parseFloat(getComputedStyle(el.querySelector("h2")!).fontSize), sub: parseFloat(getComputedStyle(el.querySelector("li")!).fontSize), weight: getComputedStyle(el.querySelector("li")!).fontWeight, indentation: parseFloat(getComputedStyle(el.querySelector('[data-depth="2"]')!).marginInlineStart) }));
    expect(sizes.title).toBeGreaterThan(sizes.sub * 1.3); expect(sizes.weight).toBe("400"); expect(sizes.indentation).toBeGreaterThan(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeInViewport();
    await expect(page.locator(".pm-screen")).toHaveScreenshot(`premiere-outline-${width}.png`, { animations: "disabled" });
  });
}

test("the dock supplies time only while the source card is outside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/visual-fixture/poster?premiere=170");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-clock-owner", "dock");
  const first = await page.locator(".pm-readout").textContent();
  await expect.poll(() => page.locator(".pm-readout").textContent(), { timeout: 2500 }).not.toBe(first);
  await page.locator("[data-pm-target]").evaluate(el => el.scrollIntoView({ block: "center" }));
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-clock-owner", "card");
  await expect(page.locator(".pm-readout")).toHaveCount(0);
});

test("60→10 numeric texture settles, then 10→2 removes the ring and safe controls", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=35");
  const stage = page.locator(".pm-stage");
  await expect(stage).toBeVisible();
  const before = await stage.evaluate(el => (el as HTMLElement).style.getPropertyValue("--pm-digit-x"));
  await expect.poll(() => stage.evaluate(el => (el as HTMLElement).style.getPropertyValue("--pm-digit-x"))).not.toBe(before);
  await page.goto("/visual-fixture/poster?premiere=10");
  await expect(stage).toBeVisible();
  const ring = page.locator(".pm-count .dt-ring");
  await expect.poll(() => stage.evaluate(el => (el as HTMLElement).style.getPropertyValue("--pm-digit-x"))).toBe("0px");
  await expect.poll(() => ring.evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 10000 }).toBeLessThan(.03);
  expect(await page.locator(".pm-count .dt-count-core").evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeGreaterThan(1.3);
  await expect(page.locator(".pm-masked")).toHaveAttribute("inert");
  await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeEnabled();
});

for (const edit of [false, true]) {
  test(`studio enters one stable premiere after the fresh public snapshot${edit ? " and queued write" : ""}`, async ({ page }) => {
    test.setTimeout(30000);
    const actions = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node as Record<string, { exportedName?: string }>;
    const previewActionIds = new Set(Object.entries(actions).filter(([, value]) => value.exportedName === "getPublicPreviewAction").map(([id]) => id));
    const started = Date.now(), timeline: string[] = [];
    let snapshots = 0, refreshes = 0;
    const state = () => buildPremiereFixture(started, [50], Date.now());
    await page.route("**/api/public/vic/teaser-state**", route => route.fulfill({ json: state() }));
    await page.route("**/*", async route => {
      const req = route.request();
      if (req.method() === "POST" && new URL(req.url()).pathname === "/api/studio-write") {
        timeline.push("save-start"); await new Promise(resolve => setTimeout(resolve, 1200)); timeline.push("save-end");
        return route.fulfill({ json: { ok: true, id: "synthetic-saved" } });
      }
      if (req.method() === "POST" && previewActionIds.has(req.headers()["next-action"])) {
        snapshots++; timeline.push("snapshot"); await new Promise(resolve => setTimeout(resolve, 1800));
        const snap = { ...samplePublicScheduleData, events: [...samplePublicScheduleData.events, ...state().entries.map(entry => entry.event)] };
        return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(snap)}\n` });
      }
      if (req.method() === "GET" && req.headers().rsc && !req.headers()["next-router-prefetch"] && new URL(req.url()).pathname === "/visual-fixture/studio") refreshes++;
      return route.fallback();
    });
    await page.goto("/visual-fixture/studio?premiere=50");
    await page.locator("[data-act='calendar-cell']").first().waitFor();
    if (edit) {
      await page.locator("[data-act='calendar-cell']").nth(10).dblclick();
      await page.locator("[data-act='title-input']:visible").fill("합성 저장 후 미리보기");
      await page.keyboard.press("Control+Enter");
      await expect.poll(() => timeline.includes("save-start")).toBe(true);
    }
    await page.getByRole("button", { name: "시청자 화면 보여주기", exact: true }).click();
    await expect(page.locator(".viewer-fullscreen")).toBeVisible();
    await expect(page.locator(".pm-stage")).toHaveCount(0);
    await expect.poll(() => snapshots).toBe(1);
    await expect(page.locator(".pm-focused")).toBeVisible({ timeout: 10000 });
    expect(await page.locator(".viewer-fullscreen").textContent()).not.toContain("STUDIO_ONLY_PREMIERE_CANARY");
    if (edit) expect(timeline.indexOf("snapshot")).toBeGreaterThan(timeline.indexOf("save-end"));
    await page.locator(".pm-stage").evaluate(el => { el.setAttribute("data-test-same-instance", "true"); });
    const count = Number(await page.locator(".pm-count .dt-count-core strong").textContent());
    await expect.poll(async () => Number(await page.locator(".pm-count .dt-count-core strong").textContent()), { timeout: 5000 }).toBeLessThanOrEqual(count - 3);
    await expect(page.locator(".pm-stage")).toHaveAttribute("data-test-same-instance", "true");
    expect(snapshots).toBe(1); expect(refreshes).toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(".pm-stage")).toHaveCount(0);
    await page.getByRole("button", { name: "편집실로 가기", exact: true }).click();
    await expect(page.locator("[data-act='calendar-cell']").first()).toBeVisible();
    if (edit) await expect.poll(() => refreshes).toBeGreaterThan(0);
    else expect(refreshes).toBe(0);
  });
}
