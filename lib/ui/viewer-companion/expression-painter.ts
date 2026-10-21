import anchors from "./expression-anchors-161.json";
import { peekDecodedCompanionSprite, type CompanionSpriteSelection } from "./sprite-quality";
import { sampleCompanionExpression, type CompanionExpressionId } from "./expressions";

type Point = readonly number[];
type Eye = { center: Point; bounds: Point };
type Anchor = { physicalIndex: number; index: number; source: number; orientation: string; roll: number; eyes: Eye[]; mouth: { x: number; y: number; bounds: number[] } | null };
const poses = new Map<number, Anchor>(anchors.frames.map(a => [a.physicalIndex, a]));
const reference = poses.get(anchors.reference)!;
export const COMPANION_EXPRESSION_REFERENCE_SRC = anchors.sources[reference.source].src;
const PIXELS = 192, SCALE = PIXELS / 80;
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** A live code-native face rig, under the unchanged accessory layer and in
 * the exact registered sprite plane. Body/ears/cheeks/source pixels and all
 * transforms remain owned by the existing renderer. Only opaque eye/mouth
 * interiors can receive a patch. No independent animation loop or image node. */
export function createCompanionExpressionPainter(canvas: HTMLCanvasElement) {
  canvas.width = canvas.height = PIXELS;
  const ctx = canvas.getContext("2d"), scratch = document.createElement("canvas"); scratch.width = scratch.height = PIXELS;
  const pixels = scratch.getContext("2d", { willReadFrequently: true });
  let lastCell = "", lastDraw = "", original: ImageData | undefined;
  const allowed = new Uint8Array(PIXELS * PIXELS);
  const hide = () => { canvas.hidden = true; lastDraw = ""; };
  const background = (box: number[]) => {
    if (!pixels) return;
    const [left, top, right, bottom] = box.map(n => Math.round(n * SCALE));
    if (left < 0 || top < 0 || right >= PIXELS || bottom >= PIXELS || right <= left || bottom <= top) return;
    const image = pixels.getImageData(left, top, right - left + 1, bottom - top + 1), bytes = image.data;
    // A cheek/silhouette/transparent edge is never repainted as cream.
    for (let i = 3; i < bytes.length; i += 4) if (bytes[i] < 245) return;
    const colour = [0, 0, 0]; let count = 0;
    for (const [x, y] of [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]]) {
      const i = (y * image.width + x) * 4;
      if (bytes[i] < 190 || bytes[i + 1] < 175 || bytes[i + 2] < 130) continue;
      for (let k = 0; k < 3; k++) colour[k] += bytes[i + k]; count++;
    }
    if (count < 3) return;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) allowed[y * PIXELS + x] = 1;
    return `rgb(${colour.map(n => Math.round(n / count)).join(",")})`;
  };
  return {
    hide,
    paint(selected: CompanionSpriteSelection | undefined, expression: { id: CompanionExpressionId; progress: number } | null) {
      if (!ctx || !pixels || !selected || !expression) { hide(); return false; }
      const pose = poses.get(selected.physicalIndex), image = peekDecodedCompanionSprite(selected.src), eyeImage = peekDecodedCompanionSprite(COMPANION_EXPRESSION_REFERENCE_SRC);
      if (!pose || pose.index !== selected.index || anchors.sources[pose.source].src !== selected.src || !image || !eyeImage) { hide(); return false; }
      const face = sampleCompanionExpression(expression.id, expression.progress);
      if (face.weight < .005) { hide(); return false; }
      const key = `${selected.src}:${selected.index}`, draw = `${key}:${expression.id}:${Math.floor(expression.progress * 20)}`;
      if (draw === lastDraw && !canvas.hidden) return true;
      const cell = image.naturalWidth / selected.grid, ox = selected.index % selected.grid * cell, oy = Math.floor(selected.index / selected.grid) * cell;
      if (key !== lastCell) { pixels.clearRect(0, 0, PIXELS, PIXELS); pixels.drawImage(image, ox, oy, cell, cell, 0, 0, PIXELS, PIXELS); original = pixels.getImageData(0, 0, PIXELS, PIXELS); lastCell = key; }
      if (!original) { hide(); return false; }
      allowed.fill(0); ctx.putImageData(original, 0, 0); ctx.save(); ctx.scale(SCALE, SCALE);
      let painted = 0;
      for (let i = 0; i < 2; i++) {
        const eye = pose.eyes[i], original = reference.eyes[i], view = pose.orientation === "quarter" ? .83 : 1;
        const width = (original.bounds[2] - original.bounds[0]) * view, height = (original.bounds[3] - original.bounds[1]) * view;
        const [x, y] = eye.center, gazeX = face.gazeX * .28 * face.weight, gazeY = face.gazeY * .25 * face.weight;
        const box = [Math.min(eye.bounds[0], x - width / 2 - .5) - .65, Math.min(eye.bounds[1], y - height / 2 - .5) - .65, Math.max(eye.bounds[2], x + width / 2 + .5) + .65, Math.max(eye.bounds[3], y + height / 2 + .5) + .65];
        const fill = background(box); if (!fill) continue;
        ctx.fillStyle = fill; ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
        const open = mix(1, i === 0 ? face.left : face.right, face.weight), referenceCell = eyeImage.naturalWidth / 8;
        ctx.save(); ctx.translate(x, y); ctx.rotate(pose.roll * Math.PI / 180);
        if (open > .16) {
          ctx.beginPath(); ctx.rect(-width / 2 - .6, -height / 2 + height * (1 - open) * .65, width + 1.2, height * open + .2); ctx.clip();
          ctx.drawImage(eyeImage, original.bounds[0] / 80 * referenceCell, original.bounds[1] / 80 * referenceCell, (original.bounds[2] - original.bounds[0]) / 80 * referenceCell, (original.bounds[3] - original.bounds[1]) / 80 * referenceCell, -width / 2 + gazeX, -height / 2 + gazeY, width, height);
        } else {
          ctx.strokeStyle = "#68452a"; ctx.lineWidth = .68; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-width * .43, 0); ctx.quadraticCurveTo(0, face.smile > .3 ? -1 : .7, width * .43, 0); ctx.stroke();
        }
        ctx.restore();
        if (face.tears > 0) { ctx.fillStyle = `rgba(117,175,204,${face.tears * face.weight * .8})`; ctx.beginPath(); ctx.ellipse(x + width * .45, y + height * .65, .45, .75, 0, 0, Math.PI * 2); ctx.fill(); }
        painted++;
      }
      if (pose.mouth && (Math.abs(face.smile) + face.open + face.tremble > .01)) {
        const m = pose.mouth, box = [m.bounds[0] - .8, m.bounds[1] - 1.7, m.bounds[2] + .8, m.bounds[3] + 1.8], fill = background(box);
        if (fill) {
          ctx.fillStyle = fill; ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]); ctx.save(); ctx.translate(m.x, m.y); ctx.rotate((pose.roll + face.slant * 3) * Math.PI / 180);
          ctx.strokeStyle = "#765030"; ctx.fillStyle = "#7c5238"; ctx.lineWidth = .55; ctx.lineCap = "round";
          const opening = face.open * face.weight, tremble = Math.sin(expression.progress * Math.PI * 18) * face.tremble * face.weight * .22;
          if (opening > .16) { ctx.beginPath(); ctx.ellipse(0, tremble, .65 + opening * .5, .3 + opening * 1.25, 0, 0, Math.PI * 2); ctx.fill(); }
          else { const width = Math.max(1.25, Math.min(1.8, (m.bounds[2] - m.bounds[0]) / 2)); ctx.beginPath(); ctx.moveTo(-width, tremble); ctx.quadraticCurveTo(0, .55 + face.smile * face.weight * 1.4, width, -tremble); ctx.stroke(); }
          ctx.restore();
        }
      }
      ctx.restore();
      if (!painted) { hide(); return false; }
      // The source is intentionally alpha253 in many opaque-looking regions.
      // A source-over face would increase its opacity. Replace the current
      // sprite plane instead, conserving every alpha byte and all non-face /
      // orange-cheek pixels. No source file or body geometry is rewritten.
      const final = ctx.getImageData(0, 0, PIXELS, PIXELS);
      for (let i = 0; i < final.data.length; i += 4) {
        const keep = !allowed[i / 4] || original.data[i] > 210 && original.data[i + 1] < 190 && original.data[i + 2] < 135;
        if (keep) for (let k = 0; k < 3; k++) final.data[i + k] = original.data[i + k];
        final.data[i + 3] = original.data[i + 3];
      }
      ctx.putImageData(final, 0, 0);
      canvas.style.transform = `translate3d(${selected.frame.x / 80 * 100}%,${selected.frame.y / 80 * 100}%,0)`;
      canvas.style.clipPath = `inset(${selected.frame.clip.map(n => `${n / 80 * 100}%`).join(" ")})`;
      canvas.hidden = false; lastDraw = draw; return true;
    },
  };
}
