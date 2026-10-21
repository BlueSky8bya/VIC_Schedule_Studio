type FaceAnchors = { eyes: readonly { center: readonly number[] }[]; mouth: { x: number; y: number } | null };
/** One pose-relative face axis. Gaze never relocates the mouth; roll and the
 * source pose remain intact. A shallow native mouth gains room below the eyes. */
export function companionFaceLayout(pose: FaceAnchors) {
  const [left, right] = pose.eyes.map(eye => eye.center);
  const x = (left[0] + right[0]) / 2, y = (left[1] + right[1]) / 2;
  const angle = Math.atan2(right[1] - left[1], right[0] - left[0]);
  const depth = Math.max(4, pose.mouth ? (pose.mouth.x - x) * -Math.sin(angle) + (pose.mouth.y - y) * Math.cos(angle) : 4);
  return { x, y, angle, mouthX: x - Math.sin(angle) * depth, mouthY: y + Math.cos(angle) * depth };
}
