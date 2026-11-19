import { createElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSegment, RowLabel, SiteVolumeSlider, Switch } from "@/components/shared/settings-controls";
import { companionSiteVolumeBlock } from "@/lib/ui/viewer-companion/settings-status";
import { COMPANION_SOUND_HINTS, COMPANION_SOUND_MOMENTS } from "@/lib/ui/viewer-companion/companion-sound";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PERSONALITY_LAYOUT } from "@/lib/ui/viewer-companion/personality-layout";
import { chooseCompanionPreviewBehavior } from "@/lib/ui/viewer-companion/wardrobe-preview";

vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (value: unknown) => [value, vi.fn()], useRef: (current: unknown) => ({ current }), useId: () => "settings-layout", useEffect: () => {}, useLayoutEffect: () => {} }));
vi.mock("@/lib/activity/client", () => ({ logActivity: vi.fn() }));
type Element = ReactElement<Record<string, unknown>>;
let CompanionBehaviorSettings: typeof import("@/components/shared/companion-settings")["CompanionBehaviorSettings"];
let CompanionTraitControls: typeof import("@/components/shared/companion-traits")["CompanionTraitControls"];
let companionPersonalityPreview: typeof import("@/components/shared/companion-traits")["companionPersonalityPreview"];
let COMPANION_SETTING_HINTS: typeof import("@/components/shared/companion-settings")["COMPANION_SETTING_HINTS"];
let COMPANION_SOUND_LEVEL_HINTS: typeof import("@/components/shared/companion-settings")["COMPANION_SOUND_LEVEL_HINTS"];
function nodes(value: ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element; return [element, ...nodes(element.props.children as ReactNode)];
}
beforeEach(async () => { vi.stubGlobal("React", await import("react")); ({ CompanionBehaviorSettings, COMPANION_SETTING_HINTS, COMPANION_SOUND_LEVEL_HINTS } = await import("@/components/shared/companion-settings")); ({ CompanionTraitControls, companionPersonalityPreview } = await import("@/components/shared/companion-traits")); });
afterEach(() => vi.unstubAllGlobals());

describe("141 shared basic personality settings", () => {
  // Redesign stage 3: look and character moved to the "함께 지내기" page, under the portrait that already shows the
  // character's picture and description. The controls keep their shape: one label, nine choices in three columns.
  it("puts the nine character choices under their label, in the shared three-column order", () => {
    for (const personality of COMPANION_PERSONALITIES) {
      const tree = CompanionTraitControls({ preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, onChange: vi.fn(), active: true, previewing: true });
      // Until a character is chosen here there is no second drawing beside the portrait.
      expect(nodes(CompanionTraitControls({ preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, onChange: vi.fn(), active: true })).some(element => element.props.className === "rhh-personality-preview")).toBe(false);
      expect(nodes(CompanionTraitControls({ preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, onChange: vi.fn(), active: false, previewing: true })).some(element => element.props.className === "rhh-personality-preview")).toBe(false);
      const row = nodes(tree).find(element => nodes(element).some(child => child.type === RowLabel && child.props.children === "성격") && String(element.props.className).includes("rhh-companion-choice-row"))!;
      const children = row.props.children as Element[];
      expect(children[0].type).toBe(RowLabel); expect(children[0].props.children).toBe("성격");
      expect(children[1].type).toBe(SettingsSegment); expect(children[1].props.columns).toBe(3); expect(children[1].props.value).toBe(personality);
      expect(children[1].props.options).toHaveLength(9);
      expect((children[1].props.options as { value: string }[]).map(option => option.value)).toEqual(COMPANION_PERSONALITY_LAYOUT);
      // Stage 5: once chosen, the small preview of that character sits right below the nine choices.
      expect(children[2].props.className).toBe("rhh-personality-preview"); expect(children[2].props["data-personality-preview"]).toBe(personality);
      const preview = nodes(children[2]).find(element => element.props.behaviors)!;
      expect(preview.key).toBe(personality); // a new choice replays the move
      expect(preview.props).toMatchObject({ accessory: null, interactive: false, enabled: DEFAULT_COMPANION_PREFERENCES.enabled, behaviors: [companionPersonalityPreview({ ...DEFAULT_COMPANION_PREFERENCES, personality })] });
    }
  });
  it("previews only what the character would really do with the current choices", () => {
    const preview = (overrides: Partial<typeof DEFAULT_COMPANION_PREFERENCES>) => companionPersonalityPreview({ ...DEFAULT_COMPANION_PREFERENCES, ...overrides });
    expect(preview({ personality: "curious" })).toBe("pounce");
    // Movement is always free, so a roam or jump left off by an older screen changes nothing: the preview follows the same reading as the companion.
    for (const roam of [false, true]) for (const jump of [false, true]) {
      expect(preview({ personality: "curious", roam, jump })).toBe("pounce");
      expect(preview({ personality: "mischievous", roam, jump })).toBe("tumble");
    }
    expect(preview({ personality: "sleepy", sleep: false })).toBe("stretch");
    expect(preview({ personality: "affectionate", petting: false })).toBe("bow");
    for (const personality of COMPANION_PERSONALITIES) expect(chooseCompanionPreviewBehavior([preview({ personality })]), personality).not.toBeNull();
  });
  it("every row says what it does, on hover and to its control, and every sound tile says when it is heard", () => {
    const all = nodes(CompanionBehaviorSettings({ preferences: DEFAULT_COMPANION_PREFERENCES, onChange: vi.fn(), site: { soundOn: true, soundVolume: 60, reduceMotion: false, gfx: undefined }, onGoTo: vi.fn(), active: true, radio: null }));
    const hints = Object.values(COMPANION_SETTING_HINTS);
    expect(Object.keys(COMPANION_SETTING_HINTS).sort()).toEqual(["activeWhileVisible", "drag", "feeding", "panelPrank", "petting", "playful", "sleep", "speed"]);
    expect(new Set(hints).size).toBe(8); for (const hint of hints) { expect(hint.trim()).toBeTruthy(); expect(hint.length, hint).toBeLessThanOrEqual(26); }
    // Each of the eight rows carries its own short hint once, and its one control speaks the same words. The volume slider needs none.
    const rows = all.filter(element => String(element.props.className).includes("role-help-haptics") && element.props["data-tip"]);
    expect(rows.map(element => element.props["data-tip"]).sort()).toEqual([...hints].sort());
    for (const row of rows) expect(nodes(row).filter(element => element.type === Switch || element.type === SettingsSegment).map(element => element.props.description)).toEqual([row.props["data-tip"]]);
    // The sound level explains each choice on that choice, not on the row.
    const level = all.find(element => element.type === SettingsSegment && element.props.dataAct === "companion-sound-level")!;
    expect((level.props.options as { value: string; tip: string }[]).map(option => [option.value, option.tip])).toEqual(Object.entries(COMPANION_SOUND_LEVEL_HINTS));
    expect(level.props.description).toBeUndefined();
    // The panel row follows the prank switch on the screen: off and locked while it is off, back to the stored choice with it.
    const panel = (overrides: Partial<typeof DEFAULT_COMPANION_PREFERENCES>) => { const onChange = vi.fn(), found = nodes(CompanionBehaviorSettings({ preferences: { ...DEFAULT_COMPANION_PREFERENCES, ...overrides }, onChange, site: { soundOn: true, soundVolume: 60, reduceMotion: false, gfx: undefined }, onGoTo: vi.fn(), active: true, radio: null })).find(element => element.type === Switch && element.props.dataAct === "companion-panel-prank")!; return { on: found.props.on, disabled: Boolean(found.props.disabled) }; };
    expect(panel({})).toEqual({ on: true, disabled: false });
    expect(panel({ panelPrank: false })).toEqual({ on: false, disabled: false });
    expect(panel({ heartPrank: false })).toEqual({ on: false, disabled: true });
    expect(panel({ heartPrank: false, panelPrank: false })).toEqual({ on: false, disabled: true });
    // One flat grid: all fourteen sounds, no group labels; the dot marks the two only the companion makes.
    const board = all.find(element => element.props.className === "rhh-sound-board")!, tiles = board.props.children as Element[];
    expect(tiles.map(tile => tile.props["data-act-opt"]).sort()).toEqual([...COMPANION_SOUND_MOMENTS].sort());
    for (const tile of tiles) {
      const moment = tile.props["data-act-opt"] as typeof COMPANION_SOUND_MOMENTS[number];
      expect(tile.type).toBe("button"); expect(COMPANION_SOUND_HINTS[moment].trim(), moment).toBeTruthy();
      expect(tile.props["data-tip"], moment).toBe(COMPANION_SOUND_HINTS[moment]);
      const hint = nodes(tile).find(child => child.props.id === tile.props["aria-describedby"]);
      expect(hint?.props.children, moment).toBe(COMPANION_SOUND_HINTS[moment]);
      expect(hint?.props.className, moment).toBe("sr-only");
    }
    expect(tiles.filter(tile => tile.props["data-own"] === "").map(tile => tile.props["data-act-opt"])).toEqual(["eat", "tumble"]);
    expect(Object.keys(COMPANION_SOUND_HINTS).sort()).toEqual([...COMPANION_SOUND_MOMENTS].sort());
  });
  it("has no section titles: the two sections are named for assistive tech, and the sound status sits in the sound row", () => {
    const all = nodes(CompanionBehaviorSettings({ preferences: DEFAULT_COMPANION_PREFERENCES, onChange: vi.fn(), site: { soundOn: true, soundVolume: 60, reduceMotion: false, gfx: undefined }, onGoTo: vi.fn(), active: true, radio: null }));
    expect(all.filter(element => element.type === "section").map(element => element.props["aria-label"])).toEqual(["소리", "장난"]);
    expect(all.some(element => element.type === "h3" || String(element.props.className).includes("rhh-companion-section-title"))).toBe(false);
    const soundRow = all.find(element => element.props["data-settings-place"] === "companion-sound")!;
    expect(nodes(soundRow).some(element => element.props.className === "rhh-sound-status-slot" && element.props["aria-live"] === "polite")).toBe(true);
    // "더 보기" is only its name, and starts folded on a fresh page load.
    const more = all.find(element => element.props.className === "rhh-companion-more")!;
    expect(more.props.open).toBe(false);
    expect(nodes(more).find(element => element.type === "summary")!.props.children).toBe("더 보기");
  });
  it("uses the same three columns for animal and personality choices and preserves single change/reselect callbacks", () => {
    const change = vi.fn(), shown = vi.fn(), tree = CompanionTraitControls({ preferences: DEFAULT_COMPANION_PREFERENCES, onChange: change, active: false, onPreview: shown });
    const animal = nodes(tree).find(element => element.type === SettingsSegment && element.props.dataAct === "companion-animal")!;
    const personality = nodes(tree).find(element => element.type === SettingsSegment && element.props.dataAct === "companion-personality")!;
    expect(animal.props.columns).toBe(3); expect(personality.props.columns).toBe(3); expect(animal.props.options).toHaveLength(3);
    (animal.props.onChange as (value: string) => void)("dog"); (personality.props.onChange as (value: string) => void)("tidy"); (personality.props.onReselect as (value: string) => void)(DEFAULT_COMPANION_PREFERENCES.personality);
    expect(change.mock.calls).toEqual([[{ animalMode: "dog" }], [{ personality: "tidy" }], [{ personality: DEFAULT_COMPANION_PREFERENCES.personality }]]);
    expect(shown).toHaveBeenCalledTimes(2); // choosing or re-choosing a character asks for its preview; the animal mode does not
    // "무작위로 되돌리기" is offered only for a hand-picked character and writes no preference by itself.
    const random = nodes(tree).find(element => element.props["data-act"] === "companion-personality-random")!;
    expect(random.props.disabled).toBe(true);
  });
  it("the settings page has no sub-tabs and no character controls any more", () => {
    const tree = CompanionBehaviorSettings({ preferences: DEFAULT_COMPANION_PREFERENCES, onChange: vi.fn(), site: { soundOn: true, soundVolume: 60, reduceMotion: false, gfx: undefined }, onGoTo: vi.fn(), active: true, radio: null });
    expect(nodes(tree).filter(element => element.props.role === "tablist" || element.props.role === "tab" || element.props.role === "tabpanel")).toEqual([]);
    expect(nodes(tree).filter(element => element.type === SettingsSegment).map(element => element.props.dataAct)).toEqual(["companion-sound-level", "companion-speed"]);
    expect(nodes(tree).some(element => element.props["data-settings-place"] === "companion-roam" || element.props["data-motion-preview"] !== undefined)).toBe(false);
  });
});

describe("site volume on the companion sound card (owner 2026-11-19)", () => {
  const card = (soundOn: boolean, value = 40, change = vi.fn()) => nodes(CompanionBehaviorSettings({ preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true }, onChange: vi.fn(),
    site: { soundOn, soundVolume: value, reduceMotion: false, gfx: undefined }, onGoTo: vi.fn(), active: true, radio: null,
    siteVolume: createElement(SiteVolumeSlider, { value, onChange: change }) }));
  it("sits directly above 빅타민 음량 and is the one shared slider, with its own one-line hint", () => {
    const rows = card(true).filter(element => String(element.props.className).includes("role-help-haptics"));
    const labels = rows.map(row => nodes(row.props.children as ReactNode).find(element => element.type === RowLabel)?.props.children);
    expect(labels.indexOf("전체 음량") + 1).toBe(labels.indexOf("빅타민 음량"));
    const row = rows[labels.indexOf("전체 음량")];
    expect(String(row.props["data-tip"]).length).toBeLessThanOrEqual(32);
    expect(nodes(row.props.children as ReactNode).filter(element => element.type === SiteVolumeSlider)).toHaveLength(1);
  });
  it("moves the same stored value from either place: both render the same slider with the same handler", () => {
    const change = vi.fn(), slider = SiteVolumeSlider({ value: 35, onChange: change });
    const input = nodes(slider).find(element => element.type === "input")!;
    expect(input.props).toMatchObject({ "data-act": "sound-volume", "aria-label": "전체 음량", value: 35 });
    expect(input.props.disabled).toBeUndefined();
    (input.props.onChange as (event: unknown) => void)({ currentTarget: { value: "60" } });
    (input.props.onPointerUp as (event: unknown) => void)({ currentTarget: { value: "60" } });
    // Only a slider key finishes the change (and plays the level); Tab/Shift do not.
    for (const key of ["Tab", "Shift", "ArrowRight", "PageUp"]) (input.props.onKeyUp as (event: unknown) => void)({ key, currentTarget: { value: "60" } });
    expect(change.mock.calls).toEqual([[60], [60, true], [60, true], [60, true]]);
    expect(nodes(slider).find(element => element.props.className === "rhh-vol-num")?.props.children).toBe(35);
  });
  it("is dimmed with the site sound reason while the site sound is off", () => {
    expect(companionSiteVolumeBlock({ soundOn: true })).toBeNull();
    const rows = card(false).filter(element => String(element.props.className).includes("role-help-haptics"));
    const row = rows.find(element => element.props["data-tip"] && nodes(element.props.children as ReactNode).some(child => child.type === SiteVolumeSlider))!;
    expect(String(row.props.className)).toContain("is-blocked");
    expect(card(false).some(element => element.props.text === "사이트 효과음이 꺼져 있어요" && element.props.place === "site-sound")).toBe(true);
  });
});
