export type CompanionEyeView = "front" | "quarter" | "side" | "back";

/** Existing vector camera projections, shared by its source cells and fitting.
 * Expression-specific eye boxes own contact, not a worn object's nominal size. */
export function companionEyeViewScale(view: CompanionEyeView): number {
  return view === "quarter" ? .83 : view === "side" ? .56 : 1;
}

type FaceAxis = Readonly<{ x: number; y: number; roll: number }>;
export type CompanionFaceEye = Readonly<{ center: readonly number[]; bounds: readonly number[]; drawn?: readonly number[] }>;

/** One eye's extent in the face's own axis (u along the eye line, v across
 * it), relative to the face centre: [u0, v0, u1, v1]. `bounds` is the tight
 * measured pixel box (image axes); `drawn` is the eye drawing's half size in
 * the face axis, which rolls with the head. A rolled drawing must not become
 * an image-axis box first: projecting that box's corners back through the
 * same roll counts the roll twice (half-height grows by halfWidth*sin(2*roll)),
 * which made eye masks and the monocle jump in size on rolled frames. */
export function companionEyeFaceBounds(eye: CompanionFaceEye, face: FaceAxis): [number, number, number, number] {
  const angle = face.roll * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const project = (x: number, y: number) => [(x - face.x) * c + (y - face.y) * s, -(x - face.x) * s + (y - face.y) * c] as const;
  const points: (readonly [number, number])[] = [0, 2].flatMap(x => [1, 3].map(y => project(eye.bounds[x], eye.bounds[y])));
  if (eye.drawn) {
    const [u, v] = project(eye.center[0], eye.center[1]), [a, b] = eye.drawn;
    points.push([u - a, v - b], [u + a, v + b]);
  }
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
}

export function companionEyeAccessorySpan(standingSpan: number, view: CompanionEyeView): number | undefined {
  return Number.isFinite(standingSpan) && standingSpan > 0 ? standingSpan * companionEyeViewScale(view) : undefined;
}
