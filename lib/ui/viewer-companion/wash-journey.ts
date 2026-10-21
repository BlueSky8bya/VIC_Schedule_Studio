import type { CompanionPersonality } from "./preferences";
import type { SceneBeat } from "./personality-scene-catalog";

/** Human and needs-selected washing use the same measured mat and finite
 * exit. Neither a click nor a pose can acknowledge the actual wash. */
export function companionWashSteps(personality: CompanionPersonality): SceneBeat[] {
  return [
    { kind: "go", target: "pad" },
    { kind: "wash", ms: personality === "tidy" ? 3000 : personality === "mischievous" ? 1900 : 2400 },
    { kind: "go", target: "floor" },
    { kind: "pose", pose: personality === "mischievous" ? "shake" : personality === "sleepy" ? "stretch" : "bow" },
  ];
}
