import { type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RowLabel, Switch } from "@/components/shared/settings-controls";
import { ACT, describeTarget } from "@/lib/activity/labels";
import { DEFAULT_COMPANION_PREFERENCES, companionWorldPreferencesKey, normalizeCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

// Owner 2026-11-20: "창이 떠 있어도 놀기" (new, default off) and the reworded
// "다른 일 할 때도 놀기" hint, which speaks to ordinary viewers, not broadcasters.
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (value: unknown) => [value, vi.fn()], useRef: (current: unknown) => ({ current }), useId: () => "play-behind", useEffect: () => {}, useLayoutEffect: () => {} }));
vi.mock("@/lib/activity/client", () => ({ logActivity: vi.fn() }));
type Element = ReactElement<Record<string, unknown>>;
let settings: typeof import("@/components/shared/companion-settings");
function nodes(value: ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element; return [element, ...nodes(element.props.children as ReactNode)];
}
beforeEach(async () => { vi.stubGlobal("React", await import("react")); settings = await import("@/components/shared/companion-settings"); });
afterEach(() => vi.unstubAllGlobals());

describe("play behind ordinary windows preference", () => {
  it("is off by default, and a record without it (an older screen) reads as off", () => {
    expect(DEFAULT_COMPANION_PREFERENCES.playBehindWindows).toBe(false);
    const older: Record<string, unknown> = { ...DEFAULT_COMPANION_PREFERENCES, playBehindWindows: true };
    delete older.playBehindWindows;
    expect(normalizeCompanionPreferences(older).playBehindWindows).toBe(false);
    expect(normalizeCompanionPreferences({ playBehindWindows: true }).playBehindWindows).toBe(true);
    // A malformed value keeps the current choice instead of turning it on.
    expect(normalizeCompanionPreferences({ playBehindWindows: "yes" }).playBehindWindows).toBe(false);
    expect(normalizeCompanionPreferences({ playBehindWindows: 1 }, { ...DEFAULT_COMPANION_PREFERENCES, playBehindWindows: true }).playBehindWindows).toBe(true);
  });
  it("switching it never restarts the creature's world", () => {
    expect(companionWorldPreferencesKey({ ...DEFAULT_COMPANION_PREFERENCES, playBehindWindows: true })).toBe(companionWorldPreferencesKey(DEFAULT_COMPANION_PREFERENCES));
    expect(companionWorldPreferencesKey({ ...DEFAULT_COMPANION_PREFERENCES, activeWhileVisible: true })).not.toBe(companionWorldPreferencesKey(DEFAULT_COMPANION_PREFERENCES));
  });
});

describe("the two rows in 더 보기", () => {
  const render = (overrides: Partial<typeof DEFAULT_COMPANION_PREFERENCES> = {}, onChange = vi.fn()) => nodes(settings.CompanionBehaviorSettings({ preferences: { ...DEFAULT_COMPANION_PREFERENCES, ...overrides }, onChange, site: { soundOn: true, soundVolume: 60, reduceMotion: false, gfx: undefined }, onGoTo: vi.fn(), active: true, radio: null }));
  const rowNamed = (all: Element[], name: string) => all.find(element => String(element.props.className).includes("role-help-haptics") && nodes(element).some(child => child.type === RowLabel && child.props.children === name));
  it("sit side by side in the fold, each with its own one-line hint and control", () => {
    const all = render(), more = all.find(element => element.props.className === "rhh-companion-more")!;
    const card = nodes(more).find(element => element.props.className === "rhh-group-card")!;
    const labels = nodes(card).filter(element => element.type === RowLabel).map(element => element.props.children);
    expect(labels).toEqual(["걸음", "자동 잠자기", "다른 일 할 때도 놀기", "창이 떠 있어도 놀기", "집어 옮기기", "쓰다듬기", "밥주기"]);
    for (const [name, key, act] of [["다른 일 할 때도 놀기", "activeWhileVisible", "companion-active-visible"], ["창이 떠 있어도 놀기", "playBehindWindows", "companion-play-behind-window"]] as const) {
      const row = rowNamed(nodes(card), name)!;
      expect(row.props["data-tip"]).toBe(settings.COMPANION_SETTING_HINTS[key]);
      const control = nodes(row).find(element => element.type === Switch)!;
      expect(control.props).toMatchObject({ dataAct: act, description: settings.COMPANION_SETTING_HINTS[key], label: `빅타민 ${name} 켜기/끄기`, on: false });
      expect(ACT[act]).toBeTruthy(); expect(describeTarget("ui.click", `${act}#on`)?.name).toBe(`빅타민 ${name} · 켜기`);
    }
  });
  it("the hints are short, plain and promise only what really happens", () => {
    const { activeWhileVisible, playBehindWindows } = settings.COMPANION_SETTING_HINTS;
    expect(activeWhileVisible).toBe("이 화면을 띄워 두고 다른 걸 써도 놀아요.");
    expect(playBehindWindows).toBe("일정·설정 창이 떠 있어도 뒤에서 놀아요.");
    for (const hint of [activeWhileVisible, playBehindWindows]) expect(hint.length, hint).toBeLessThanOrEqual(26);
    // Viewers are ordinary people; a background tab still pauses the creature.
    expect(activeWhileVisible).not.toMatch(/방송|프로그램|탭/);
  });
  it("turning it on writes only its own stored field", () => {
    const onChange = vi.fn(), control = nodes(rowNamed(render({}, onChange), "창이 떠 있어도 놀기")!).find(element => element.type === Switch)!;
    (control.props.onToggle as () => void)();
    expect(onChange.mock.calls).toEqual([[{ playBehindWindows: true }]]);
    expect(nodes(rowNamed(render({ playBehindWindows: true }), "창이 떠 있어도 놀기")!).find(element => element.type === Switch)!.props.on).toBe(true);
  });
});
