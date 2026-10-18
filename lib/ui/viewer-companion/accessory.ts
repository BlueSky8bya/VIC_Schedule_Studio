import anchors from "./accessory-anchors.json";
import mouths from "./mouth-anchors.json";
import { getCompanionCollectionArtFrame, type CompanionCollectionArtFrame } from "./collection-art";
import type { CompanionAccessoryId } from "./gifts";
import type { CompanionSpriteSelection } from "./sprite-quality";
import { isCompanionHat, type CompanionAccessoryTransform } from "./accessory-motion";
import { createCompanionCollectionTextureReadiness } from "./collection-texture";

type Landmark = Readonly<{ x: number; y: number; width: number; roll: number }>;
type Pose = Readonly<{ physicalIndex: number; atlas: number; index: number; orientation: "front" | "quarter" | "side" | "back"; face: Landmark; head: Landmark; chest: Landmark; sideChest: Landmark; sideBody: Landmark; bodyBounds: readonly number[] }>;
type Placement = Readonly<{ art: CompanionCollectionArtFrame; x: number; y: number; width: number; rotation: number; layer: "front" | "back" | "headwear" }>;
const poses = new Map<number, Pose>((anchors.frames as readonly Pose[]).map(frame => [frame.physicalIndex, frame]));
const calibratedMouths = new Map(mouths.frames.map(frame => [frame.index, frame]));
const specification: Readonly<Record<CompanionAccessoryId, { point: keyof Pick<Pose, "face" | "head" | "chest" | "sideChest" | "sideBody">; scale: number }>> = {
  sunglasses: { point: "face", scale: 1.32 }, beret: { point: "head", scale: 1.2 },
  bow: { point: "chest", scale: .28 }, "star-pin": { point: "sideChest", scale: .22 },
  "flower-crown": { point: "head", scale: 1.3 }, satchel: { point: "sideBody", scale: .4 },
  "pixel-sunglasses": { point: "face", scale: 1.3 }, "baseball-cap": { point: "head", scale: 1.2 },
  "party-hat": { point: "head", scale: .95 }, scarf: { point: "chest", scale: .3 },
  "bell-pendant": { point: "chest", scale: .24 }, "leaf-umbrella": { point: "sideBody", scale: .7 },
};
const neckwear = (id: CompanionAccessoryId) => id === "bow" || id === "scarf" || id === "bell-pendant";
function withMotion(placement: Placement, pose: Pose, id: CompanionAccessoryId, motion?: CompanionAccessoryTransform): Placement {
  if (!motion) return placement;
  const angle = placement.rotation * Math.PI / 180;
  let x = placement.x + Math.sin(angle) * motion.lift + Math.cos(angle) * motion.shift, y = placement.y - Math.cos(angle) * motion.lift + Math.sin(angle) * motion.shift;
  const width = placement.width * motion.scale, rotation = placement.rotation + motion.roll;
  if (neckwear(id) && pose.orientation !== "back") {
    const faceAngle = pose.face.roll * Math.PI / 180, nx = -Math.sin(faceAngle), ny = Math.cos(faceAngle), delta = rotation * Math.PI / 180 - faceAngle, aspect = placement.art.content.height / placement.art.content.width;
    const safeTop = (placement.x - pose.face.x) * nx + (placement.y - pose.face.y) * ny - placement.width * aspect / 2;
    const movedTop = (x - pose.face.x) * nx + (y - pose.face.y) * ny - Math.abs(Math.sin(delta)) * width / 2 - Math.abs(Math.cos(delta)) * width * aspect / 2;
    // A flutter/ring may move the cloth below its resting band, never across
    // the same source's mouth or face. Reuse that measured resting boundary.
    const correction = Math.max(0, safeTop - movedTop); x += nx * correction; y += ny * correction;
  }
  return { ...placement, x, y, width, rotation };
}

/** The adopted image owns its attachment. Every authored/rig frame has its
 * own offline measured landmarks; a decoder fallback never borrows the
 * requested action's face or ear location. Coordinates precede registration. */
export function companionAccessoryPlacement(selected: CompanionSpriteSelection, id: CompanionAccessoryId, motion?: CompanionAccessoryTransform): Placement | null {
  const pose = poses.get(selected.physicalIndex), source = pose && anchors.sources[pose.atlas];
  const spec = specification[id];
  if (!pose || !source || source.src !== selected.src || pose.index !== selected.index || !spec) return null;
  if (motion && (!Object.values(motion).every(Number.isFinite) || motion.scale <= 0)) return null;
  const point = pose[spec.point], art = getCompanionCollectionArtFrame("accessory", id, pose.orientation);
  if (!art || ![point.x, point.y, point.width, point.roll].every(Number.isFinite) || point.width <= 0) return null;
  const headwear = isCompanionHat(id);
  // The measured ear-root line receives the brim, not the cap's centre.
  // Shift along this pose's own head normal; the parent rig then deforms the
  // whole attachment together. A worn cap overlaps the lower ear roots while
  // its registered position leaves the two ear tips and face visible.
  // Ear-root spacing is a stable pivot, but too narrow to size a readable
  // hat at the actual92px pet size. Keep its source-measured body proportion
  // as a lower bound without moving the pivot or hiding the ear tips.
  const baseWidth = headwear ? Math.max(point.width, pose.chest.width * .38) : point.width;
  if (neckwear(id) && pose.orientation !== "back") {
    const angle = point.roll * Math.PI / 180, nx = -Math.sin(angle), ny = Math.cos(angle), depth = (x: number, y: number) => (x - pose.face.x) * nx + (y - pose.face.y) * ny;
    const [left, top, right, bottom] = pose.bodyBounds;
    const bodyDepth = Math.max(depth(left, top), depth(right, top), depth(left, bottom), depth(right, bottom));
    const mouth = calibratedMouths.get(selected.physicalIndex), mouthSource = mouth && mouths.atlases[mouth.atlas];
    const exactMouth = mouth && mouth.cell === selected.index && mouthSource?.src === selected.src && mouthSource.sha256 === source.sha256 ? mouth : undefined;
    const mouthBottom = exactMouth ? Math.max(...[0, 2].flatMap(x => [1, 3].map(y => depth(exactMouth.bounds[x] / mouths.cell * 80, exactMouth.bounds[y] / mouths.cell * 80)))) : 0;
    // A measured mouth wins where registered; the other authored frames keep
    // the full face band clear. Thin curled poses also shorten their clothing
    // instead of borrowing an upright neck box or hanging below their feet.
    const clearDepth = Math.max(7, pose.face.width * .3 + 1, mouthBottom + 1);
    const height = Math.min(baseWidth * spec.scale * art.content.height / art.content.width, Math.max(2, bodyDepth - clearDepth + 1.5));
    const chestDepth = depth(point.x, point.y), centre = Math.max(chestDepth, clearDepth + height / 2);
    return withMotion({ art, x: pose.face.x + nx * centre, y: pose.face.y + ny * centre, width: height * art.content.width / art.content.height, rotation: point.roll, layer: "front" }, pose, id, motion);
  }
  const width = baseWidth * spec.scale, brim = headwear ? width * art.content.height / art.content.width * .4 : id === "leaf-umbrella" ? pose.chest.width * .48 : 0, angle = point.roll * Math.PI / 180;
  return withMotion({ art, x: point.x + Math.sin(angle) * brim, y: point.y - Math.cos(angle) * brim, width, rotation: point.roll,
    layer: headwear ? "headwear" : pose.orientation === "back" && ["bow", "star-pin", "sunglasses", "pixel-sunglasses", "scarf", "bell-pendant"].includes(id) ? "back" : "front" }, pose, id, motion);
}

/** The prop lives in the same pose chain; only its native button hit plane
 * needs the existing projected viewport point. No extra scene loop or DOM
 * measurement is involved. */
export function companionGiftAnchor(selected: CompanionSpriteSelection): { x: number; y: number; width: number; roll: number; behind: boolean } | null {
  const pose = poses.get(selected.physicalIndex), source = pose && anchors.sources[pose.atlas];
  if (!pose || !source || source.src !== selected.src || pose.index !== selected.index) return null;
  return { ...pose.chest, y: pose.chest.y + pose.chest.width * .1, width: pose.chest.width * .43, behind: pose.orientation === "back" };
}

type Hosts = { back: HTMLElement; front: HTMLElement; gift: HTMLElement };
/** Reuse the parent's facing/pose/contact/inertia transforms and cache CSS
 * writes by their values. One small static accessory atlas is requested only
 * when an owned item is equipped; the character decoder is untouched. */
export function createCompanionAccessoryPainter(hosts: Hosts, textures = createCompanionCollectionTextureReadiness()) {
  let accessorySrc: string | undefined, giftSrc: string | undefined;
  const values = new WeakMap<HTMLElement, Map<string, string>>();
  const style = (node: HTMLElement, key: string, value: string) => {
    let cache = values.get(node); if (!cache) { cache = new Map(); values.set(node, cache); }
    if (cache.get(key) !== value) { cache.set(key, value); node.style.setProperty(key, value); }
  };
  const hide = (node: HTMLElement) => { if (!node.hidden) node.hidden = true; };
  const show = (node: HTMLElement, art: CompanionCollectionArtFrame, point: Landmark, selected: CompanionSpriteSelection, width: number) => {
    const span = width * art.width / art.content.width;
    const cx = (art.content.x + art.content.width / 2) / art.width, cy = (art.content.y + art.content.height / 2) / art.height;
    style(node, "left", `${(point.x + selected.frame.x) / 80 * 100}%`);
    style(node, "top", `${(point.y + selected.frame.y) / 80 * 100}%`);
    style(node, "width", `${span / 80 * 100}%`); style(node, "height", `${span / 80 * 100}%`);
    style(node, "transform-origin", `${cx * 100}% ${cy * 100}%`);
    style(node, "transform", `translate(${-cx * 100}%,${-cy * 100}%) rotate(${point.roll.toFixed(3)}deg)`);
    style(node, "background-image", `url("${art.src}")`);
    style(node, "background-size", `${art.atlasWidth / art.width * 100}% ${art.atlasHeight / art.height * 100}%`);
    style(node, "background-position", `${art.x / Math.max(1, art.atlasWidth - art.width) * 100}% ${art.y / Math.max(1, art.atlasHeight - art.height) * 100}%`);
    if (node.hidden) node.hidden = false;
  };
  return {
    paint(selected: CompanionSpriteSelection | undefined, id: CompanionAccessoryId | null, pending: boolean, motion?: CompanionAccessoryTransform) {
      const placement = selected && id ? companionAccessoryPlacement(selected, id, motion) : null;
      const gift = selected && pending ? companionGiftAnchor(selected) : null, art = gift && getCompanionCollectionArtFrame("gift", "gift-bag");
      accessorySrc = placement?.art.src; giftSrc = art?.src;
      textures.use([...(accessorySrc ? [accessorySrc] : []), ...(giftSrc ? [giftSrc] : [])]);
      if (placement && selected) {
        const width = placement.width;
        const point = { x: placement.x, y: placement.y, width, roll: placement.rotation };
        for (const [node, front] of [[hosts.back, false], [hosts.front, true]] as const) {
          const visible = placement.layer === "headwear" ? front : (placement.layer === "front") === front;
          if (visible) { show(node, placement.art, point, selected, width); style(node, "clip-path", "none"); }
          else hide(node);
        }
      } else { hide(hosts.back); hide(hosts.front); }
      if (gift && art && selected) { show(hosts.gift, art, gift, selected, gift.width); style(hosts.gift, "z-index", gift.behind ? "0" : "3"); }
      else hide(hosts.gift);
      return gift;
    },
    accessoryReady: () => textures.ready(accessorySrc),
    giftReady: () => textures.ready(giftSrc),
    clear() { hide(hosts.back); hide(hosts.front); hide(hosts.gift); textures.clear(); accessorySrc = giftSrc = undefined; },
  };
}
