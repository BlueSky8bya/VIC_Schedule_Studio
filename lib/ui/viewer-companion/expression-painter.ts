import anchors from "./expression-anchors-161.json";
import { peekDecodedCompanionSprite, type CompanionSpriteSelection } from "./sprite-quality";
import { COMPANION_EYE_SHAPE as E, COMPANION_MOUTH_SHAPE as M, sampleCompanionExpression, type CompanionExpressionId } from "./expressions";

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
      const key = `${selected.src}:${selected.index}`, draw = `${key}:${expression.id}:${Math.floor(expression.progress * 40)}`;
      if (draw === lastDraw && !canvas.hidden) return true;
      const cell = image.naturalWidth / selected.grid, ox = selected.index % selected.grid * cell, oy = Math.floor(selected.index / selected.grid) * cell;
      if (key !== lastCell) { pixels.clearRect(0, 0, PIXELS, PIXELS); pixels.drawImage(image, ox, oy, cell, cell, 0, 0, PIXELS, PIXELS); original = pixels.getImageData(0, 0, PIXELS, PIXELS); lastCell = key; }
      if (!original) { hide(); return false; }
      allowed.fill(0); ctx.putImageData(original, 0, 0); ctx.save(); ctx.scale(SCALE, SCALE);
      // Clear every valid face patch before drawing any feature. Clearing
      // a large authored mouth after the eyes used to erase the new eyelids.
      const eyePatches = pose.eyes.map((eye, i) => {
        const original = reference.eyes[i], view = pose.orientation === "quarter" ? .83 : 1;
        const width = (original.bounds[2] - original.bounds[0]) * view, height = (original.bounds[3] - original.bounds[1]) * view;
        const [x, y] = eye.center;
        let box = [Math.min(eye.bounds[0], x - width / 2 - .5) - .65, Math.min(eye.bounds[1], y - height / 2 - 1.6) - .65, Math.max(eye.bounds[2], x + width / 2 + .5) + .65, Math.max(eye.bounds[3], y + height / 2 + 1.2) + .65];
        let fill = background(box);
        // Drooping ears keep their original contour and colour.
        if (!fill) { box = [eye.bounds[0] - .4, eye.bounds[1] - .4, eye.bounds[2] + .4, eye.bounds[3] + .4]; fill = background(box); }
        return { original, width, height, x, y, box, fill };
      });
      const m = pose.mouth;
      const mouthBox = m ? [Math.min(m.bounds[0] - .5, m.x - 3.4), Math.min(m.bounds[1] - .5, m.y - 2), Math.max(m.bounds[2] + .5, m.x + 3.4), Math.max(m.bounds[3] + .5, m.y + 3.6)] : undefined;
      const mouthFill = mouthBox && Math.abs(face.smile) + face.open + face.tremble > .01 ? background(mouthBox) : undefined;
      for (const patch of [...eyePatches, ...(mouthBox ? [{ box: mouthBox, fill: mouthFill }] : [])]) if (patch.fill) { ctx.fillStyle = patch.fill; ctx.fillRect(patch.box[0], patch.box[1], patch.box[2] - patch.box[0], patch.box[3] - patch.box[1]); }
      let painted = 0;
      for (let i = 0; i < 2; i++) {
        const { original, width, height, x, y, fill } = eyePatches[i]; if (!fill) continue;
        const gazeX = face.gazeX * .45 * face.weight, gazeY = face.gazeY * .4 * face.weight;
        const open = mix(1, i === 0 ? face.left : face.right, face.weight), referenceCell = eyeImage.naturalWidth / 8;
        const shape = i === 0 ? face.leftShape : face.rightShape, side = i === 0 ? 1 : -1;
        ctx.save(); ctx.translate(x, y); ctx.rotate(pose.roll * Math.PI / 180);
        ctx.strokeStyle = "#704626"; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (shape === E.smile || shape === E.squeeze) {
          // A deliberate happy arch or tightly squeezed chevron, with the
          // reference eye's width and a rounded, visibly substantial stroke.
          ctx.lineWidth = Math.max(.9, height * .22); ctx.beginPath();
          if (shape === E.smile) { ctx.moveTo(-width * .43, height * .12); ctx.quadraticCurveTo(0, -height * .62, width * .43, height * .12); }
          else { ctx.moveTo(-width * .42 * side, -height * .36); ctx.lineTo(width * .22 * side, 0); ctx.lineTo(-width * .42 * side, height * .36); }
          ctx.stroke();
        } else {
          ctx.save(); ctx.beginPath();
          const top = -height / 2 + height * (1 - open), bottom = height / 2 + .15;
          ctx.moveTo(-width / 2 - .3, top);
          if (shape === E.focus) ctx.lineTo(width / 2 + .3, top + side * height * .28);
          else if (shape === E.worry) ctx.quadraticCurveTo(0, top + height * .28, width / 2 + .3, top - side * height * .18);
          else ctx.lineTo(width / 2 + .3, top);
          ctx.lineTo(width / 2 + .3, bottom);
          if (shape === E.soft) ctx.quadraticCurveTo(0, bottom - height * .3, -width / 2 - .3, bottom);
          else ctx.lineTo(-width / 2 - .3, bottom);
          ctx.closePath(); ctx.clip();
          ctx.drawImage(eyeImage, original.bounds[0] / 80 * referenceCell, original.bounds[1] / 80 * referenceCell, (original.bounds[2] - original.bounds[0]) / 80 * referenceCell, (original.bounds[3] - original.bounds[1]) / 80 * referenceCell, -width / 2 + gazeX, -height / 2 + gazeY, width, height);
          if (face.shine > 0) { ctx.fillStyle = `rgba(255,253,235,${face.shine * .9})`; ctx.beginPath(); ctx.ellipse(-width * .12 + gazeX, -height * .17 + gazeY, width * .12, height * .16, -.3, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        if (face.brow) { ctx.lineWidth = .65; const lift = Math.abs(face.brow), by = -height / 2 - .8; ctx.beginPath(); ctx.moveTo(-width * .38, by + side * face.brow * .7); ctx.quadraticCurveTo(0, by - lift * .75, width * .38, by - side * face.brow * .7); ctx.stroke(); }
        if (face.tears > 0) { ctx.fillStyle = `rgba(117,175,204,${face.tears * .9})`; ctx.beginPath(); ctx.ellipse(width * .28 * side, height * .55, .55, 1, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        painted++;
      }
      if (m && mouthFill) {
          ctx.save(); ctx.translate(m.x, m.y); ctx.rotate((pose.roll + face.slant * 3) * Math.PI / 180);
          ctx.strokeStyle = "#765030"; ctx.fillStyle = "#7c5238"; ctx.lineWidth = .8; ctx.lineCap = "round"; ctx.lineJoin = "round";
          const opening = face.open * face.weight, tremble = Math.sin(expression.progress * Math.PI * 18) * face.tremble * face.weight * .22;
          const width = 2.6, smile = face.smile * face.weight;
          ctx.beginPath();
          if (face.mouth === M.round) { ctx.ellipse(0, tremble + .35, .6 + opening * .8, .5 + opening * 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
          else if (face.mouth === M.grin && opening > .2) { ctx.moveTo(-width, -.6); ctx.quadraticCurveTo(0, 0, width, -.6); ctx.quadraticCurveTo(0, 2.4 + opening * 1.2, -width, -.6); ctx.fill(); ctx.fillStyle = "#d59779"; ctx.beginPath(); ctx.ellipse(0, 1.3 + opening * .4, 1, .55, 0, 0, Math.PI * 2); ctx.fill(); }
          else if (face.mouth === M.pout) { ctx.moveTo(-1.4, .5); ctx.quadraticCurveTo(0, -1.1 - smile, 1.4, .5); ctx.stroke(); }
          else if (face.mouth === M.wave) { ctx.moveTo(-width, tremble); for (let n = 1; n <= 4; n++) ctx.lineTo(-width + n * width / 2, tremble + (n % 2 ? .7 : -.15)); ctx.stroke(); }
          else if (face.mouth === M.cat) { ctx.moveTo(-width, -.2); ctx.quadraticCurveTo(-width / 2, 2.7, 0, .1); ctx.quadraticCurveTo(width / 2, 2.7, width, -.2); ctx.stroke(); }
          else if (face.mouth === M.tongue) { ctx.ellipse(0, .4, 1.6, 1, 0, 0, Math.PI); ctx.fill(); ctx.fillStyle = "#d78d79"; ctx.beginPath(); ctx.ellipse(.5, 1.1, .8, 1, 0, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.moveTo(-width, tremble); ctx.quadraticCurveTo(0, .1 + smile * 2.3, width, -tremble); ctx.stroke(); }
          ctx.restore();
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
        for (let k = 0; k < 3; k++) final.data[i + k] = keep ? original.data[i + k] : Math.round(mix(original.data[i + k], final.data[i + k], face.weight));
        final.data[i + 3] = original.data[i + 3];
      }
      ctx.putImageData(final, 0, 0);
      canvas.style.transform = `translate3d(${selected.frame.x / 80 * 100}%,${selected.frame.y / 80 * 100}%,0)`;
      canvas.style.clipPath = `inset(${selected.frame.clip.map(n => `${n / 80 * 100}%`).join(" ")})`;
      canvas.hidden = false; lastDraw = draw; return true;
    },
  };
}
