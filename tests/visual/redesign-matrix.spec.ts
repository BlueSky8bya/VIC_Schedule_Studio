import { expect, test, type Page } from "@playwright/test";

type FixtureTheme = "light" | "eye-comfort" | "dark";

const DARK_TOKEN_FIXTURE: Record<string, string> = {
  "--ink": "#f7f3fb",
  "--ink-soft": "#ded7e8",
  "--muted": "#b9afc4",
  "--line": "#51495b",
  "--line-soft": "#37313f",
  "--paper": "#151218",
  "--surface": "#24202a",
  "--surface-2": "#1a171f",
  "--studio-workbench": "#100e13",
  "--glass": "rgb(36 32 42 / 78%)",
  "--glass-strong": "rgb(36 32 42 / 90%)",
  "--glass-border": "rgb(255 255 255 / 18%)",
  "--material-bg": "rgb(36 32 42 / 78%)",
  "--material-bg-strong": "rgb(36 32 42 / 90%)",
  "--violet": "#a38cff",
  "--violet-soft": "#352d52",
  "--green": "#56d889",
  "--amber": "#ffc75a",
  "--coral": "#ff8878",
  "--selection-fill": "#352d52",
  "--selection-border": "#a38cff",
  "--status-success-fill": "#1f3529",
  "--status-warning-fill": "#392f1c",
  "--status-danger-fill": "#3a2525",
};

async function prepareTheme(page: Page, theme: FixtureTheme) {
  await page.addInitScript(
    ({ fixtureTheme, darkTokens }) => {
      try {
        localStorage.setItem("vic.reduceMotion", "on");
        localStorage.setItem(
          "vic.eyeComfort",
          fixtureTheme === "eye-comfort" ? "on" : "off",
        );
      } catch {
        /* storage unavailable */
      }

      const applyFixtureTheme = () => {
        document.documentElement.setAttribute("data-reduce-motion", "1");
        if (fixtureTheme === "eye-comfort") {
          document.documentElement.setAttribute("data-eye-comfort", "1");
        }
        if (fixtureTheme !== "dark") return;
        document.documentElement.dataset.visualTheme = "dark";
        document.documentElement.style.colorScheme = "dark";
        for (const [token, value] of Object.entries(darkTokens)) {
          document.documentElement.style.setProperty(token, value);
        }
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyFixtureTheme, {
          once: true,
        });
      } else {
        applyFixtureTheme();
      }
    },
    { fixtureTheme: theme, darkTokens: DARK_TOKEN_FIXTURE },
  );
}

async function settle(page: Page, selector: string) {
  await page.locator(selector).first().waitFor({ state: "visible" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.dispatchEvent(new Event("resize"));
  });
  await page.addStyleTag({
    content:
      ".build-tag,.studio-build-tag,.netstat{visibility:hidden!important}*{caret-color:transparent!important}",
  });
}

test.describe("Apple redesign visual matrix", () => {
  test("owner Studio — desktop light", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepareTheme(page, "light");
    await page.goto("/visual-fixture/studio?role=owner");
    await settle(page, ".studio-shell");

    await expect(page.locator(".studio-mobile")).toHaveCount(0);
    await expect(page).toHaveScreenshot("studio-owner-web-light.png");
  });

  test("manager Studio — native mobile light", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareTheme(page, "light");
    await page.goto("/visual-fixture/studio?role=manager");
    await settle(page, ".studio-mobile");

    await expect(page.locator(".studio-topbar")).toHaveCount(0);
    await expect(page).toHaveScreenshot("studio-manager-mobile-light.png");
  });

  test("taxonomy overlay — developer eye-comfort", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepareTheme(page, "eye-comfort");
    await page.goto("/visual-fixture/studio?role=developer&panel=tags");
    await settle(page, ".modal-card-tags");

    await expect(page.locator("html")).toHaveAttribute("data-eye-comfort", "1");
    await expect(page).toHaveScreenshot("tags-developer-web-eye-comfort.png");
  });

  test("role boundary keeps taxonomy and drawing controls distinct", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await prepareTheme(page, "light");

    await page.goto("/visual-fixture/studio?role=manager&panel=tags");
    await settle(page, ".studio-shell");
    await expect(page.locator(".modal-card-tags")).toHaveCount(0);

    for (const role of ["owner", "developer", "manager", "worker"] as const) {
      await page.goto(`/visual-fixture/studio?role=${role}&viewer=1`);
      await settle(page, ".poster-page");
      const drawingButtons = page.getByRole("button", { name: "일정 그림판" });
      if (role === "owner" || role === "developer") {
        expect(await drawingButtons.count()).toBeGreaterThan(0);
        await expect(drawingButtons.first()).toBeVisible();
      } else {
        await expect(drawingButtons).toHaveCount(0);
      }
    }
  });

  test("system recovery — mobile dark fixture", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareTheme(page, "dark");
    await page.goto("/visual-fixture/not-a-route");
    await settle(page, ".system-state-card");

    await expect(page.locator("html")).toHaveAttribute(
      "data-visual-theme",
      "dark",
    );
    const action = page.locator(".system-state-action");
    await expect(action).toBeVisible();
    expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page).toHaveScreenshot("not-found-mobile-dark.png");
  });

  test("offline status stays outside export surface", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareTheme(page, "light");
    await page.goto("/visual-fixture/poster");
    await settle(page, "[data-export-surface]");
    await page.addStyleTag({
      content: ".netstat{visibility:visible!important}",
    });
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    const badge = page.locator(".netstat-badge");
    await expect(badge).toBeVisible();
    expect((await badge.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("[data-export-surface] .netstat")).toHaveCount(0);
  });

  for (const theme of ["light", "eye-comfort", "dark"] as const) {
    test(`semantic surface contrast — ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await prepareTheme(page, theme);
      await page.goto("/visual-fixture/not-a-route");
      await settle(page, ".system-state-card");

      const ratios = await page.evaluate(() => {
        function rgba(value: string) {
          const trimmed = value.trim();
          if (trimmed.startsWith("#")) {
            const hex =
              trimmed.length === 4
                ? trimmed
                    .slice(1)
                    .split("")
                    .map((digit) => digit + digit)
                    .join("")
                : trimmed.slice(1, 7);
            return {
              r: Number.parseInt(hex.slice(0, 2), 16),
              g: Number.parseInt(hex.slice(2, 4), 16),
              b: Number.parseInt(hex.slice(4, 6), 16),
              a: 1,
            };
          }
          const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
          const srgbFunction = trimmed.startsWith("color(srgb");
          const scale = srgbFunction ? 255 : 1;
          return {
            r: (channels[0] ?? 0) * scale,
            g: (channels[1] ?? 0) * scale,
            b: (channels[2] ?? 0) * scale,
            a: channels[3] ?? 1,
          };
        }
        function composite(
          foreground: ReturnType<typeof rgba>,
          background: ReturnType<typeof rgba>,
        ) {
          return {
            r: foreground.r * foreground.a + background.r * (1 - foreground.a),
            g: foreground.g * foreground.a + background.g * (1 - foreground.a),
            b: foreground.b * foreground.a + background.b * (1 - foreground.a),
            a: 1,
          };
        }
        function luminance(color: ReturnType<typeof rgba>) {
          const channel = (value: number) => {
            const srgb = value / 255;
            return srgb <= 0.04045
              ? srgb / 12.92
              : ((srgb + 0.055) / 1.055) ** 2.4;
          };
          return (
            channel(color.r) * 0.2126 +
            channel(color.g) * 0.7152 +
            channel(color.b) * 0.0722
          );
        }
        function ratio(foreground: string, background: string, base: string) {
          const bg = composite(rgba(background), rgba(base));
          const fg = composite(rgba(foreground), bg);
          const lighter = Math.max(luminance(fg), luminance(bg));
          const darker = Math.min(luminance(fg), luminance(bg));
          return (lighter + 0.05) / (darker + 0.05);
        }

        const probe = document.createElement("div");
        probe.style.color = "var(--ink)";
        probe.style.background = "var(--material-bg-strong)";
        document.body.append(probe);
        const computed = getComputedStyle(probe);
        const root = getComputedStyle(document.documentElement);
        const body = ratio(
          computed.color,
          computed.backgroundColor,
          root.getPropertyValue("--surface-2"),
        );
        probe.style.color = "var(--ink-soft)";
        probe.style.background = "var(--status-warning-fill)";
        const warning = getComputedStyle(probe);
        const warningRatio = ratio(
          warning.color,
          warning.backgroundColor,
          root.getPropertyValue("--surface-2"),
        );
        probe.remove();
        return { body, warning: warningRatio };
      });

      expect(ratios.body).toBeGreaterThanOrEqual(4.5);
      expect(ratios.warning).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const ipad of [
    { name: "landscape", width: 1024, height: 768 },
    { name: "portrait", width: 820, height: 1180 },
  ] as const) {
    test(`iPad drawing board — ${ipad.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await prepareTheme(
        page,
        ipad.name === "portrait" ? "eye-comfort" : "light",
      );
      await page.goto("/visual-fixture/studio?role=owner&viewer=1");
      await settle(page, ".poster-page");
      await page.getByRole("button", { name: "일정 그림판" }).first().click();
      await settle(page, ".broadcast-panel");
      if (ipad.name === "portrait") {
        await page.setViewportSize({ width: ipad.width, height: ipad.height });
        await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      }

      await expect(page.locator(".bp-toolbar")).toBeVisible();
      await expect(page.locator(".bp-layers-panel")).toBeVisible();
      const tool = page.locator(".bp-tool").first();
      expect((await tool.boundingBox())?.height).toBeGreaterThanOrEqual(44);

      const canvas = page.locator("canvas.bp-canvas:not(.hidden)").first();
      const canvasSize = await canvas.evaluate((element) => ({
        height: (element as HTMLCanvasElement).height,
        width: (element as HTMLCanvasElement).width,
      }));
      expect(canvasSize.height).toBeGreaterThan(0);
      expect(canvasSize.width).toBeGreaterThan(0);

      if (ipad.name === "landscape") {
        const before = await canvas.evaluate((element) =>
          (element as HTMLCanvasElement).toDataURL(),
        );
        const drawSurface = page.locator(".bp-draw-surface");
        const box = await drawSurface.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          await page.mouse.move(
            box.x + box.width * 0.3,
            box.y + box.height * 0.4,
          );
          await page.mouse.down();
          await page.mouse.move(
            box.x + box.width * 0.55,
            box.y + box.height * 0.55,
            {
              steps: 8,
            },
          );
          await page.mouse.up();
        }
        const after = await canvas.evaluate((element) =>
          (element as HTMLCanvasElement).toDataURL(),
        );
        expect(after).not.toBe(before);
      }

      await expect(page).toHaveScreenshot(`broadcast-ipad-${ipad.name}.png`);
    });
  }
});
