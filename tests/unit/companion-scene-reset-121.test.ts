import { expect, it } from "vitest";
import { createCompanionScenes } from "@/lib/ui/viewer-companion/scenes";
import { newCompanionSceneMemory } from "@/lib/ui/viewer-companion/scene-memory";

it("the existing learning reset clears routine, outfit and pending scene memories together", () => {
  const memory = newCompanionSceneMemory();
  memory.hours[21] = 6; memory.hourDays[21] = 20000; memory.homeHours[21] = 3;
  memory.greetingCount = 5; memory.outfits.beret = 8; memory.first = "touch"; memory.reassurance = 4;
  memory.music.lively = 5; memory.unfinished = "hide";
  const scenes = createCompanionScenes(memory);
  scenes.event({ kind: "encounter", wallTime: Date.parse("2026-10-19T12:00:00Z") }, 0);
  scenes.event({ kind: "layout" }, 100);
  expect(scenes.pending().length).toBeGreaterThan(0);
  expect(scenes.preferredAccessory(["beret"])).toBe("beret");
  scenes.resetMemory();
  expect(scenes.checkpoint()).toEqual(newCompanionSceneMemory());
  expect(scenes.current()).toBeUndefined(); expect(scenes.pending()).toEqual([]);
  expect(scenes.preferredAccessory(["beret"])).toBeNull();
});
