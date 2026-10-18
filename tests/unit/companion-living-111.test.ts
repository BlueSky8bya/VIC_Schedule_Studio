import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { getCompanionCollectionArtFrame } from "@/lib/ui/viewer-companion/collection-art";
import { getCompanionFoodArtFrame } from "@/lib/ui/viewer-companion/food-art";
import { createBrain, commitAction, getFoodAction, recordCompanionEvent, reachablePlatforms, type CompanionWorld } from "@/lib/ui/viewer-companion/brain";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { DEFAULT_COMPANION_PREFERENCES as preferences } from "@/lib/ui/viewer-companion/preferences";
import { planCompanionEpisode } from "@/lib/ui/viewer-companion/episodes";
import { getCompanionInterest } from "@/lib/ui/viewer-companion/interest";
import { createCompanionInstrumentInbox, getCompanionInstrumentReaction, sampleCompanionInstrumentReaction } from "@/lib/ui/viewer-companion/instrument-reaction";
import { planCompanionGoal } from "@/lib/ui/viewer-companion/planner";

describe("111 existing-asset stories and exact runtime food metadata", () => {
  it("keeps all180 live food cells byte-for-byte coordinate equivalent to the collection", () => {
    for (const kind of COMPANION_FOOD_KINDS) {
      const cell = getCompanionCollectionArtFrame("food", kind)!;
      expect(getCompanionFoodArtFrame(kind), kind).toEqual({ src: cell.src, atlasWidth: cell.atlasWidth, atlasHeight: cell.atlasHeight, x: cell.x, y: cell.y, width: cell.width, height: cell.height });
    }
  });
  it("recognizes a nearby learned favorite once before the real meal and keeps that meal through petting", () => {
    let brain = { ...createBrain(0), energy: .9, hunger: .6, life: createCompanionLife(() => 0) };
    const support = { id: "ordinary", x: 50, y: 500, width: 900, kind: "card" as const };
    const world: CompanionWorld = { x: 300, y: 500, platformId: support.id, platforms: [support], foods: [{ id: "actual-food", kind: brain.life.favoriteFood, x: 320, y: 500, platformId: support.id }], width: 1000, height: 800, animated: true };
    const food = getFoodAction(brain, world, preferences, 100000)!;
    expect(food.kind).toBe("eat");
    const notice = planCompanionEpisode(brain, world, preferences, 100000, food, () => 0, reachablePlatforms)!;
    expect(notice.episode).toMatchObject({ reunion: true, phase: "notice", foodId: "actual-food" });
    brain = commitAction(brain, notice, 100000) as typeof brain;
    const petted = recordCompanionEvent(brain, "petted");
    expect(petted.episode).toEqual(brain.episode);
    const greeting = planCompanionEpisode(petted, world, preferences, 100300, food, () => 0, reachablePlatforms)!;
    expect(greeting).toMatchObject({ kind: "play", foodId: "actual-food", episode: { phase: "greet", reunion: true } });
    expect(planCompanionEpisode({ ...brain, episode: undefined }, world, { ...preferences, learnFromYou: false }, 100000, food, () => 0, reachablePlatforms)).toBeUndefined();
  });
  it("shows current needs without asking for a disabled interaction", () => {
    const care = { hunger: .9, energy: .9, affection: .5 };
    expect(getCompanionInterest(care, preferences)).toBe("food");
    expect(getCompanionInterest(care, { ...preferences, feeding: false })).not.toBe("food");
    expect(getCompanionInterest({ ...care, energy: .1 }, preferences)).toBe("rest");
    expect(getCompanionInterest(care, { ...preferences, enabled: false })).toBeNull();
  });
  it("returns to a still-present familiar resting ledge and forgets removed/failed candidates", () => {
    const current = { id: "current", x: 50, y: 600, width: 300, kind: "card" as const }, known = { id: "known", x: 50, y: 500, width: 300, kind: "card" as const };
    const brain = { ...createBrain(0), energy: .2, places: [{ id: known.id, visits: 4, failures: 0, retryAfter: 0 }] };
    const world: CompanionWorld = { x: 100, y: current.y, platformId: current.id, platforms: [current, known], width: 1000, height: 800 };
    const ports = { route: () => [{ kind: "jump" as const, target: { x: 150, y: 500, platformId: known.id } }], landingX: (_p: unknown, x: number) => x, reachable: () => [] };
    expect(planCompanionGoal(brain, world, preferences, ports).action?.intention).toMatchObject({ kind: "rest", targetId: known.id });
    expect(planCompanionGoal(brain, { ...world, platforms: [current] }, preferences, ports).action).toBeUndefined();
    // Ordinary pets now stay visibly active at35% energy; actual exhaustion
    // still chooses the learned ledge and never a removed support.
    expect(planCompanionGoal({ ...brain, energy: .35 }, world, preferences, ports).action?.intention?.kind).not.toBe("rest");
  });
});

describe("actual instrument onsets stay bounded and personality-specific", () => {
  it("grades the supplied score clock instead of accepting any regular click tempo", () => {
    const inbox = createCompanionInstrumentInbox();
    for (const [index, at] of [100, 600, 1100, 1600].entries()) inbox.offer({ mood: "lively", at, bpm: 120, durationMs: 200, expectedGapMs: 500, rhythm: { sequence: 1, segment: 0, index, onsetMs: index * 500, gapMs: 500, tapAt: at, audibleAt: at + 25 } }, at, true);
    expect(inbox.take(1600)?.quality).toBe("steady");
    inbox.clear();
    for (const [index, at] of [100, 250, 400, 550].entries()) inbox.offer({ mood: "lively", at, bpm: 120, durationMs: 200, expectedGapMs: 500, rhythm: { sequence: 2, segment: 0, index, onsetMs: index * 500, gapMs: 500, tapAt: at, audibleAt: at + 25 } }, at, true);
    expect(inbox.take(550)?.quality).toBe("uneven");
    inbox.offer({ mood: "calm", at: 2000, bpm: 80, durationMs: 200, expectedGapMs: 750 }, 2000, false);
    expect(inbox.take(2001)).toBeUndefined();
  });
  it("encourages with the dog, teases with the playful mascot, and lets sleepy pets ignore", () => {
    const input = { mood: "lively" as const, quality: "uneven" as const, energy: .9, life: createCompanionLife(() => 0), preferences };
    expect(getCompanionInstrumentReaction({ ...input, preferences: { ...preferences, animalMode: "dog" } })).toBe("encourage");
    expect(getCompanionInstrumentReaction(input)).toBe("tease");
    expect(getCompanionInstrumentReaction({ ...input, preferences: { ...preferences, personality: "sleepy" } })).toBe("ignore");
    expect(sampleCompanionInstrumentReaction("tease", 2500, 120).row).toBe(28);
    expect(sampleCompanionInstrumentReaction("encourage", 2500, 120).row).toBe(29);
    expect(sampleCompanionInstrumentReaction("tease", 5200, 120)).toMatchObject({ done: true, row: 0, bob: 0, tilt: 0 });
    const unlearned = { ...input, preferences: { ...preferences, learnFromYou: false }, life: { ...input.life, play: 0 } };
    expect(getCompanionInstrumentReaction(unlearned)).toBe("tease");
    expect(getCompanionInstrumentReaction({ ...unlearned, life: { ...input.life, play: 1 } })).toBe("tease");
  });
});
