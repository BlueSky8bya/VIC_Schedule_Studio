import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSegment, RowLabel } from "@/components/shared/settings-controls";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PERSONALITY_LAYOUT } from "@/lib/ui/viewer-companion/personality-layout";
import { chooseCompanionPreviewBehavior } from "@/lib/ui/viewer-companion/wardrobe-preview";

vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (value: unknown) => [value, vi.fn()], useRef: (current: unknown) => ({ current }), useId: () => "settings-layout", useEffect: () => {}, useLayoutEffect: () => {} }));
vi.mock("@/lib/activity/client", () => ({ logActivity: vi.fn() }));
type Element = ReactElement<Record<string, unknown>>;
let CompanionBehaviorSettings: typeof import("@/components/shared/companion-settings")["CompanionBehaviorSettings"];
let CompanionTraitControls: typeof import("@/components/shared/companion-traits")["CompanionTraitControls"];
let companionPersonalityPreview: typeof import("@/components/shared/companion-traits")["companionPersonalityPreview"];
let COMPANION_MOTION_PREVIEWS: typeof import("@/components/shared/companion-settings")["COMPANION_MOTION_PREVIEWS"];
function nodes(value: ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element; return [element, ...nodes(element.props.children as ReactNode)];
}
beforeEach(async () => { vi.stubGlobal("React", await import("react")); ({ CompanionBehaviorSettings, COMPANION_MOTION_PREVIEWS } = await import("@/components/shared/companion-settings")); ({ CompanionTraitControls, companionPersonalityPreview } = await import("@/components/shared/companion-traits")); });
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
    expect(preview({ personality: "curious", jump: false })).toBe("bow");
    // Standing still, a jump left on is not shown either: the preview follows the same reading as the companion.
    expect(preview({ personality: "curious", roam: false, jump: true })).toBe("bow");
    expect(preview({ personality: "mischievous", roam: false, jump: true })).toBe("bow");
    expect(preview({ personality: "sleepy", sleep: false })).toBe("stretch");
    expect(preview({ personality: "affectionate", petting: false })).toBe("bow");
    for (const personality of COMPANION_PERSONALITIES) expect(chooseCompanionPreviewBehavior([preview({ personality })]), personality).not.toBeNull();
  });
  it("the movement row previews standing, walking, and walking with jumps; nothing moves while the row is stopped", () => {
    expect(COMPANION_MOTION_PREVIEWS).toEqual({ still: [], walk: ["preview-walk"], run: ["preview-walk", "pounce"] });
    const site = { soundOn: true, soundVolume: 60, reduceMotion: false, gfx: undefined };
    const box = (preferences: typeof DEFAULT_COMPANION_PREFERENCES, gates = site) => { const tree = CompanionBehaviorSettings({ preferences, onChange: vi.fn(), site: gates, onGoTo: vi.fn(), active: true, radio: null }); const host = nodes(tree).find(element => element.props.className === "rhh-motion-preview")!; return { level: host.props["data-motion-preview"], preview: nodes(host).find(element => element.props.behaviors)! }; };
    for (const [roam, jump, level] of [[false, false, "still"], [false, true, "still"], [true, false, "walk"], [true, true, "run"]] as const) {
      const { level: shown, preview } = box({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam, jump });
      expect(shown).toBe(level); expect(preview.key).toBeNull(); // the drawing stays mounted; only what it plays changes
      expect(preview.props).toMatchObject({ behaviors: COMPANION_MOTION_PREVIEWS[level], enabled: true, interactive: false, accessory: null });
    }
    expect(box({ ...DEFAULT_COMPANION_PREFERENCES, enabled: false }).preview.props.enabled).toBe(false);
    expect(box({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true }, { ...site, reduceMotion: true }).preview.props.enabled).toBe(false);
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
    expect(nodes(tree).filter(element => element.type === SettingsSegment).map(element => element.props.dataAct)).toEqual(["companion-sound-level", "companion-motion-level", "companion-speed"]);
  });
});
