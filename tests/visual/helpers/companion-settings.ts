import { expect, type Locator, type Page } from "@playwright/test";

/** Movement is no longer a setting (2026-11-19): the shipping companion always
 * walks and jumps. Screen checks still need it standing still, so the visual
 * config seeds `vic.qa.companionStoredMotion` and these helpers write the
 * stored `roam` / `jump` fields directly, the way another tab would. The four
 * pranks are one real switch on the companion `설정` page; `scope` is the
 * page, or the dialog, book or panel that page is shown in. */
export type CompanionMotionChoice = "still" | "walk" | "run";
type Scope = Page | Locator;
const pageOf = (scope: Scope): Page => "page" in scope ? scope.page() : scope;
const stored = (scope: Scope) => pageOf(scope).evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion") ?? "{}") as { roam?: boolean; jump?: boolean });
const levelOf = (value: { roam?: boolean; jump?: boolean }): CompanionMotionChoice => value.roam === false ? "still" : value.jump === false ? "walk" : "run";

export const companionPlayfulSwitch = (scope: Scope) => scope.getByRole("switch", { name: "빅타민 장난치기 켜기/끄기", exact: true });

/** Still writes only `roam`, so the earlier jump choice returns with it. */
export async function setCompanionMotion(scope: Scope, level: CompanionMotionChoice) {
  await pageOf(scope).evaluate(patch => {
    const key = "vic.viewerCompanion", next = JSON.stringify({ version: 1, ...JSON.parse(localStorage.getItem(key) ?? "{}"), ...patch });
    localStorage.setItem(key, next);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: next }));
  }, level === "still" ? { roam: false } : { roam: true, jump: level === "run" });
  await expectCompanionMotion(scope, level);
}

/** Off stands still. On keeps a level that already moves and otherwise chooses `moving`. */
export async function setCompanionRoam(scope: Scope, on: boolean, moving: Exclude<CompanionMotionChoice, "still"> = "run") {
  if (!on) return setCompanionMotion(scope, "still");
  if (levelOf(await stored(scope)) === "still") await setCompanionMotion(scope, moving);
}

export async function expectCompanionMotion(scope: Scope, level: CompanionMotionChoice) {
  await expect.poll(async () => levelOf(await stored(scope))).toBe(level);
}

/** The single prank switch (하트 콩 · 일정 기울이기 · 숨바꼭질 · 희귀 소품 장난). */
export async function setCompanionPlayful(scope: Scope, on: boolean) {
  const toggle = companionPlayfulSwitch(scope);
  if (await toggle.getAttribute("aria-checked") !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(on));
}
