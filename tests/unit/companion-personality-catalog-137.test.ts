import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANION_PERSONALITY_SCENES, type SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_NAMES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_HOME_TV_CHANNELS } from "@/lib/ui/viewer-companion/home-room-media";

const report = readFileSync("docs/agent/reports/REPORT-20261019-136-personality-scenes.html", "utf8");
const plain = (text: string) => text.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
const recipe = (id: string) => COMPANION_PERSONALITY_SCENES.find(scene => scene.id === id)!;
const effects = (id: string) => recipe(id).steps.filter(step => ["toy", "food", "tv", "light", "curtain", "wash", "sleep", "hide"].includes(step.kind));

describe("137 complete report recipe catalog", () => {
  it("covers the exact108 original scene IDs and labels in source order, plus36 combinations", () => {
    const source = Array.from(report.matchAll(/<article class="([^"]*)" id="([PCASTMGHB]\d{2})">([\s\S]*?)<\/article>/g), match => {
      const major = match[1].includes("major"), name = match[3].match(major ? /<h3>([\s\S]*?)<\/h3>/ : /<strong>([\s\S]*?)<\/strong>/)![1];
      return { id: match[2], label: plain(name).replace(major ? /^$/ : /^[PCASTMGHB]\d{2}/, "").trim(), major };
    });
    expect(source).toHaveLength(108);
    const regular = COMPANION_PERSONALITY_SCENES.filter(scene => !scene.id.startsWith("X-") && !/^D(?:143|157)-/.test(scene.id));
    //143 changes A06 from a sofa invitation to an actual outside greeting.
    const currentSource=source.map(row=>row.id==="A06"?{...row,label:"문밖에서 조용히 몸 내밀기"}:row);
    expect(regular.map(({ id, label, major }) => ({ id, label, major }))).toEqual(currentSource);
    expect(COMPANION_PERSONALITY_SCENES).toHaveLength(162);
    expect(new Set(COMPANION_PERSONALITY_SCENES.map(scene => scene.id)).size).toBe(162);
    expect(COMPANION_PERSONALITY_SCENES.filter(scene => scene.id.startsWith("X-"))).toHaveLength(36);
    expect(COMPANION_PERSONALITY_SCENES.filter(scene=>scene.id.startsWith("D143-"))).toHaveLength(9);
    expect(COMPANION_PERSONALITY_SCENES.filter(scene=>scene.id.startsWith("D157-"))).toHaveLength(9);
  });

  it("gives all nine named personalities five major, seven minor and four cross-feature paths plus nine143 additions", () => {
    expect(COMPANION_PERSONALITIES).toHaveLength(9);
    expect(COMPANION_PERSONALITY_NAMES.curious).toBe("탐험둥이");
    expect(COMPANION_PERSONALITY_NAMES.balanced).toBe("동글이");
    for (const personality of COMPANION_PERSONALITIES) {
      const scenes = COMPANION_PERSONALITY_SCENES.filter(scene => scene.personality === personality);
      expect(scenes.filter(scene => scene.major), personality).toHaveLength(5);
      expect(scenes.filter(scene => !scene.major && !scene.id.startsWith("X-") && !/^D(?:143|157)-/.test(scene.id)), personality).toHaveLength(7);
      expect(scenes.filter(scene => scene.id.startsWith("X-")), personality).toHaveLength(4);
      expect(scenes.filter(scene=>scene.id.startsWith("D143-"))).toHaveLength(1);
      expect(scenes.filter(scene=>scene.id.startsWith("D157-"))).toHaveLength(1);
      expect(scenes.every(scene => scene.label.length > 0)).toBe(true);
    }
  });

  it("keeps every request finite and every toy/channel identity inside the actual catalog", () => {
    for (const scene of COMPANION_PERSONALITY_SCENES) {
      expect(scene.triggers.length, scene.id).toBeGreaterThan(0);
      expect(new Set(scene.triggers).size, scene.id).toBe(scene.triggers.length);
      expect(scene.steps.length, scene.id).toBeGreaterThan(1);
      expect(scene.steps.some(step => !step.optional), scene.id).toBe(true);
      for (const step of scene.steps) {
        if ("ms" in step && step.ms !== undefined) {
          expect(Number.isFinite(step.ms), scene.id).toBe(true);
          expect(step.ms, scene.id).toBeGreaterThan(0);
          expect(step.ms, scene.id).toBeLessThan(10_000);
        }
        if (step.kind === "toy") {
          expect(step.limit, scene.id).toBeGreaterThan(0);
          expect(step.limit, scene.id).toBeLessThanOrEqual(2);
          for (const kind of step.kinds ?? []) expect(COMPANION_TOY_KINDS, scene.id).toContain(kind);
        }
        if (step.kind === "tv") expect(["off", "next", ...COMPANION_HOME_TV_CHANNELS], scene.id).toContain(step.state);
      }
    }
  });

  it("requires actual play/return/eat/tidy effects instead of replacing representative work with poses", () => {
    const toyEffects = (id: string) => effects(id).filter((step): step is Extract<SceneBeat, { kind: "toy" }> => step.kind === "toy");
    expect(toyEffects("P02").map(step => step.mode)).toEqual(["inspect", "play", "return"]);
    expect(toyEffects("P02").every(step => step.kinds?.includes("maraca"))).toBe(true);
    expect(toyEffects("C03").map(step => step.mode)).toEqual(["inspect", "toss", "inspect", "return"]);
    expect(toyEffects("C03").every(step => step.kinds?.includes("paper-plane"))).toBe(true);
    expect(toyEffects("M01").map(step => step.mode)).toEqual(["toss", "toss", "return"]);
    expect(toyEffects("T01")).toContainEqual(expect.objectContaining({ mode: "return", limit: 1 }));
    for (const id of ["T02", "T03", "G02", "H08"]) expect(effects(id)).toContainEqual({ kind: "food", mode: "tidy" });
    for (const id of ["C02", "S02", "G01", "G03", "G04", "B03"]) expect(effects(id)).toContainEqual({ kind: "food", mode: "eat" });
    expect(toyEffects("B04")).toContainEqual(expect.objectContaining({ mode: "return", limit: 2 }));
  });

  it("retains real event predicates and never freely fabricates applause, petting or a meal", () => {
    for (const [id, trigger] of [["P04", "work"], ["P05", "pet"], ["A02", "pet"], ["S08", "pet"], ["M12", "undo"], ["G08", "favorite"], ["P10", "outfit"], ["T05", "toy-returned"], ["G05", "meal"]] as const) {
      expect(recipe(id).triggers).toContain(trigger);
      expect(recipe(id).triggers).not.toContain("free");
    }
    expect(recipe("A04").triggers).toEqual(["arrival", "night"]);
    expect(recipe("M03").triggers).toEqual(["toy", "toy-settled"]);
    expect(recipe("T10").triggers).toEqual(["toy", "recovered"]);
    expect(recipe("P11").triggers).toEqual(["free"]);
    expect(effects("P11")).toHaveLength(0);
  });

  it("connects house stages while preserving manual darkness and honest source fallbacks", () => {
    expect(effects("H03")).toEqual(expect.arrayContaining([
      { kind: "curtain", phase: "closed" }, { kind: "light", lit: false }, { kind: "tv", state: "tori" },
    ]));
    expect(effects("S04")).toEqual(expect.arrayContaining([{ kind: "tv", state: "moon" }, { kind: "tv", state: "off" }, { kind: "light", lit: false }]));
    expect(recipe("P12").steps.some(step => step.kind === "light" && step.lit)).toBe(false);
    expect(recipe("T05").steps[0]).toEqual({ kind: "go", target: "pad" });
    expect(recipe("T05").steps[1]).toEqual({ kind: "wash", ms: 2000 });
    for (const id of ["C10", "M11"]) expect(effects(id)).toContainEqual(expect.objectContaining({ kind: "hide" }));
    expect(effects("S11")).toHaveLength(0);
    expect(effects("H12")).toHaveLength(0);
    expect(recipe("H12").steps).toContainEqual({ kind: "pose", pose: "cozy-nest" });
  });

  it("marks only genuine optional branches and keeps spawned counts bounded", () => {
    expect(recipe("G05").steps.filter(step => step.kind === "toy")).toEqual([
      { kind: "toy", mode: "inspect", kinds: ["squeaky-carrot"], limit: 1, optional: true },
      { kind: "toy", mode: "return", kinds: ["squeaky-carrot"], limit: 1, optional: true },
    ]);
    expect(recipe("T04").steps.find(step => step.kind === "toy")?.optional).toBe(true);
    for (const id of ["M07", "H01"]) expect(effects(id)).toContainEqual({ kind: "toy", mode: "spawn", limit: 1 });
    expect(effects("G12").some(step => step.kind === "food" && ["spawn", "eat"].includes(step.mode))).toBe(false);
    expect(COMPANION_PERSONALITY_SCENES.flatMap(scene => scene.steps).filter(step => step.kind === "food" && step.mode === "spawn")).toHaveLength(0);
  });

  it("authors two-sided inspection, physical car nudging, two real food checks and reopening the view before scenery watching", () => {
    expect(recipe("C01").steps).toContainEqual({ kind: "go", target: "toy-other-side", optional: true });
    expect(recipe("M02").steps.filter(step => step.kind === "toy").map(step => step.mode)).toEqual(["nudge", "return"]);
    expect(recipe("G04").steps.filter(step => step.kind === "food").map(step => step.mode)).toEqual(["compare", "inspect", "eat"]);
    for (const id of ["C12", "H05", "B04", "B11", "X-C-return-time", "X-B-return-time"]) {
      const steps = recipe(id).steps, open = steps.findIndex(step => step.kind === "curtain" && step.phase === "open"), watch = steps.findIndex(step => step.kind === "watch");
      expect(open, id).toBeGreaterThanOrEqual(0); expect(open, id).toBeLessThan(watch);
    }
  });
});
