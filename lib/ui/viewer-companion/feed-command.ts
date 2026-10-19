import { MAX_COMPANION_FOOD } from "./food-capacity";
import type { CompanionFoodKind } from "./snacks";

export type CompanionFeedCommand<Source> = Readonly<{ source: Source; kind: CompanionFoodKind; month: string; settings: object }>;
type Context<Source> = Readonly<{ source?: Source; month: string; settings: object; active: boolean }>;

/** A manual command can wait for one existing geometry completion. Keep input
 * order, consume before calling out, and never retry a failed completion again.
 * Source/settings tokens stay local; this owns no clock, observer or storage. */
export function createCompanionFeedCommands<Source>() {
  let commands: CompanionFeedCommand<Source>[] = [];
  return {
    pending: () => commands.length > 0,
    enqueue(command: CompanionFeedCommand<Source>) {
      if (commands.length >= MAX_COMPANION_FOOD) return false;
      commands.push(command); return true;
    },
    complete(current: Context<Source>, attempt: (command: CompanionFeedCommand<Source>) => void) {
      const completed = commands; commands = [];
      for (const command of completed) if (current.active && command.source === current.source && command.month === current.month && command.settings === current.settings) attempt(command);
    },
    cancel() { commands = []; },
  };
}
