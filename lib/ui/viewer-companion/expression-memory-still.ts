import type { CompanionExpressionId } from "./expressions";

/** Pick the readable part of each finite performance for its still portrait.
 * The live expression and its timing are independent of these poses. */
const stills: Readonly<Partial<Record<CompanionExpressionId, number>>> = {
  scent: .29,
  "first-bite": .66,
  hot: .61,
  icy: .36,
  awake: .7,
  giggle: .68,
  relief: .69,
  sorry: .69,
  oops: .28,
  cold: .47,
};
export const companionExpressionStill = (id: CompanionExpressionId) => stills[id] ?? .55;
