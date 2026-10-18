import { getCompanionCollectionArtFrame, type CompanionAccessoryView, type CompanionCollectionArtFrame } from "./collection-art";
import { currentCompanionAccessory, type CompanionAccessoryId } from "./accessory-catalog";
export type CompanionAccessoryArtFrame = Omit<CompanionCollectionArtFrame, "atlas"> & Readonly<{ atlas: string }>;
const ids = ["bell-badge", "heart-badge", "lemon-badge", "eyepatch", "propeller-hat", "magic-pocket", "bandage", "tiny-crown", "mushroom-hat", "star-patch", "propeller-rotor", "magic-pocket-open"] as const;
const views: readonly CompanionAccessoryView[] = ["front", "quarter", "side", "back"];
// Content bounds are authored alongside this tiny SVG atlas. The shared
// mounted pivot remains unchanged for the separate rotor cell.
const bounds = [[34, 32, 60, 66], [32, 34, 64, 62], [30, 26, 68, 69], [16, 38, 98, 43], [16, 16, 96, 110], [24, 34, 80, 74], [24, 43, 80, 43], [18, 23, 92, 75], [16, 23, 96, 76], [16, 34, 98, 43], [16, 16, 96, 110], [24, 34, 80, 74]] as const;
const frames = new Map<string, CompanionAccessoryArtFrame>();
for (const [row, id] of ids.entries()) for (const [column, view] of views.entries()) {
  const [left, top, width, height] = bounds[row], scale = view === "quarter" ? .83 : view === "side" ? .56 : 1, offset = 64 - 64 * scale + (view === "quarter" ? 3 : 0);
  frames.set(`${id}:${view}`, { id: `${id}:${view}`, atlas: "accessory-111", index: row * 4 + column, x: column * 128, y: row * 128, width: 128, height: 128, content: { x: left * scale + offset, y: top, width: width * scale, height }, src: "/companion/collection/accessories-111-v1.svg", atlasWidth: 512, atlasHeight: ids.length * 128 });
}
export function getCompanionAccessoryArtFrame(id: string | undefined, view: CompanionAccessoryView = "front"): CompanionAccessoryArtFrame | undefined {
  if (!id) return undefined;
  const current = currentCompanionAccessory(id as CompanionAccessoryId);
  return frames.get(`${current}:${view}`) ?? getCompanionCollectionArtFrame("accessory", current, view);
}
export const companionPropellerArt = (view: CompanionAccessoryView) => frames.get(`propeller-rotor:${view}`)!;
export const companionOpenPocketArt = (view: CompanionAccessoryView) => frames.get(`magic-pocket-open:${view}`)!;
