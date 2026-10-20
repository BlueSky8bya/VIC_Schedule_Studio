import { expect, type Page } from "@playwright/test";

/** Contact-retention paths need real clear space on both sides of the body.
 * A rail sofa is intentionally too narrow and is bordered by native controls.
 * Use the public keyboard placement flow and its actual viewport-floor landing;
 * never replace the actor's style, geometry, clock or autonomous action. */
export async function placeCompanionForContactRetention(page: Page) {
  const pet = page.locator(".vc-companion");
  const actor = pet.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  const destination = await page.locator(".poster-page").evaluate(node => {
    const calendar = node.getBoundingClientRect();
    return { x: Math.min(innerWidth - 180, Math.max(calendar.left + 180, calendar.left + calendar.width * .62)), y: innerHeight - 16 };
  });
  await actor.focus(); await actor.press("p");
  await expect(pet).toHaveAttribute("data-placing", "");
  await page.mouse.click(destination.x, destination.y); await page.mouse.move(2, 2);
  await expect(pet).not.toHaveAttribute("data-placing");
  await expect(pet).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expect(pet).not.toHaveAttribute("data-native-sofa");
  await expect(pet).not.toHaveAttribute("data-state", "jump");
  let last: { x: number; y: number } | undefined, stable = 0;
  await expect.poll(async () => {
    const current = await pet.evaluate(node => { const box = node.getBoundingClientRect(), state = (node as HTMLElement).dataset; return { x: box.left + box.width / 2, y: box.bottom, active: box.width > 0 && box.height > 0 && !node.hasAttribute("hidden") && !state.journey && ["idle", "look", "sniff"].includes(state.state ?? "") }; });
    stable = current.active && last && Math.hypot(current.x - last.x, current.y - last.y) < .05 ? stable + 1 : 0;
    last = current; return stable;
  }, { intervals: [80], timeout: 5000 }).toBeGreaterThanOrEqual(2);
}
