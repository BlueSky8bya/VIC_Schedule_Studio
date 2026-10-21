import type { Page } from "@playwright/test";

/** Wait for real layout/press springs, including a resize observer delivering
 * another transition after the first animation promise has resolved. This
 * never patches clocks, styles, media queries or product geometry. */
export async function settlePanelLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const began = performance.now(); let unchangedAt = began, previous = "";
    while (performance.now() - began < 6000) {
      // Fixed souvenir flights do not participate in panel layout. They may
      // queue during real new-pose discoveries; keep observing panel geometry
      // and every other finite layout/press animation with the same bounds.
      const animations = document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)) && !((animation.effect as KeyframeEffect | null)?.target as Element | null)?.closest(".vc-companion,.vc-food-layer,.vc-discovery-flight"));
      const geometry = [...document.querySelectorAll<HTMLElement>(".panel-section,.panel-section-toggle,.vc-home-launcher,.vc-home-close,.header-left,.studio-topbar .studio-left")].map(node => {
        const rect = node.getBoundingClientRect();
        return [rect.left, rect.top, rect.width, rect.height, getComputedStyle(node).transform, node.matches(":active")];
      });
      const next = JSON.stringify(geometry), now = performance.now();
      if (next !== previous || animations.length) unchangedAt = now;
      if (now - unchangedAt >= 200) return;
      previous = next;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    throw new Error("real panel geometry did not settle within6s");
  });
}
