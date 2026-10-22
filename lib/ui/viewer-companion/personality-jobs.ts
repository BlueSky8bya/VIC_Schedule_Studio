import { getFoodAction, type CompanionAction, type CompanionBrain, type CompanionWorld } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { createCompanionHousehold, type CompanionHouseholdBeat, type CompanionHouseholdHome } from "./household";
import { createCompanionToyPlanner, findCompanionToyRoute, type CompanionToy, type CompanionToyAction } from "./toys";
import { createCompanionPersonalityDirector, type PersonalitySceneBeat, type PersonalitySceneProposal } from "./personality-director";
import type { CompanionTastes } from "./toy-tastes";
import type { CompanionItemPoint } from "./item-landing";
import { companionPlayDuration } from "./timing";

export type PersonalityJobAction = CompanionAction & { personalityScene: PersonalitySceneBeat; personalitySignature: CompanionPreferences["personality"]; toy?: CompanionToyAction["toy"]; household?: CompanionHouseholdBeat; personalityJobEnd?: true };
type Input = {
  world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences; now: number;
  home: CompanionHouseholdHome; box?: { x: number; y: number; platformId?: string };
  toys: readonly CompanionToy[]; toyIds?: readonly string[]; carriedToy?: string; carriedFood?: string;
  toyCount: number; foodCount: number; occupied?: readonly CompanionItemPoint[]; tastes?: CompanionTastes;
};

/** Basic care may replace a nonmeal scene, but never a carried object, an
 * existing job, the entry greeting or the personality's own meal sequence. */
export function getCompanionPersonalityMeal(director: ReturnType<typeof createCompanionPersonalityDirector>, proposal: PersonalitySceneProposal | undefined,
  input: Pick<Input, "world" | "brain" | "preferences" | "now" | "carriedToy" | "carriedFood"> & { ownedJob?: boolean; authoredReserved?: boolean }, actionNow: number): CompanionAction | undefined {
  if (!input.world.animated || !input.preferences.roam || input.ownedJob || input.carriedToy || input.carriedFood || proposal?.meta.id.startsWith("entry-") || director.plansMeal()
    || input.authoredReserved && input.brain.hunger < .78) return;
  return getFoodAction(input.brain, input.world, input.preferences, actionNow);
}

/** Connect an authored request to the existing real object planners. It never
 * mutates objects or supplies a successful effect; the renderer owns ACKs. */
export function createCompanionPersonalityJobs(director: ReturnType<typeof createCompanionPersonalityDirector>, household: ReturnType<typeof createCompanionHousehold>, toys: ReturnType<typeof createCompanionToyPlanner>) {
  let key = "", misses = 0;
  const carryingShow = new Set(["P02", "P08", "A03", "C07", "C08", "S07", "H07"]);
  return {
    // Scene, retry and object planners use visible-active time. Eat cooldowns
    // come from commitAction on the renderer clock, which can advance while
    // active time is paused. Keep those two contracts explicit at this bridge.
    next(proposal: PersonalitySceneProposal, input: Input, actionNow: number): PersonalityJobAction | undefined {
      const command = proposal.delegate;
      if (!command) return proposal.action;
      const currentKey = `${proposal.meta.serial}:${proposal.meta.beat}`;
      if (currentKey !== key) {
        key = currentKey; misses = 0; household.cancel(); toys.cancel(input.now);
        household.wake(input.now); toys.wake(input.now, true);
        if (command.kind === "toy" && command.mode === "return" && input.carriedToy) toys.returnCarried(input.carriedToy, input.now);
      }
      const { world, brain, preferences: p, now } = input, here = { x: world.x, y: world.y, platformId: world.platformId };
      const stamp = (action: CompanionAction & { toy?: CompanionToyAction["toy"]; household?: CompanionHouseholdBeat; personalityJobEnd?: true }, travel = false): PersonalityJobAction => ({
        ...action, personalityScene: { ...proposal.meta, ...(travel ? { travel: true } : {}) }, personalitySignature: p.personality,
      });
      let selected: CompanionAction & { toy?: CompanionToyAction["toy"]; household?: CompanionHouseholdBeat } | undefined;
      if (command.kind === "toy") {
        const show=proposal.meta.propShow===true || carryingShow.has(proposal.meta.id);
        if(proposal.meta.propShow && command.mode==="play" && (!proposal.meta.itemId || input.carriedToy!==proposal.meta.itemId)) {
          director.resolve(proposal.meta,false); return;
        }
        if (command.mode === "inspect" && show) {
          if (input.carriedToy && (!proposal.meta.itemId || input.carriedToy === proposal.meta.itemId)) {
            return stamp({ kind: "sniff", target: here, duration: 800, personalityJobEnd: true });
          }
          selected = toys.next({ world, brain, preferences: { ...p, personality: "curious" }, now, toys: input.toys,
            existingIds: input.toyIds, carriedId: input.carriedToy, count: input.toyCount, box: input.box, tastes: input.tastes,
            intent: { mode: "play", targetId: proposal.meta.itemId, kinds: command.kinds, homeFloorEntry: proposal.meta.homeFloorEntry === true } });
          if (selected?.toy?.toyId) director.bind(proposal.meta, selected.toy.toyId);
        } else if (command.mode === "inspect" || command.mode === "nudge") {
          const target = proposal.meta.itemId ? input.toys.find(toy => toy.id === proposal.meta.itemId) : input.toys.find(toy => !command.kinds?.length || command.kinds.includes(toy.kind));
          if (target && !target.held && !target.hidden && !target.carried) {
            director.bind(proposal.meta, target.id);
            const route = findCompanionToyRoute(world, target.stance ?? target, world.platforms, p.jump, proposal.meta.homeFloorEntry === true), step = route?.[0];
            if (step) return stamp({ ...step, duration: step.kind === "jump" ? 850 : Math.max(250, Math.abs(step.target.x - world.x) / 100 * 1000) }, true);
            if (route && Math.hypot(target.x - world.x, target.y - world.y) < 48) {
              if (command.mode === "nudge") return stamp({ kind: "sniff", target: here, duration: 700,
                toy: { serial: proposal.meta.serial, kind: "play", effect: "nudge", toyId: target.id, point: here } });
              return stamp({ kind: "sniff", target: here, duration: 900, personalityJobEnd: true });
            }
          }
        } else if (command.mode === "play" && show && input.carriedToy) {
          return stamp({ kind: "play", play: "celebrate", target: here, duration: companionPlayDuration("celebrate"), personalityJobEnd: true });
        } else {
          const chosenPreferences = { ...p, personality: command.mode === "return" ? "tidy" as const : command.mode === "toss" ? "mischievous" as const : "curious" as const };
          const jobInput = { world, brain, preferences: chosenPreferences, now, toys: input.toys, existingIds: input.toyIds, carriedId: input.carriedToy, count: input.toyCount, box: input.box, tastes: input.tastes,
            intent: { mode: command.mode === "return" ? "return" as const : command.mode === "spawn" ? "spawn" as const : "play" as const, targetId: proposal.meta.itemId, kinds: command.kinds, homeFloorEntry: proposal.meta.homeFloorEntry === true } };
          selected = toys.playfulCarry(here) ?? toys.next(jobInput);
          if (selected?.toy?.toyId) director.bind(proposal.meta, selected.toy.toyId);
        }
      } else if (command.mode === "eat") {
        const foods = proposal.meta.itemId ? world.foods?.filter(food => food.id === proposal.meta.itemId) : world.foods;
        selected = getFoodAction(brain, { ...world, foods }, p, actionNow);
        if (selected?.foodId) director.bind(proposal.meta, selected.foodId);
      } else if (command.mode === "inspect" || command.mode === "compare") {
        // Comparison visits one different real food without rebinding the
        // selected meal. The following inspect/eat keeps the original ID.
        const mainId = proposal.meta.itemId ?? director.current()?.itemId;
        const food = command.mode === "compare" ? mainId && world.foods?.some(item => item.id === mainId) ? world.foods.find(item => item.id === proposal.meta.comparisonItemId) : undefined
          : mainId ? world.foods?.find(item => item.id === mainId) : world.foods?.[0];
        if (food && p.feeding) {
          if (command.mode !== "compare") director.bind(proposal.meta, food.id);
          // Comparison is one nearby look, not a second meal destination.
          // The committed original ID still owns the following inspect/eat.
          if (command.mode === "compare") {
            if (food.platformId !== world.platformId || Math.hypot(food.x-world.x,food.y-world.y) > 72) {
              director.resolve(proposal.meta,true); return;
            }
            return stamp({kind:"look",target:here,direction:food.x<world.x?-1:1,
              duration:650,personalityJobEnd:true});
          }
          const route = findCompanionToyRoute(world, food, world.platforms, p.jump), step = route?.[0];
          if (step) return stamp({ ...step, duration: step.kind === "jump" ? 850 : Math.max(250, Math.abs(step.target.x - world.x) / 100 * 1000) }, true);
          if (route && Math.hypot(food.x - world.x, food.y - world.y) < 50) return stamp({ kind: "sniff", target: here, duration: 750, personalityJobEnd: true });
        }
      } else {
        const preferences = { ...p, personality: command.mode === "tidy" ? "tidy" as const : p.personality };
        selected = household.next({ brain, world, preferences, now, home: input.home, count: input.foodCount, carried: input.carriedFood, occupied: input.occupied,
          intent: command.mode === "tidy" ? "tidy" : "feed", foodId: proposal.meta.itemId });
        if (selected?.household?.foodId) director.bind(proposal.meta, selected.household.foodId);
      }
      if (selected) { misses = 0; return stamp(selected); }
      if (++misses >= 4 || command.optional) { director.resolve(proposal.meta, false); return; }
      // A just-emitted object is genuinely in flight. Wait a finite fraction
      // of a second for its existing gravity owner instead of inventing it.
      return stamp({ kind: "look", target: here, duration: 250 }, true);
    },
  };
}
