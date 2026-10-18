import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const copyOutput = process.env.COMPANION_COPY_REGRESSION_OUTPUT ?? ".scratch-pw/companion-114/copy";
test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });

async function openHabits(page: Page) {
  const settings = page.getByRole("button", { name: "설정", exact: true });
  const expandPanel = page.getByRole("button", { name: "패널 펼치기", exact: true });
  await expect(settings.or(expandPanel).first()).toBeVisible();
  if (!await settings.isVisible() && await expandPanel.isVisible()) await expandPanel.click();
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  return { dialog, habits: dialog.getByRole("region", { name: "배운 습관", exact: true }) };
}

for (const surface of ["viewer", "studio"] as const) for (const theme of ["light", "dark"] as const) {
  test(`${surface} ${theme}: readable learned effects preserve learning and reset choices`, async ({ page }) => {
    const writes: string[] = [], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      // Unvisited navigation links may prefetch real public loaders. Keep the
      // fixture's native settings interactions while isolating those reads.
      if (request.method() === "GET" && (pathname === "/" || pathname === "/studio")) return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
        writes.push(pathname);
        return route.fulfill({ status: 503, body: "fixture forbids writes" });
      }
      if (pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
      return route.continue();
    });
    await page.addInitScript(({ prefs, care, key, epoch, theme }) => {
      if (localStorage.getItem("fixture.habits107")) return;
      localStorage.setItem("fixture.habits107", "seeded");
      localStorage.setItem(key, epoch);
      localStorage.setItem("vic.dark", theme === "dark" ? "on" : "off");
      localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
      localStorage.setItem("vic.reduceMotion", "on"); localStorage.setItem("vic.gfxPref", "max");
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .23, affection: .64, habits: { sociability: .6, playfulness: .3, confidence: .5, credit: 0, generation: 0 } }));
    }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, theme });
    await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster");
    await page.evaluate(() => document.fonts.ready);
    const { dialog, habits } = await openHabits(page);
    await expect(habits.locator("li")).toHaveText([
      "마우스에 더 바짝 다가와요.",
      "재롱을 더 자주 부려요.",
      "잠깐 두리번거려요.",
    ]);
    await expect(habits).not.toContainText("손길");
    const reading = await habits.evaluate(region => {
      const rgb = (value: string) => {
        const parts = value.match(/[\d.]+/g)!.map(Number);
        return { channels: parts.slice(0, 3), alpha: parts[3] ?? 1 };
      };
      let background = [255, 255, 255];
      const ancestors: Element[] = [];
      for (let element: Element | null = region; element; element = element.parentElement) ancestors.unshift(element);
      for (const element of ancestors) {
        const color = rgb(getComputedStyle(element).backgroundColor);
        background = background.map((channel, i) => color.channels[i] * color.alpha + channel * (1 - color.alpha));
      }
      const luminance = (channels: number[]) => channels.map(channel => {
        const normalized = channel / 255;
        return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
      }).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
      const bgLuminance = luminance(background);
      return Array.from(region.querySelectorAll("li, p")).map(element => {
        const style = getComputedStyle(element), color = rgb(style.color), foreground = color.channels.map((channel, i) => channel * color.alpha + background[i] * (1 - color.alpha));
        const fgLuminance = luminance(foreground);
        return { fontSize: parseFloat(style.fontSize), contrast: (Math.max(bgLuminance, fgLuminance) + .05) / (Math.min(bgLuminance, fgLuminance) + .05), fits: element.scrollWidth <= element.clientWidth + 1 };
      });
    });
    expect(reading).toHaveLength(3);
    for (const item of reading) { expect(item.fontSize).toBeGreaterThanOrEqual(13.5); expect(item.contrast).toBeGreaterThanOrEqual(4.5); expect(item.fits).toBe(true); }
    const balance = await habits.evaluate(region => {
      const style = getComputedStyle(region);
      const tiles = Array.from(region.querySelectorAll("li")).map(element => element.getBoundingClientRect());
      const widths = tiles.map(tile => tile.width);
      const positions = tiles.map(tile => tile.left);
      return { widthSpread: Math.max(...widths) - Math.min(...widths), positionSpread: Math.max(...positions) - Math.min(...positions), alignment: style.textAlign, paddingDifference: Math.abs(parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) };
    });
    expect(balance.widthSpread).toBeLessThanOrEqual(1);
    expect(balance.positionSpread).toBeLessThanOrEqual(1);
    expect(["start", "left"]).toContain(balance.alignment);
    expect(balance.paddingDifference).toBeLessThanOrEqual(1);
    mkdirSync(".scratch-pw/companion-114/copy/habits", { recursive: true });
    await habits.screenshot({ path: `${copyOutput}/habits/habits-${surface}-${theme}.png` });
    await dialog.screenshot({ path: `${copyOutput}/habits/dialog-${surface}-${theme}.png` });
    const learning = dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true });
    await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
    await learning.click(); await expect(learning).toHaveAttribute("aria-checked", "false");
    await dialog.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await expect(dialog.locator(".rhh-habit-paused")).toHaveText("적용 중지");
    await expect(habits.locator("li")).toHaveCount(3);
    await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    await dialog.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await expect(habits.getByText(/아직 배운 습관이 없어요/)).toBeVisible();
    await expect(habits.locator("li")).toHaveCount(0);
    const saved = await page.evaluate(() => ({ care: JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!), prefs: JSON.parse(localStorage.getItem("vic.viewerCompanion")!) }));
    expect(saved.care.hunger).toBe(.23); expect(saved.care.affection).toBe(.64);
    expect(saved.prefs.learnFromYou).toBe(false); expect(saved.prefs.enabled).toBe(false);
    await page.reload();
    const reopened = await openHabits(page);
    await expect(reopened.habits.getByText(/아직 배운 습관이 없어요/)).toBeVisible();
    await reopened.dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
    await expect(reopened.dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    expect(writes).toEqual([]); expect(errors).toEqual([]);
  });
}
