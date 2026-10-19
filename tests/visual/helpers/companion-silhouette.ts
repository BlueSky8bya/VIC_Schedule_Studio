import { expect, type Locator } from "@playwright/test";

/**135 restores shape clues deliberately; names/stories and full colors stay
 * undiscovered. Test the actual rendered filter rather than forbidding art. */
export async function assertCompanionSilhouettes(scope: Locator) {
  const pictures = await scope.locator('.rhh-collection-tile:not([data-found])').evaluateAll(nodes => nodes.map(node => {
    const art = node.querySelector<HTMLElement>('.vc-collection-art,.vc-toy-art,.rhh-memory-silhouette');
    const style = art && getComputedStyle(art), box = art?.getBoundingClientRect();
    return { label: node.getAttribute('aria-label'), text: node.textContent, found: node.hasAttribute('data-found'), artCount: node.querySelectorAll('.vc-collection-art,.vc-toy-art,.rhh-memory-silhouette').length, filter: style?.filter, opacity: Number(style?.opacity), width: box?.width, height: box?.height, questions: node.querySelectorAll('.rhh-collection-unknown,.rhh-toy-unknown').length };
  }));
  for (const picture of pictures) {
    expect(picture.label).toMatch(/^\?\?\? · \d+$/); expect(picture.text).toContain('???');
    expect(picture.found).toBe(false); expect(picture.artCount).toBe(1); expect(picture.questions).toBe(0);
    expect(picture.filter).toMatch(/^brightness\(0\)/); expect(picture.opacity).toBeGreaterThanOrEqual(.25); expect(picture.opacity).toBeLessThanOrEqual(.45);
    expect(picture.width).toBeGreaterThan(20); expect(picture.height).toBeGreaterThan(20);
  }
  return pictures;
}
