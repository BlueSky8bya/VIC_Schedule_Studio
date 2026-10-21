import { describe, expect, it, vi } from "vitest";
import { COMPANION_BEHAVIOR_IDS, COMPANION_LEGACY_BEHAVIOR_IDS, createCompanionCollectionStore, getCompanionUnreadCounts, normalizeCompanionCollection, type CompanionBehaviorObservation } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_NEW_MEMORIES, companionPoseMemory, companionNewMemory } from "@/lib/ui/viewer-companion/memory-catalog";
import { COMPANION_MEMORY_BOOK } from "@/lib/ui/viewer-companion/memory-book-order";
import { COMPANION_EXPRESSIONS } from "@/lib/ui/viewer-companion/expressions";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionMemoryPainted, createCompanionPoseWitness } from "@/lib/ui/viewer-companion/memory-witness";
import { companionNativeBehaviorStamp } from "@/lib/ui/viewer-companion/native-behavior-stamp";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { chooseCompanionPreviewBehavior, companionPreviewDuration } from "@/lib/ui/viewer-companion/wardrobe-preview";

const observed = (row = 0): CompanionBehaviorObservation => {
  const physical = companionSpriteMetadata.rows[row][0], selected = selectCompanionSprite(physical, row, 0);
  return { requestedRow: row, requestedIndex: selected.physicalIndex, adoptedIndex: selected.physicalIndex, requestedSrc: selected.src, adoptedSrc: selected.src, decoded: true, visible: true };
};
describe("append-only notebook memories", () => {
  it("keeps old25 positions, all36 exact expression IDs and the24 recent full activities", () => {
    expect(COMPANION_MEMORY_BOOK.slice(0, 25).map(item => item.id)).toEqual([...COMPANION_LEGACY_BEHAVIOR_IDS, ...COMPANION_SITUATION_IDS]);
    expect(COMPANION_NEW_MEMORIES.filter(item => item.family === "expression").map(item => item.id)).toEqual(COMPANION_EXPRESSIONS.map(([id]) => `expression:${id}`));
    expect(COMPANION_NEW_MEMORIES.filter(item => item.family === "activity").map(item => item.id)).toEqual([
      ...COMPANION_PERSONALITY_SCENES.filter(scene => /^D(?:143|157)-/.test(scene.id)).map(scene => `activity:${scene.id}`),
      ...["meal", "wash", "sleep", "nap", "outing", "music"].map(id => `activity:routine-${id}`),
    ]);
    expect(COMPANION_MEMORY_BOOK).toHaveLength(106); expect(new Set(COMPANION_MEMORY_BOOK.map(item => item.id)).size).toBe(106);
    for (const item of COMPANION_MEMORY_BOOK) { expect(item.name).toBeTruthy(); expect(item.hint).toBeTruthy(); }
  });
  it("accounts for each sprite row as a semantic pose, an existing gesture, a collision or an unused legacy key", () => {
    const existing = new Set([16, 21, 22, 29, 30, 31, 33, 34, 35, 36, 39, 40]);
    const transitionalOrUnused = new Set([7, 24, 25, 37, 38]);
    for (let row = 0; row < companionSpriteMetadata.rows.length; row++) expect(Boolean(companionPoseMemory(row)) || existing.has(row) || transitionalOrUnused.has(row), `unregistered row ${row}`).toBe(true);
    expect([3, 4, 5, 6].map(companionPoseMemory)).toEqual(Array(4).fill("pose:jump"));
    expect(companionNewMemory("pose:thrown")?.name).toBe("날아가는 빅타민");
  });
  it("retains old owned/read records and leaves every new entry locked", () => {
    const old = normalizeCompanionCollection({ version: 1, behaviors: [...COMPANION_LEGACY_BEHAVIOR_IDS, "private-canary"], situations: COMPANION_SITUATION_IDS });
    expect(old.behaviors).toEqual(COMPANION_LEGACY_BEHAVIOR_IDS); expect(old.situations).toEqual(COMPANION_SITUATION_IDS);
    expect(getCompanionUnreadCounts(old).memories).toBe(0);
    let raw = JSON.stringify(old);
    const store = createCompanionCollectionStore({ getItem: () => raw, setItem: (_, value) => { raw = value; } }); store.load();
    expect(store.recordExpression(observed(), { id: "sour", progress: .55, painted: true })).toBe(true);
    expect(store.load().seen?.behaviors).toEqual(COMPANION_LEGACY_BEHAVIOR_IDS); expect(getCompanionUnreadCounts(store.load()).memories).toBe(1);
    expect(store.acknowledge("behavior", "expression:sour")).toBe(true); expect(getCompanionUnreadCounts(store.load()).memories).toBe(0);
  });
  it.each(["hidden", "undecoded", "retained-index", "retained-source", "wrong-row", "wrong-source", "no-paint", "neutral", "expired"])("never records an expression from %s", state => {
    const store = createCompanionCollectionStore(), observation = observed(), face = { id: "sour" as const, progress: .55, painted: true };
    if (state === "hidden") observation.visible = false;
    if (state === "undecoded") observation.decoded = false;
    if (state === "retained-index") observation.adoptedIndex = 100;
    if (state === "retained-source") observation.adoptedSrc = "/retained.webp";
    if (state === "wrong-row") observation.requestedRow = 40;
    if (state === "wrong-source") observation.requestedSrc = observation.adoptedSrc = "/not-native.webp";
    if (state === "no-paint") face.painted = false;
    if (state === "neutral") face.progress = 0;
    if (state === "expired") face.progress = 1;
    expect(store.recordExpression(observation, face)).toBe(false); expect(store.load().behaviors).toEqual([]);
  });
  it("requires80ms of actual consecutive pose exposure and resets on hidden/fallback/clock gaps", () => {
    const witness = createCompanionPoseWitness(), observation = observed(4);
    expect(companionMemoryPainted(observation)).toBe(true);
    expect(witness(observation, 0)).toBeUndefined(); expect(witness(observation, 40)).toBeUndefined(); expect(witness(observation, 80)).toBe("pose:jump");
    expect(witness({ ...observation, visible: false }, 90)).toBeUndefined(); expect(witness(observation, 100)).toBeUndefined();
    expect(witness(observation, 1000)).toBeUndefined(); expect(witness(observation, 1040)).toBeUndefined(); expect(witness(observation, 1080)).toBe("pose:jump");
    witness.reset(); expect(witness(observation, 1096)).toBeUndefined(); expect(witness(observation, 1160)).toBeUndefined();
    // A suspended renderer makes no observe calls. Its explicit lifecycle
    // reset must still break64ms of evidence even if the active clock stops.
    witness.reset(); expect(witness(observation, 1176)).toBeUndefined(); expect(witness(observation, 1240)).toBeUndefined(); expect(witness(observation, 1256)).toBe("pose:jump");
  });
  it("rejects cancelled, abbreviated, unknown or individual-beat activity claims", () => {
    const store = createCompanionCollectionStore();
    for (const receipt of [{ id: "D157-C", success: false, abbreviated: false }, { id: "D157-C", success: true, abbreviated: true }, { id: "unknown", success: true, abbreviated: false }]) expect(store.recordActivity(receipt)).toBe(false);
    expect(store.recordActivity({ id: "D157-C", success: true, abbreviated: false })).toBe(true);
    expect(store.recordActivity({ id: "D157-C", success: true, abbreviated: false })).toBe(false);
    expect(store.load().behaviors).toEqual(["activity:D157-C"]);
  });
  it("does no storage IO for repeated frames after a real discovery and merges another tab's state", () => {
    let raw: string | null = null;
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn((_: string, value: string) => { raw = value; }) }, store = createCompanionCollectionStore(storage);
    const face = { id: "tv" as const, progress: .55, painted: true };
    expect(store.recordExpression(observed(), face)).toBe(true); storage.getItem.mockClear(); storage.setItem.mockClear();
    for (let frame = 0; frame < 200; frame++) expect(store.recordExpression(observed(), face)).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
    raw = JSON.stringify({ ...JSON.parse(raw!), behaviors: ["expression:tv", "pose:walk"] });
    expect(store.recordActivity({ id: "routine-wash", success: true, abbreviated: false })).toBe(true);
    expect(store.load().behaviors).toEqual(["expression:tv", "pose:walk", "activity:routine-wash"]);
  });
  it("uses exact existing native cells and leaves face/sequence memories out of wardrobe gesture playback", () => {
    for (const memory of COMPANION_NEW_MEMORIES) {
      if (memory.family === "expression") continue;
      const stamp = companionNativeBehaviorStamp(memory.id)!;
      expect(stamp).toBeTruthy(); expect(stamp.width).toBe(companionSpriteMetadata.cell); expect(stamp.width).toBe(stamp.height);
      expect(companionSpriteMetadata.atlases.some(atlas => atlas.src === stamp.src)).toBe(true);
    }
    expect(chooseCompanionPreviewBehavior(COMPANION_BEHAVIOR_IDS.filter(id => !COMPANION_LEGACY_BEHAVIOR_IDS.includes(id as typeof COMPANION_LEGACY_BEHAVIOR_IDS[number])))).toBeNull();
    expect(companionPreviewDuration("expression:tv")).toBe(0);
  });
});
