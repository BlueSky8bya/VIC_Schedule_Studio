import { expect, type Locator, type Page } from "@playwright/test";

/** Settings redesign stage 4: movement is one choice of three and the four
 * pranks one switch. These drive the real controls on the companion `설정`
 * page; `scope` is the dialog, book or panel that page is shown in. */
export type CompanionMotionChoice = "still" | "walk" | "run";
const MOTION_LABELS: Readonly<Record<CompanionMotionChoice, string>> = { still: "가만히", walk: "걷기만", run: "뛰어다니기" };
type Scope = Page | Locator;

export const companionMotionGroup = (scope: Scope) => scope.getByRole("radiogroup", { name: "빅타민 움직임", exact: true });
export const companionMotionRadio = (scope: Scope, level: CompanionMotionChoice) => companionMotionGroup(scope).getByRole("radio", { name: MOTION_LABELS[level], exact: true });
export const companionPlayfulSwitch = (scope: Scope) => scope.getByRole("switch", { name: "빅타민 장난치기 켜기/끄기", exact: true });

/** Like `setChecked`: an already chosen level is not pressed again. */
export async function setCompanionMotion(scope: Scope, level: CompanionMotionChoice) {
  const radio = companionMotionRadio(scope, level);
  if (await radio.getAttribute("aria-checked") !== "true") await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
}

/** The old 돌아다니기 switch. Off is 가만히. On keeps a level that already
 * moves (걷기만 stays 걷기만) and otherwise chooses `moving`. */
export async function setCompanionRoam(scope: Scope, on: boolean, moving: Exclude<CompanionMotionChoice, "still"> = "run") {
  if (!on) return setCompanionMotion(scope, "still");
  if (await companionMotionRadio(scope, "still").getAttribute("aria-checked") === "true") await setCompanionMotion(scope, moving);
  else await expect(companionMotionRadio(scope, "still")).toHaveAttribute("aria-checked", "false");
}

export async function expectCompanionMotion(scope: Scope, level: CompanionMotionChoice) {
  await expect(companionMotionRadio(scope, level)).toHaveAttribute("aria-checked", "true");
}

/** The single prank switch (하트 콩 · 일정 기울이기 · 숨바꼭질 · 희귀 소품 장난). */
export async function setCompanionPlayful(scope: Scope, on: boolean) {
  const toggle = companionPlayfulSwitch(scope);
  if (await toggle.getAttribute("aria-checked") !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(on));
}
