import { expect, test, type Page } from "@playwright/test";
import type { TeaserStateSnapshot } from "@/lib/schedules/teaser-state";

const title = "일정 최초공개 테스트입니다. 안녕하세요";
const subtopics = ["with ooo, rrr, uuu, xxx", "월드컵 시네티", "  VRChat 모캡"];
const body = "함께 기다려 준 여러분께 새로운 소식을 전합니다.";
const tagIds = ["tag-worldcup", "tag-collab", "tag-big-server", "tag-full-track", "tag-calm", "tag-variety-game", "tag-song", "tag-ck"];

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

async function content(page: Page, options: { long?: boolean; timed?: boolean; multiple?: boolean } = {}) {
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), snapshot = await response.json() as TeaserStateSnapshot;
    for (const [index, item] of snapshot.entries.entries()) {
      if (item.state !== "released") continue;
      item.dateKey = `2026-06-${18 + index}`;
      item.event.startsAt = `${item.dateKey}T${options.timed ? "20:30" : "00:00"}:00+09:00`;
      item.event.isAllDay = !options.timed;
      item.event.publicTitle = [options.multiple ? `${title} ${index + 1}` : title, ...subtopics].join("\n");
      item.event.publicDescription = options.long ? Array.from({ length: 45 }, (_, n) => `${n + 1}. ${body}`).join("\n") : body;
      item.event.tagIds = options.multiple ? tagIds.slice(index * 4, index * 4 + 4) : tagIds;
      item.event.primaryTagIds = item.event.tagIds.slice(0, 2);
    }
    await route.fulfill({ response, json: snapshot });
  });
  // Leave the existing three-second clock-validation safety margin intact.
  await page.goto(`/visual-fixture/poster?premiere=5${options.multiple ? "&count=2" : ""}`);
  expect(await page.content()).not.toContain(title);
  await expect(page.locator(".pm-complete")).toBeVisible({ timeout: 10000 });
}

for (const [width, height, font] of [[1100, 780, "cookierun"], [390, 844, "base"], [844, 390, "base"]] as const) {
  test(`long title, all tags and subtopics fit the first view at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(font => localStorage.setItem("vic.font", font), font);
    await content(page);
    const screen = page.locator(".pm-screen");
    await expect(page.locator(".pm-tags span")).toHaveCount(8);
    await expect(page.locator(".pm-story h2")).toHaveText(title);
    await expect(page.locator(".pm-subtopics li")).toHaveCount(3);
    await expect(page.locator(".pm-keepsake, .pm-date, .pm-complete .pm-heading")).toHaveCount(0);
    await expect(page.locator(".pm-story")).not.toContainText("하루 종일");
    await expect(page.locator(".pm-start-time")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ["dark", "light"]) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      const contrasts = await screen.evaluate(el => {
        const context = document.createElement("canvas").getContext("2d")!;
        const luminance = (color: string) => {
          context.fillStyle = color; context.fillRect(0, 0, 1, 1);
          const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const background = luminance(getComputedStyle(el).backgroundColor);
        return [...el.querySelectorAll(".pm-meta-date, .pm-subtopics, .pm-details")].map(node => {
          const foreground = luminance(getComputedStyle(node).color);
          return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
        });
      });
      expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5);
    }
    await expect(page.locator(".pm-details")).toBeInViewport({ ratio: 1 });
    for (const tag of await page.locator(".pm-tags span").all()) await expect(tag).toBeInViewport({ ratio: 1 });
    const metrics = await screen.evaluate(el => {
      const title = el.querySelector("h2")!, sub = el.querySelector(".pm-subtopics")!;
      return { overflow: el.scrollHeight - el.clientHeight, width: document.documentElement.scrollWidth - innerWidth,
        title: parseFloat(getComputedStyle(title).fontSize), sub: parseFloat(getComputedStyle(sub).fontSize) };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(2); expect(metrics.width).toBeLessThanOrEqual(0);
    expect(metrics.title).toBeGreaterThan(metrics.sub * 1.3); expect(metrics.sub).toBeGreaterThanOrEqual(16);
    await expect(page.getByRole("button", { name: "상세 보기", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeInViewport();
    await expect(screen).toHaveScreenshot(`premiere-content-${width}x${height}.png`, { animations: "disabled" });
  });
}

test("actual time appears once in the metadata, and each released event owns its tags/date", async ({ page }) => {
  await content(page, { timed: true, multiple: true });
  const events = page.locator(".pm-film.released");
  await expect(events).toHaveCount(2);
  await expect(events.first().locator('.pm-meta-date time[datetime="2026-06-18"]')).toHaveCount(1);
  await expect(events.last().locator('.pm-meta-date time[datetime="2026-06-19"]')).toHaveCount(1);
  for (const event of await events.all()) {
    await expect(event.locator(".pm-start-time")).toHaveCount(1);
    await expect(event.locator(".pm-start-time")).toHaveText(/8:30/);
    await expect(event.locator(".pm-tags span")).toHaveCount(4);
  }
  await expect(events.first().locator(".pm-tags")).toContainText("합방");
  await expect(events.last().locator(".pm-tags")).not.toContainText("합방");
});

test("extreme content stays complete with one keyboard scroller and a persistent exit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await content(page, { long: true });
  const screen = page.locator(".pm-screen");
  await expect(page.locator(".pm-details")).toContainText(`45. ${body}`);
  await page.getByRole("button", { name: "상세 보기", exact: true }).focus();
  await page.keyboard.press("End");
  await expect.poll(() => screen.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThanOrEqual(2);
  expect(await page.locator(".pm-story, .pm-film, .pm-details, .pm-tags").evaluateAll(els => els.filter(el => /^(auto|scroll)$/.test(getComputedStyle(el).overflowY)).length)).toBe(0);
  await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeInViewport();
  await page.waitForTimeout(4000);
  await expect(page.locator(".pm-complete")).toBeVisible();
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await expect(page.locator(".pm-stage")).toHaveCount(0);
});
