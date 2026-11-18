import edition from "@/lib/ui/viewer-companion/appearance-edition.json";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import overrides from "@/lib/ui/viewer-companion/expression-pose-overrides.json";
import expressions from "@/lib/ui/viewer-companion/expression-anchors-161.json";

// Independent fixture arithmetic: no production geometry helper is called.
export function appearancePoint<T extends { x: number; y: number }>(index: number, point: T): T {
  const { scale, pivot } = edition.frames.find(frame => frame.physicalIndex === index)!.material;
  return { ...point, x: pivot.x + (point.x - pivot.x) * scale, y: pivot.y + (point.y - pivot.y) * scale };
}
export function appearancePose(index: number) {
  const pose = anchors.frames[index], expression = [...expressions.frames,...overrides.frames].find(pose => pose.physicalIndex === index);
  const pair = (point: readonly number[]) => { const p = appearancePoint(index, { x: point[0], y: point[1] }); return [p.x, p.y]; };
  const bounds = (box: readonly number[]) => [...pair(box.slice(0, 2)), ...pair(box.slice(2))];
  const landmark = <T extends { x: number; y: number; width: number }>(point: T) => ({ ...appearancePoint(index, point), width: point.width * edition.frames[index].material.scale });
  const eyes = (expression?.eyes ?? pose.eyes).map(eye => ({ ...eye, center: pair(eye.center), bounds: bounds(eye.bounds) }));
  const face = landmark(pose.face);
  if (expression) { const [a, b] = eyes.map(eye => eye.center); face.x = (a[0] + b[0]) / 2; face.y = (a[1] + b[1]) / 2; face.roll = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; }
  return { ...pose, face, head: landmark(pose.head), chest: landmark(pose.chest), sideChest: landmark(pose.sideChest), sideBody: landmark(pose.sideBody), eyes, bodyBounds: bounds(pose.bodyBounds) };
}
