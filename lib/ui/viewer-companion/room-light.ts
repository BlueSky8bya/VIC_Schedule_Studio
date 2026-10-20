import { companionRoomBodyLight } from "./home-interaction";

type Point = Readonly<{ x: number; y: number }>;
export type CompanionRoomLightRect = Readonly<{ left: number; right: number; top: number; bottom: number }>;

/** Food/toy portals use the same room/point rule as the actual body. The caller
 * provides its existing cached room sample; never read DOM or infer by item ID.
 * Held, carried, falling and settled items are all their current painted foot. */
export function companionRoomItemLight(point: Point, room: CompanionRoomLightRect | undefined, grade: number): number {
  return companionRoomBodyLight(point, room, grade);
}
