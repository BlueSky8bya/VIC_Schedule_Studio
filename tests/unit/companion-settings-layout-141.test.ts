import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSegment, RowLabel } from "@/components/shared/settings-controls";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_SUMMARIES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (value: unknown) => [value, vi.fn()], useRef: (current: unknown) => ({ current }), useId: () => "settings-layout", useEffect: () => {}, useLayoutEffect: () => {} }));
vi.mock("@/lib/activity/client", () => ({ logActivity: vi.fn() }));
type Element = ReactElement<Record<string, unknown>>;
let CompanionBehaviorSettings: typeof import("@/components/shared/companion-settings")["CompanionBehaviorSettings"];
function nodes(value: ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element; return [element, ...nodes(element.props.children as ReactNode)];
}
beforeEach(async () => { vi.stubGlobal("React", await import("react")); ({ CompanionBehaviorSettings } = await import("@/components/shared/companion-settings")); });
afterEach(() => vi.unstubAllGlobals());

describe("141 shared basic personality settings", () => {
  it("puts each real personality picture/copy between its label and nine choices", () => {
    for (const personality of COMPANION_PERSONALITIES) {
      const tree = CompanionBehaviorSettings({ preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, onChange: vi.fn(), globalSoundOn: false, active: true, radio: null });
      const row = nodes(tree).find(element => nodes(element).some(child => child.type === RowLabel && child.props.children === "지금 성격") && String(element.props.className).includes("rhh-companion-choice-row"))!;
      const children = row.props.children as Element[];
      expect(children[0].type).toBe(RowLabel); expect(children[0].props.children).toBe("지금 성격");
      expect(children[1].props["data-personality-preview"]).toBe(personality);
      expect(nodes(children[1]).find(element => element.type === "p")?.props.children).toBe(COMPANION_PERSONALITY_SUMMARIES[personality]);
      expect(nodes(children[1]).find(element => element.props.interactive === false)?.props.enabled).toBe(true);
      expect(children[2].type).toBe(SettingsSegment); expect(children[2].props.columns).toBe(3);
      expect(children[2].props.options).toHaveLength(9);
    }
  });
  it("uses the same three columns for animal and personality choices and preserves single change/reselect callbacks", () => {
    const change = vi.fn(), tree = CompanionBehaviorSettings({ preferences: DEFAULT_COMPANION_PREFERENCES, onChange: change, globalSoundOn: false, active: false, radio: null });
    const animal = nodes(tree).find(element => element.type === SettingsSegment && element.props.dataAct === "companion-animal")!;
    const personality = nodes(tree).find(element => element.type === SettingsSegment && element.props.dataAct === "companion-personality")!;
    expect(animal.props.columns).toBe(3); expect(personality.props.columns).toBe(3); expect(animal.props.options).toHaveLength(3);
    (animal.props.onChange as (value: string) => void)("dog"); (personality.props.onChange as (value: string) => void)("tidy"); (personality.props.onReselect as (value: string) => void)(DEFAULT_COMPANION_PREFERENCES.personality);
    expect(change.mock.calls).toEqual([[{ animalMode: "dog" }], [{ personality: "tidy" }], [{ personality: DEFAULT_COMPANION_PREFERENCES.personality }]]);
    expect(nodes(tree).find(element => element.props.interactive === false)?.props.enabled).toBe(false);
  });
});
