import type { CompanionSofaPoint } from "./sofa";

type Point = CompanionSofaPoint;
export type CompanionSofaPoseInput = {
  /** Unscaled CSS cell size. The actor's12%/24% layout offsets are cancelled
   * by its full-size inertia child, so this is also the inner layer size. */
  size: number;
  display: Readonly<{ x: number; y: number; scale: number }>;
  /** The cell actually painted after decode, in the atlas's80px logical grid. */
  cell: Readonly<{ x: number; y: number; clip: readonly number[] }>;
  shape: Readonly<{ bob: number; tilt: number; scaleX: number; scaleY: number }>;
  pressure: Readonly<{ x: number; y: number; tilt: number; squash: number }>;
  response: Readonly<{ lift: number; squash: number }>;
  facing: -1 | 1;
  sway: Readonly<{ tilt: number; stretch: number }>;
  /** Actual local CSS pixels, before display.scale. Held pose origin is
   * facing-conjugated; inertia origin is the unmirrored physical grip. */
  poseOrigin?: Point;
  inertiaOrigin?: Point;
  chew?: number;
};

type Transform = { origin: Point; x?: number; y?: number; tilt?: number; scaleX?: number; scaleY?: number };
const rounded = (value: number, precision: number) => Number(value.toFixed(precision));
function transform(point: Point, layer: Transform): Point {
  // CSS translate rotate scale applies scale first, then clockwise rotation
  // in downward-y coordinates, followed by translation around this origin.
  const angle = (layer.tilt ?? 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const x = (point.x - layer.origin.x) * (layer.scaleX ?? 1), y = (point.y - layer.origin.y) * (layer.scaleY ?? 1);
  return { x: layer.origin.x + x * cos - y * sin + (layer.x ?? 0), y: layer.origin.y + x * sin + y * cos + (layer.y ?? 0) };
}

/** Project the registered opaque clip, not the transparent92px container.
 * Matches the renderer's literal CSS precision and nested transform order:
 * sprite registration → pose → contact → reaction → facing → inertia → body.
 * No DOM, clock, mutable cache or frame scheduling. TL/TR/BR/BL winding may
 * reverse with facing, but all four complete posed corners remain available. */
function projectSpritePoints(input: CompanionSofaPoseInput, points: readonly Point[]): Point[] {
  const { size, display, cell, shape, pressure, response, facing, sway } = input;
  const bottom = { x: size / 2, y: size }, centre = { x: size / 2, y: size / 2 };
  const poseOrigin = input.poseOrigin ?? bottom, inertiaOrigin = input.inertiaOrigin ?? bottom, chew = input.chew ?? 0;
  if (cell.clip.length !== 4 || size <= 0 || display.scale <= 0 || ![1, -1].includes(facing)
    || ![size, display.x, display.y, display.scale, cell.x, cell.y, ...cell.clip, shape.bob, shape.tilt, shape.scaleX, shape.scaleY, pressure.x, pressure.y, pressure.tilt, pressure.squash, response.lift, response.squash, sway.tilt, sway.stretch, poseOrigin.x, poseOrigin.y, inertiaOrigin.x, inertiaOrigin.y, chew].every(Number.isFinite)) return [];
  const [top, right, lower, left] = cell.clip;
  if (cell.clip.some(value => value < 0) || left + right >= 80 || top + lower >= 80) return [];
  const layers: Transform[] = [
    { origin: poseOrigin, y: rounded(shape.bob, 3), tilt: rounded(shape.tilt, 3), scaleX: rounded(shape.scaleX + chew, 4), scaleY: rounded(shape.scaleY - chew * .8, 4) },
    { origin: bottom, x: rounded(pressure.x * facing, 3), y: rounded(pressure.y, 3), tilt: rounded(pressure.tilt * facing, 3), scaleX: rounded(1 + pressure.squash * .65, 4), scaleY: rounded(1 - pressure.squash, 4) },
    { origin: bottom, y: rounded(response.lift, 3), scaleX: rounded(1 + response.squash * .35, 4), scaleY: rounded(1 - response.squash, 4) },
    { origin: bottom, scaleX: facing },
    { origin: inertiaOrigin, tilt: rounded(sway.tilt, 3), scaleX: rounded(1 - sway.stretch * .35, 4), scaleY: rounded(1 + sway.stretch, 4) },
    // The fixed outer body retains CSS's default centre-centre origin. At a
    // nonunit scale its visible bottom is not simply display.y.
    { origin: centre, x: rounded(display.x - size / 2, 3), y: rounded(display.y - size, 3), scaleX: display.scale, scaleY: display.scale },
  ];
  if (layers.some((layer, index) => index !== 3 && (layer.scaleX ?? 1) <= 0 || (layer.scaleY ?? 1) <= 0)) return [];
  const projected = points.map(({ x, y }) => {
    let point: Point = { x: (x + cell.x) / 80 * size, y: (y + cell.y) / 80 * size };
    for (const layer of layers) point = transform(point, layer);
    return point;
  });
  return projected.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)) ? projected : [];
}

export function projectCompanionSofaBody(input: CompanionSofaPoseInput): Point[] {
  const [top, right, lower, left] = input.cell.clip;
  return projectSpritePoints(input, [{ x: left, y: top }, { x: 80 - right, y: top }, { x: 80 - right, y: 80 - lower }, { x: left, y: 80 - lower }]);
}

/** The same actual painted transform stack also places authored interaction
 * landmarks. Coordinates are within the80px texture cell, before registration.
 * Reusing this projection keeps a bite attached during mirroring, chew,
 * contact, support feedback and finite pose transitions without DOM reads. */
export function projectCompanionSpritePoint(input: CompanionSofaPoseInput, point: Readonly<Point>): Point | null {
  return projectSpritePoints(input, [point])[0] ?? null;
}
