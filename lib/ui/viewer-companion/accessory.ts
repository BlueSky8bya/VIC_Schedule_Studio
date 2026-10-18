import anchors from "./accessory-anchors.json";
import mouths from "./mouth-anchors.json";
import { getCompanionCollectionArtFrame, type CompanionCollectionArtFrame } from "./collection-art";
import type { CompanionAccessoryId } from "./gifts";
import type { CompanionSpriteSelection } from "./sprite-quality";
import { isCompanionHat, type CompanionAccessoryTransform } from "./accessory-motion";
import { createCompanionCollectionTextureReadiness } from "./collection-texture";
import { COMPANION_ACCESSORIES, currentCompanionAccessory } from "./accessory-catalog";
import { companionOpenPocketArt, companionPropellerArt, getCompanionAccessoryArtFrame, type CompanionAccessoryArtFrame } from "./accessory-art";

type Landmark = Readonly<{ x: number; y: number; width: number; roll: number }>;
type Pose = Readonly<{ physicalIndex: number; atlas: number; index: number; orientation: "front" | "quarter" | "side" | "back"; face: Landmark; head: Landmark; chest: Landmark; sideChest: Landmark; sideBody: Landmark; bodyBounds: readonly number[] }>;
type Placement = Readonly<{ art: CompanionAccessoryArtFrame; x: number; y: number; width: number; rotation: number; layer: "front" | "back" | "headwear"; mirror?: -1 | 1; pivot?: Readonly<{ x: number; y: number }>; clips?: Readonly<{ front: string; back: string }>; stretchY?: number; rotor?: number; rearArt?: CompanionAccessoryArtFrame }>;
const poses = new Map<number, Pose>((anchors.frames as readonly Pose[]).map(frame => [frame.physicalIndex, frame]));
// The native drawings themselves can turn in either direction before their
// common parent mirrors for travel. Measure yaw in the registered face axis,
// not viewport x: a tumble's in-plane roll is not a change of facing.
const poseYaw = new Map(anchors.frames.map(frame => {
  const angle = frame.face.roll * Math.PI / 180, [left, top, right, bottom] = frame.bodyBounds;
  const along = (frame.face.x - (left + right) / 2) * Math.cos(angle) + (frame.face.y - (top + bottom) / 2) * Math.sin(angle);
  // This source-bound tumble packet keeps the same right quarter camera.
  // Its nearly centred face crosses the AABB midpoint during a90° roll;
  // that small sign change must not turn the worn object inside the roll.
  return [frame.physicalIndex, frame.atlas === 20 ? 1 : along < 0 ? -1 : 1] as const;
}));
// Inspected source106 quarter cutouts look left; source107 looks right.
// Keep their pixels intact. In particular, an atlas prompt saying "right"
// does not override the direction actually drawn in the frozen source.
const sourceYaw = (art: CompanionAccessoryArtFrame): -1 | 1 => art.atlas === "accessory" ? -1 : 1;
const quarterGlassesEdge = [[0, 52], [10, 52], [15, 49], [23, 47], [31, 48], [38, 51], [43, 56], [49, 61], [53, 57], [60, 54], [71, 53], [79, 55], [87, 60], [92, 63], [102, 54], [108, 50], [115, 51], [128, 51]] as const;
const polygon = (points: readonly (readonly number[])[]) => `polygon(${points.map(([x, y]) => `${x / 128 * 100}% ${y / 128 * 100}%`).join(",")})`;
const glassesClips = { front: polygon([...quarterGlassesEdge, [128, 128], [0, 128]]), back: polygon([[0, 0], [128, 0], ...[...quarterGlassesEdge].reverse()]) };
const bagClips = { front: "inset(46% 0 0)", back: "inset(0 0 54%)" };
const calibratedMouths = new Map(mouths.frames.map(frame => [frame.index, frame]));
const familyPoint = { head: "head", eyes: "face", "chest-badge": "sideChest", "front-bow": "chest", "front-pocket": "chest", "side-prop": "sideBody" } as const;
const frontMounted = (id: CompanionAccessoryId) => ["chest-badge", "front-bow", "front-pocket"].includes(COMPANION_ACCESSORIES[id].family);
function withMotion(placement: Placement, pose: Pose, id: CompanionAccessoryId, motion?: CompanionAccessoryTransform): Placement {
  if (!motion) return placement;
  const angle = (COMPANION_ACCESSORIES[id].family === "eyes" ? pose.face.roll : placement.rotation) * Math.PI / 180;
  let x = placement.x + Math.sin(angle) * motion.lift + Math.cos(angle) * motion.shift, y = placement.y - Math.cos(angle) * motion.lift + Math.sin(angle) * motion.shift;
  const width = placement.width * motion.scale, rotation = placement.rotation + motion.roll;
  if (frontMounted(id) && pose.orientation !== "back") {
    const faceAngle = pose.face.roll * Math.PI / 180, nx = -Math.sin(faceAngle), ny = Math.cos(faceAngle), delta = rotation * Math.PI / 180 - faceAngle, aspect = placement.art.content.height / placement.art.content.width;
    const safeTop = (placement.x - pose.face.x) * nx + (placement.y - pose.face.y) * ny - placement.width * aspect / 2;
    const movedTop = (x - pose.face.x) * nx + (y - pose.face.y) * ny - Math.abs(Math.sin(delta)) * width / 2 - Math.abs(Math.cos(delta)) * width * aspect / 2;
    // A flutter/ring may move the cloth below its resting band, never across
    // the same source's mouth or face. Reuse that measured resting boundary.
    const correction = Math.max(0, safeTop - movedTop); x += nx * correction; y += ny * correction;
  }
  return { ...placement, x, y, width, rotation, ...(id === "propeller-hat" ? { rotor: motion.rotor ?? 0 } : {}), ...(id === "magic-pocket" ? { stretchY: 1 + Math.max(0, Math.min(1, motion.aperture ?? 0)) * .16 } : {}) };
}

/** The adopted image owns its attachment. Every authored/rig frame has its
 * own offline measured landmarks; a decoder fallback never borrows the
 * requested action's face or ear location. Coordinates precede registration. */
export function companionAccessoryPlacement(selected: CompanionSpriteSelection, id: CompanionAccessoryId, motion?: CompanionAccessoryTransform): Placement | null {
  id = currentCompanionAccessory(id);
  const pose = poses.get(selected.physicalIndex), source = pose && anchors.sources[pose.atlas];
  const item = COMPANION_ACCESSORIES[id], spec = item && { point: familyPoint[item.family], scale: item.scale };
  if (!pose || !source || source.src !== selected.src || pose.index !== selected.index || !spec) return null;
  if (motion && (!Object.values(motion).every(Number.isFinite) || motion.scale <= 0)) return null;
  const point = pose[spec.point], art = id === "magic-pocket" && (motion?.aperture ?? 0) > .1 ? companionOpenPocketArt(pose.orientation) : getCompanionAccessoryArtFrame(id, pose.orientation);
  if (!art || ![point.x, point.y, point.width, point.roll].every(Number.isFinite) || point.width <= 0) return null;
  const headwear = isCompanionHat(id), quarter = pose.orientation === "quarter";
  const mirror: -1 | 1 = quarter && poseYaw.get(selected.physicalIndex) !== sourceYaw(art) ? -1 : 1;
  const decoration = { mirror, ...(id === "sunglasses" && quarter ? { pivot: { x: 49, y: 68 }, clips: glassesClips } : id === "satchel" ? { clips: bagClips } : id === "propeller-hat" ? { rearArt: companionPropellerArt(pose.orientation), rotor: 0 } : {}) };
  // The measured ear-root line receives the brim, not the cap's centre.
  // Shift along this pose's own head normal; the parent rig then deforms the
  // whole attachment together. A worn cap overlaps the lower ear roots while
  // its registered position leaves the two ear tips and face visible.
  // Ear-root spacing is a stable pivot, but too narrow to size a readable
  // hat at the actual92px pet size. Keep its source-measured body proportion
  // as a lower bound without moving the pivot or hiding the ear tips.
  const baseWidth = headwear ? Math.max(point.width, pose.chest.width * .38) : point.width;
  if (frontMounted(id) && pose.orientation !== "back") {
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
    const along = (point.x - pose.face.x) * Math.cos(angle) + (point.y - pose.face.y) * Math.sin(angle);
    return withMotion({ art, x: pose.face.x + nx * centre + Math.cos(angle) * along, y: pose.face.y + ny * centre + Math.sin(angle) * along, width: height * art.content.width / art.content.height, rotation: point.roll, layer: "front", ...decoration }, pose, id, motion);
  }
  const width = baseWidth * spec.scale, brim = headwear ? width * art.content.height / art.content.width * (id === "propeller-hat" ? .45 : .2) : id === "leaf-umbrella" ? pose.chest.width * .48 : 0, angle = point.roll * Math.PI / 180;
  return withMotion({ art, x: point.x + Math.sin(angle) * brim, y: point.y - Math.cos(angle) * brim, width, rotation: point.roll - (id === "sunglasses" && quarter ? 12.5 * mirror : 0),
    layer: headwear ? "headwear" : pose.orientation === "back" && (frontMounted(id) || item.family === "eyes") ? "back" : "front", ...decoration }, pose, id, motion);
}

/** Local80-space anchors for finite special actions. The root world projects
 * this exact adopted frame with its existing parent pose/facing transform. */
export function companionAccessoryAnchor(selected: CompanionSpriteSelection, id: CompanionAccessoryId, part: "opening" | "rotor", motion?: CompanionAccessoryTransform): Landmark | null {
  const placement = companionAccessoryPlacement(selected, id, motion);
  if (!placement || (part === "opening" ? id !== "magic-pocket" : id !== "propeller-hat")) return null;
  const art = placement.art, px = art.content.x + art.content.width / 2, py = part === "opening" ? 47 : 22, scale = placement.width / art.content.width;
  const dx = (px - art.content.x - art.content.width / 2) * scale * (placement.mirror ?? 1), dy = (py - art.content.y - art.content.height / 2) * scale * (placement.stretchY ?? 1), angle = placement.rotation * Math.PI / 180;
  return { x: placement.x + Math.cos(angle) * dx - Math.sin(angle) * dy, y: placement.y + Math.sin(angle) * dx + Math.cos(angle) * dy, width: placement.width, roll: placement.rotation };
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
  const show = (node: HTMLElement, art: CompanionAccessoryArtFrame | CompanionCollectionArtFrame, point: Landmark, selected: CompanionSpriteSelection, width: number, placement?: Placement) => {
    const span = width * art.width / art.content.width;
    const cx = (placement?.pivot?.x ?? art.content.x + art.content.width / 2) / art.width, cy = (placement?.pivot?.y ?? art.content.y + art.content.height / 2) / art.height;
    style(node, "left", `${(point.x + selected.frame.x) / 80 * 100}%`);
    style(node, "top", `${(point.y + selected.frame.y) / 80 * 100}%`);
    style(node, "width", `${span / 80 * 100}%`); style(node, "height", `${span / 80 * 100}%`);
    style(node, "transform-origin", `${cx * 100}% ${cy * 100}%`);
    style(node, "transform", `translate(${-cx * 100}%,${-cy * 100}%) rotate(${point.roll.toFixed(3)}deg) scaleX(${placement?.mirror ?? 1}) scaleY(${placement?.stretchY ?? 1})`);
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
          if (!front && placement.rearArt && id === "propeller-hat") {
            const rotor = companionAccessoryAnchor(selected, id, "rotor", motion)!;
            show(node, placement.rearArt, { ...rotor, roll: rotor.roll + (placement.rotor ?? 0) }, selected, width, { ...placement, pivot: { x: placement.art.content.x + placement.art.content.width / 2, y: 22 } }); style(node, "clip-path", "none"); continue;
          }
          const visible = placement.clips || (placement.layer === "headwear" ? front : (placement.layer === "front") === front);
          if (visible) { show(node, placement.art, point, selected, width, placement); style(node, "clip-path", placement.clips?.[front ? "front" : "back"] ?? "none"); }
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
