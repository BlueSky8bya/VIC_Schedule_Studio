import { describe, expect, it, vi } from "vitest";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, getCompanionToyArt } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_TASTES_KEY, companionToyUnread, createCompanionTastesStore, normalizeCompanionTastes, shouldDeclineCompanionFood, shouldDeclineCompanionToy, summarizeCompanionFoodTastes, summarizeCompanionToyTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { sanitizeMeta, sanitizeTarget } from "@/lib/activity/kinds";
import { ACT, describeTarget } from "@/lib/activity/labels";
import { buildStory, type NarrativeItem } from "@/lib/activity/narrative";

function disk() { let raw: string | null = null; return { getItem: vi.fn(() => raw), setItem: vi.fn((key: string, value: string) => { expect(key).toBe(COMPANION_TASTES_KEY); raw = value; }), replace(value: string | null) { raw = value; }, read: () => raw }; }
describe("122 witnessed toy discovery and local tastes", () => {
  it("shares twenty-four fixed identities and new art paths while preserving the first eight stored identities", () => {
    expect(COMPANION_TOY_KINDS.slice(0, 8)).toEqual(["ball", "blocks", "paper-plane", "spool", "hoop", "pinwheel", "bell", "feather"]);
    expect(COMPANION_TOY_KINDS).toHaveLength(24); expect(new Set(Object.values(COMPANION_TOY_NAMES)).size).toBe(24);
    for (const kind of COMPANION_TOY_KINDS) expect(getCompanionToyArt(kind)).toBe(`/companion/home/125/toy-${kind}.webp`);
  });
  it("does not invent discovery from loading, proposed actions, unsupported events or unknown IDs", () => {
    const storage = disk(), store = createCompanionTastesStore(storage);
    expect(store.load().toys).toEqual([]); expect(companionToyUnread(store.load())).toBe(0);
    expect(store.recordToy("private-canary" as "ball", "played")).toBe(false);
    expect(store.recordToy("ball", "spawn-request" as "played")).toBe(false);
    expect(store.acknowledge("ball")).toBe(false); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("discovers successful manual take-out and actual tidying without fabricating a preference", () => {
    const storage = disk(), store = createCompanionTastesStore(storage);
    expect(store.recordToy("ball", "taken-out")).toBe(true); expect(store.recordToy("blocks", "tidied")).toBe(true);
    expect(store.load().toys).toEqual(["ball", "blocks"]); expect(store.load().toyTastes).toEqual({});
    expect(summarizeCompanionToyTastes(store.load())).toEqual({ favorite: null, disliked: null });
    expect(companionToyUnread(store.load())).toBe(2); expect(store.recordToy("ball", "taken-out")).toBe(false);
    expect(createCompanionTastesStore(storage).load()).toEqual(store.load());
  });
  it("requires repeated completed reactions, and earned likes/dislikes can change through later real play", () => {
    const store = createCompanionTastesStore();
    store.recordToy("feather", "played"); expect(summarizeCompanionToyTastes(store.load()).favorite).toBeNull();
    store.recordToy("feather", "played"); expect(summarizeCompanionToyTastes(store.load()).favorite).toBe("feather");
    for (let i = 0; i < 6; i++) store.recordToy("feather", "declined");
    expect(summarizeCompanionToyTastes(store.load())).toEqual({ favorite: null, disliked: "feather" });
    for (let i = 0; i < 8; i++) store.recordToy("feather", "played");
    expect(summarizeCompanionToyTastes(store.load())).toEqual({ favorite: "feather", disliked: null });
  });
  it("acknowledges only an intentionally inspected discovered toy, preserving other unread items", () => {
    const store = createCompanionTastesStore(); store.recordToy("ball", "taken-out"); store.recordToy("bell", "played");
    const before = store.load(); expect(store.acknowledge("feather")).toBe(false); expect(store.load()).toEqual(before);
    expect(store.acknowledge("bell")).toBe(true); expect(store.acknowledge("bell")).toBe(false);
    expect(companionToyUnread(store.load())).toBe(1); expect(store.load().seen).toEqual(["bell"]);
  });
  it("proposes a refusal only after three actual plays with present tired/disinterested needs, never as learning itself", () => {
    const store = createCompanionTastesStore(), needs = { energy: .3, curiosity: .2 }, p = DEFAULT_COMPANION_PREFERENCES;
    for (let i = 0; i < 2; i++) store.recordToy("ball", "played");
    expect(shouldDeclineCompanionToy("ball", store.load(), p, needs)).toBe(false); store.recordToy("ball", "played");
    const before = store.load(); expect(shouldDeclineCompanionToy("ball", before, p, needs)).toBe(true); expect(store.load()).toEqual(before);
    expect(shouldDeclineCompanionToy("ball", before, { ...p, personality: "tidy" }, needs)).toBe(false);
    expect(shouldDeclineCompanionToy("ball", before, { ...p, learnFromYou: false }, needs)).toBe(false);
    for (const values of [{ energy: .9, curiosity: .2 }, { energy: .3, curiosity: .9 }, { energy: NaN, curiosity: .2 }]) expect(shouldDeclineCompanionToy("ball", before, p, values)).toBe(false);
    expect(shouldDeclineCompanionToy("bell", before, p, needs)).toBe(false);
  });
  it("keeps discovery while learning is OFF without rewriting earned scores or creating a new taste", () => {
    const store = createCompanionTastesStore(); store.recordToy("ball", "played"); const before = store.load().toyTastes;
    store.recordToy("ball", "declined", false); store.recordToy("bell", "played", false);
    expect(store.load().toyTastes).toEqual(before); expect(store.load().toys).toEqual(["ball", "bell"]);
    expect(store.recordFood("apple", "accepted", false)).toBe(false); expect(store.load().foodTastes).toEqual({});
  });
  it("requires known repeatedly accepted nonfavorite food, familiarity and low interest before proposing a real refusal", () => {
    const store = createCompanionTastesStore(), life = createCompanionLife(() => 0), p = DEFAULT_COMPANION_PREFERENCES;
    const brain = { life, hunger: .4, curiosity: .2 }; life.familiarity.peach = .8;
    for (let i = 0; i < 2; i++) store.recordFood("peach", "accepted");
    expect(shouldDeclineCompanionFood("peach", store.load(), p, brain, ["peach"])).toBe(false); store.recordFood("peach", "accepted");
    const before = store.load(); expect(shouldDeclineCompanionFood("peach", before, p, brain, ["peach"])).toBe(true); expect(store.load()).toEqual(before);
    expect(shouldDeclineCompanionFood("peach", before, p, brain, [])).toBe(false);
    expect(shouldDeclineCompanionFood("peach", before, { ...p, learnFromYou: false }, brain, ["peach"])).toBe(false);
    for (const patch of [{ hunger: .9 }, { curiosity: .9 }, { life: { ...life, favoriteFood: "peach" as const } }, { life: { ...life, familiarity: { ...life.familiarity, peach: .1 } } }]) expect(shouldDeclineCompanionFood("peach", before, p, { ...brain, ...patch }, ["peach"])).toBe(false);
  });
  it("resets preferences alone while preserving real discoveries, acknowledgments and unrelated collection storage", () => {
    const storage = disk(), store = createCompanionTastesStore(storage); store.recordToy("ball", "played"); store.recordToy("bell", "tidied"); store.acknowledge("bell"); store.recordFood("apple", "declined");
    expect(store.resetPreferences()).toBe(true); expect(store.load()).toEqual({ version: 1, toys: ["ball", "bell"], seen: ["bell"], toyTastes: {}, foodTastes: {} });
    expect(createCompanionTastesStore(storage).load()).toEqual(store.load()); expect(store.resetPreferences()).toBe(false);
    expect(storage.setItem.mock.calls.every(([key]) => key === COMPANION_TASTES_KEY)).toBe(true);
  });
  it("whitelists bounded fields and does not retain schedule/account data or unobserved toy tastes", () => {
    const value = normalizeCompanionTastes({ version: 1, toys: ["ball", "ball", "private-canary"], seen: ["bell", "ball"], toyTastes: { ball: { accepted: 300, declined: -1, score: 50, title: "private-canary" }, bell: { accepted: 2, score: 1 } }, foodTastes: { apple: { accepted: 3, declined: NaN, score: -.4 }, secret: { accepted: 20, score: 1 } }, account: "private-canary", at: Date.now() });
    expect(value).toEqual({ version: 1, toys: ["ball"], seen: ["ball"], toyTastes: { ball: { accepted: 31, declined: 0, score: 1 } }, foodTastes: { apple: { accepted: 3, declined: 0, score: -.4 } } });
    const store = createCompanionTastesStore(); for (let i = 0; i < 200; i++) store.recordToy("ball", "played");
    expect(store.load().toyTastes.ball?.accepted).toBe(31); expect(store.load().toyTastes.ball?.score).toBeLessThanOrEqual(1);
    expect(JSON.stringify(store.load()).length).toBeLessThan(16384);
  });
  it("preserves newer cross-tab discoveries/acknowledgments and honors an external clear", () => {
    const storage = disk(), first = createCompanionTastesStore(storage), second = createCompanionTastesStore(storage);
    first.load(); second.load(); first.recordToy("ball", "played"); second.recordToy("bell", "taken-out");
    first.acknowledge("ball"); second.recordToy("bell", "played");
    expect(second.load().toys).toEqual(["ball", "bell"]); expect(first.load().seen).toEqual(["ball"]);
    storage.replace(null); expect(first.load().toys).toEqual([]); expect(second.load().toys).toEqual([]);
  });
  it("keeps witnessed volatile progress on quota failure and discards oversized/malformed saved data", () => {
    const storage = disk(); storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    const store = createCompanionTastesStore(storage); store.recordToy("spool", "played");
    expect(store.load().toys).toEqual(["spool"]); expect(store.load().toyTastes.spool?.accepted).toBe(1);
    storage.replace("x".repeat(16385)); expect(store.load().toys).toEqual([]);
    storage.replace("{"); expect(store.load().toys).toEqual([]);
  });
  it("keeps the authored initial favorite separate from discoveries and never turns novelty into dislike", () => {
    const life = createCompanionLife(() => 0), store = createCompanionTastesStore();
    expect(summarizeCompanionFoodTastes(store.load(), life, [])).toEqual({ favorite: life.favoriteFood, disliked: null });
    expect(store.load().toys).toEqual([]); expect(store.load().foodTastes).toEqual({});
    life.foodScores.peach = .95; life.favoriteFood = "peach"; store.recordFood("peach", "accepted");
    expect(summarizeCompanionFoodTastes(store.load(), life, ["apple", "peach"])).toEqual({ favorite: "peach", disliked: null });
    life.familiarity.apple = 1; expect(summarizeCompanionFoodTastes(store.load(), life, ["apple", "peach"]).disliked).toBeNull();
    store.recordFood("apple", "declined"); store.recordFood("apple", "declined");
    expect(summarizeCompanionFoodTastes(store.load(), life, ["apple", "peach"])).toEqual({ favorite: "peach", disliked: "apple" });
    for (let i = 0; i < 5; i++) store.recordFood("apple", "accepted");
    expect(summarizeCompanionFoodTastes(store.load(), life, ["apple", "peach"]).disliked).toBeNull();
  });
  it("labels only the fixed toy category in timelines/least-used controls and strips item identities/metadata", () => {
    for (const action of ["companion-collection-category", "companion-collection-inspect"]) {
      expect(ACT[action].opts?.toy).toBe("장난감 도감"); expect(describeTarget("ui.click", `${action}#toy`).name).toContain("장난감 도감");
      expect(sanitizeTarget(`${action}#toy`)).toBe(`${action}#toy`);
      expect(sanitizeTarget(`${action}#feather`)).toBe(action);
      expect(sanitizeMeta({ target: `${action}#toy`, toy: "feather", taste: -1 })).toBeNull();
    }
    const item: NarrativeItem = { t: Date.UTC(2026, 9, 19), kind: "ui.click", target: "companion-collection-inspect#toy", targetLabel: null, meta: null, durMs: null, source: "client" };
    expect(buildStory([item]).join(" ")).toContain("장난감 도감"); expect(buildStory([item]).join(" ")).not.toContain("feather");
  });
});
