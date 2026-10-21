import type {CompanionAction} from "./brain";
import type {PersonalitySceneBeat} from "./personality-director";

/** Read the active physical inspection only; never create an eating/ACK ID. */
export function companionExpressionFoodId(
  action: (Pick<CompanionAction,"kind"|"foodId"> & {personalityScene?: PersonalitySceneBeat}) | null | undefined,
  status: string,
  current: {itemId?: string} | undefined,
  owns: (meta: PersonalitySceneBeat) => boolean,
): string | undefined {
  if (action?.foodId) return action.foodId;
  const meta = action?.personalityScene;
  return status === "sniff" && action?.kind === "sniff" && meta && !meta.travel
    && meta.command.kind === "food" && meta.command.mode === "inspect" && owns(meta)
    ? current?.itemId : undefined;
}
