import type { BrowserContext, Page } from "@playwright/test";

/** In-page reader for the viewport position of a fixed companion node
 * (`.vc-companion`, `.vc-food`, `.vc-toy`, `.vc-bed-foreground`).
 *
 * Older specs read `new DOMMatrixReadOnly(node.style.transform)` (or the
 * computed transform) as that position. Since 2026-10-20/25 a node resting on
 * the sofa, the home floor, a card, a date floor or a panel floor is laid out
 * from an anchored `left` / `top`, and its transform is only the offset from
 * that origin. The computed `left` / `top` of an anchored node also go stale
 * after a scroll, so for an inline `anchor()` the origin is taken from the
 * named source's own box, which is always current.
 *
 * Install before the first `goto`, then inside any `evaluate`:
 * `const p = (window as unknown as CompanionPointWindow).vcPoint(node)`.
 * `transform` overrides the transform that is read (default: computed). */
export type CompanionPointWindow = { vcPoint(node: Element, transform?: string): { x: number; y: number } };

export async function installCompanionPointReader(target: Page | BrowserContext) {
  await target.addInitScript(() => {
    (window as unknown as CompanionPointWindow).vcPoint = (node, transform) => {
      const element = node as HTMLElement, css = getComputedStyle(element);
      const value = transform ?? css.transform, matrix = new DOMMatrixReadOnly(value && value !== "none" ? value : undefined);
      const laidOut = { x: matrix.m41 + (parseFloat(css.left) || 0), y: matrix.m42 + (parseFloat(css.top) || 0) };
      if (!element.style.left.includes("anchor(")) return laidOut;
      const name = element.style.getPropertyValue("position-anchor").trim();
      const source = name ? [...document.querySelectorAll<HTMLElement>("[style*='anchor-name']")]
        .find(candidate => candidate.style.getPropertyValue("anchor-name").split(",").map(part => part.trim()).includes(name)) : undefined;
      if (!source) return laidOut;
      const rect = source.getBoundingClientRect();
      return { x: matrix.m41 + rect.left, y: matrix.m42 + rect.top };
    };
  });
}
