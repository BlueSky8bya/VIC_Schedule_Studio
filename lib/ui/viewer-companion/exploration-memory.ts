import type { CompanionWorld, Platform } from "./brain";
import { companionOutsideItem, companionOutsideSupport } from "./life-space";
import type { CompanionToy } from "./toys";

export type CompanionToyObservation = { id: string; platformId: string; fraction: number; kind: CompanionToy["kind"] };

/** Active-session place habituation only. No clock, storage, object ownership,
 * learning reward or observation callback. Ordinary movement stays eligible
 * after every visible place is familiar; only another inspection needs novelty. */
export function createCompanionExplorationMemory() {
  const visited = new Set<string>();
  const inspectedToys = new Map<string, Omit<CompanionToyObservation, "id"> & { confirmed: boolean }>();
  const sameToy = (known: ReturnType<typeof inspectedToys.get>, observation: CompanionToyObservation, width: number) => Boolean(known
    && known.platformId === observation.platformId && known.kind === observation.kind && Math.abs(known.fraction-observation.fraction)*width < 24);
  const toyObservation = (toy: CompanionToy, world: CompanionWorld): CompanionToyObservation | undefined => {
    const plane = world.platforms.find(plane => plane.id === toy.platformId);
    if (!plane || !companionOutsideItem(world, toy) || toy.held || toy.carried || toy.hidden
      || ![toy.x, toy.y].every(Number.isFinite) || Math.abs(toy.y-plane.y) > 2 || toy.x < plane.x || toy.x > plane.x+plane.width) return;
    return { id: toy.id, platformId: plane.id, fraction: (toy.x-plane.x)/plane.width, kind: toy.kind };
  };
  let topology: Map<string, Platform> | undefined, reviewLayout = false;
  const changed = (planes: readonly Platform[]) => {
    const common = planes.filter(plane => topology?.has(plane.id) && !/^viewport-floor(?:$|-)/.test(plane.id));
    if (!common.length) return [];
    // All viewport positions move together during scroll. Such translation is
    // not a new room, even when a pending layout signal happens to accompany it.
    // A viewport floor/sticky header need not share the calendar's scroll.
    // Use the common places' median translation rather than one fixed anchor.
    const median = (values: number[]) => values.sort((a, b) => a-b)[Math.floor(values.length/2)];
    const dx = median(common.map(plane => plane.x-topology!.get(plane.id)!.x));
    const dy = median(common.map(plane => plane.y-topology!.get(plane.id)!.y));
    return common.filter(plane => {
      const old = topology!.get(plane.id)!;
      const ownDx = plane.x-old.x, ownDy = plane.y-old.y;
      // geometry.ts publishes the real weekday/studio header as a date
      // support with this suffix, including its numbered safe spans. A fixed
      // sticky header can stay put while the surrounding calendar scrolls.
      const fixedHeader = plane.kind === "date" && /-header(?:-\d+)?$/.test(plane.id)
        && Math.abs(ownDx) < 8 && Math.abs(ownDy) < 8 && Math.hypot(dx, dy) >= 16;
      // Subtract the common scroll rather than suppressing a concurrent real
      // resize/rearrangement. A pure translation still renews no inspection.
      return plane.kind !== old.kind || Math.abs(plane.width-old.width) >= 16
        || !fixedHeader && (Math.abs(ownDx-dx) >= 16 || Math.abs(ownDy-dy) >= 16);
    }).map(plane => plane.id);
  };
  return {
    layoutChanged() { reviewLayout = true; },
    observe(world: CompanionWorld, recent: readonly string[] = []) {
      const planes = world.platforms.slice(0, 200).filter(companionOutsideSupport);
      if (topology === undefined || reviewLayout) {
        const first = topology === undefined;
        if (!first) for (const id of changed(planes)) visited.delete(id);
        if (first) for (const id of recent.slice(-8)) if (planes.some(plane => plane.id === id)) visited.add(id);
        topology = new Map(planes.map(plane => [plane.id, { ...plane }])); reviewLayout = false;
      }
      const support = planes.find(plane => plane.id === world.platformId);
      if (support && [world.x, world.y].every(Number.isFinite) && Math.abs(world.y-support.y) <= 2
        && world.x >= support.x && world.x <= support.x+support.width) {
        visited.delete(support.id); visited.add(support.id);
        if (visited.size > 200) visited.delete(visited.values().next().value!);
      }
    },
    novel: (plane: Platform) => companionOutsideSupport(plane) && !visited.has(plane.id),
    novelToy(toy: CompanionToy, world: CompanionWorld) {
      const observation = toyObservation(toy, world), plane = world.platforms.find(plane => plane.id === observation?.platformId);
      return Boolean(observation && plane && !sameToy(inspectedToys.get(toy.id), observation, plane.width));
    },
    inspectToy(toy: CompanionToy, world: CompanionWorld) {
      const observation = toyObservation(toy, world), plane = world.platforms.find(plane => plane.id === observation?.platformId);
      if (!observation || !plane) return;
      const known = inspectedToys.get(toy.id), confirmed = Boolean(known?.confirmed && sameToy(known, observation, plane.width));
      inspectedToys.delete(toy.id); inspectedToys.set(toy.id, { ...observation, confirmed });
      if (inspectedToys.size > 16) inspectedToys.delete(inspectedToys.keys().next().value!);
      return observation;
    },
    confirmToyInspection(observation: CompanionToyObservation) {
      inspectedToys.delete(observation.id); inspectedToys.set(observation.id, { ...observation, confirmed: true });
      if (inspectedToys.size > 16) inspectedToys.delete(inspectedToys.keys().next().value!);
    },
    inspectedToy(toy: CompanionToy, world: CompanionWorld) {
      const observation = toyObservation(toy, world), plane = world.platforms.find(plane => plane.id === observation?.platformId), known = inspectedToys.get(toy.id);
      return Boolean(known?.confirmed && observation && plane && sameToy(known, observation, plane.width));
    },
  };
}
