import anchors from "./expression-anchors-161.json";
import { companionFaceLayout } from "./face-layout";
import { peekDecodedCompanionSprite, type CompanionSpriteSelection } from "./sprite-quality";
import { COMPANION_EYE_SHAPE as E, COMPANION_MOUTH_SHAPE as M, sampleCompanionExpression, type CompanionExpressionId } from "./expressions";

type Point = readonly number[];
type Eye = { center: Point; bounds: Point; skinSamples?: readonly Point[] };
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
export function createCompanionExpressionPainter(canvas: HTMLCanvasElement, readImage: (src: string) => HTMLImageElement | undefined = peekDecodedCompanionSprite) {
  canvas.width = canvas.height = PIXELS;
  const ctx = canvas.getContext("2d"), scratch = document.createElement("canvas"); scratch.width = scratch.height = PIXELS;
  const pixels = scratch.getContext("2d", { willReadFrequently: true });
  let lastCell = "", lastDraw = "", original: ImageData | undefined;
  const allowed = new Uint8Array(PIXELS * PIXELS);
  const hide = () => { canvas.hidden = true; lastDraw = ""; };
  const background = (box: number[], feature: 1 | 2 = 1, skinSamples?: readonly Point[]) => {
    if (!pixels) return;
    const [left, top, right, bottom] = box.map(n => Math.round(n * SCALE));
    if (left < 0 || top < 0 || right >= PIXELS || bottom >= PIXELS || right <= left || bottom <= top) return;
    const image = pixels.getImageData(left, top, right - left + 1, bottom - top + 1), bytes = image.data;
    // A cheek/silhouette/transparent edge is never repainted as cream.
    for (let i = 3; i < bytes.length; i += 4) if (bytes[i] < 245) return;
    const colour = [0, 0, 0]; let count = 0;
    const samples = skinSamples?.map(([x, y]) => [Math.round(x * SCALE) - left, Math.round(y * SCALE) - top]) ?? [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]];
    for (const [x, y] of samples) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
      const i = (y * image.width + x) * 4;
      if (bytes[i] < 190 || bytes[i + 1] < 175 || bytes[i + 2] < 130) continue;
      for (let k = 0; k < 3; k++) colour[k] += bytes[i + k]; count++;
    }
    if (count < 3) return;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) allowed[y * PIXELS + x] = feature;
    return `rgb(${colour.map(n => Math.round(n / count)).join(",")})`;
  };
  return {
    hide,
    paint(selected: CompanionSpriteSelection | undefined, expression: { id: CompanionExpressionId; progress: number } | null) {
      if (!ctx || !pixels || !selected || !expression) { hide(); return false; }
      const pose = poses.get(selected.physicalIndex), image = readImage(selected.src), eyeImage = readImage(COMPANION_EXPRESSION_REFERENCE_SRC);
      if (!pose || pose.index !== selected.index || anchors.sources[pose.source].src !== selected.src || !image || !eyeImage) { hide(); return false; }
      const face = sampleCompanionExpression(expression.id, expression.progress);
      const layout = companionFaceLayout(pose);
      if (face.weight < .005) { hide(); return false; }
      const key = `${selected.src}:${selected.index}`, draw = `${key}:${expression.id}:${Math.floor(expression.progress * 240)}`;
      if (draw === lastDraw && !canvas.hidden) return true;
      const cell = image.naturalWidth / selected.grid, ox = selected.index % selected.grid * cell, oy = Math.floor(selected.index / selected.grid) * cell;
      if (key !== lastCell) { pixels.clearRect(0, 0, PIXELS, PIXELS); pixels.drawImage(image, ox, oy, cell, cell, 0, 0, PIXELS, PIXELS); original = pixels.getImageData(0, 0, PIXELS, PIXELS); lastCell = key; }
      if (!original) { hide(); return false; }
      allowed.fill(0); ctx.putImageData(original, 0, 0); ctx.save(); ctx.scale(SCALE, SCALE);
      // Clear every valid face patch before drawing any feature. Clearing
      // a large authored mouth after the eyes used to erase the new eyelids.
      const eyePatches = pose.eyes.map((eye, i) => {
        const original = reference.eyes[i], view = pose.orientation === "quarter" ? .83 : 1;
        const sharedWidth = reference.eyes.reduce((sum, eye) => sum + eye.bounds[2] - eye.bounds[0], 0) / 2;
        const sharedHeight = reference.eyes.reduce((sum, eye) => sum + eye.bounds[3] - eye.bounds[1], 0) / 2;
        const width = mix(original.bounds[2] - original.bounds[0], sharedWidth, face.weight) * view, height = mix(original.bounds[3] - original.bounds[1], sharedHeight, face.weight) * view;
        const maskWidth = Math.max(original.bounds[2] - original.bounds[0], sharedWidth) * view, maskHeight = Math.max(original.bounds[3] - original.bounds[1], sharedHeight) * view;
        const [x, y] = eye.center;
        let box = [Math.min(eye.bounds[0], x - maskWidth / 2 - 1) - .65, Math.min(eye.bounds[1], y - maskHeight / 2 - 1.6) - .65, Math.max(eye.bounds[2], x + maskWidth / 2 + 1) + .65, Math.max(eye.bounds[3], y + maskHeight / 2 + 1.2) + .65];
        let fill = background(box, 1, eye.skinSamples);
        // Drooping ears keep their original contour and colour.
        if (!fill) { box = [eye.bounds[0] - .4, eye.bounds[1] - .4, eye.bounds[2] + .4, eye.bounds[3] + .4]; fill = background(box); }
        return { original, width, height, x, y, box, fill };
      });
      const m = pose.mouth;
      const mouthX = m ? mix(m.x, layout.mouthX, face.weight) : 0, mouthY = m ? mix(m.y, layout.mouthY, face.weight) : 0;
      // One fixed opaque admission corridor covers the native and target
      // mouth throughout the finite morph. It is independently reproducible
      // from the public pose, without requiring a hidden animation phase.
      const mouthBox = m ? [Math.min(m.bounds[0] - .5, m.x - 3.4, layout.mouthX - 3.4), Math.min(m.bounds[1] - .5, m.y - 2, layout.mouthY - 2), Math.max(m.bounds[2] + .5, m.x + 3.4, layout.mouthX + 3.4), Math.max(m.bounds[3] + .5, m.y + 3.6, layout.mouthY + 3.6)] : undefined;
      const mouthFill = mouthBox ? background(mouthBox, 2) : undefined;
      for (const patch of [...eyePatches, ...(mouthBox ? [{ box: mouthBox, fill: mouthFill }] : [])]) if (patch.fill) { ctx.fillStyle = patch.fill; ctx.fillRect(patch.box[0], patch.box[1], patch.box[2] - patch.box[0], patch.box[3] - patch.box[1]); }
      let painted = 0;
      for (let i = 0; i < 2; i++) {
        const { original, width, height, x, y, fill } = eyePatches[i]; if (!fill) continue;
        const gazeX = Math.max(-width * .28, Math.min(width * .28, face.gazeX * .9)) * face.weight;
        const gazeY = Math.max(-height * .25, Math.min(height * .25, face.gazeY * .8)) * face.weight;
        // A smiling source pose starts closed. Morph that lid into the target
        // instead of crossfading the old smile bitmap behind a new pupil.
        const nativeDepth = pose.eyes[i].bounds[3] - pose.eyes[i].bounds[1];
        const sourceClosure = pose.source === 9 || nativeDepth < height * .78 ? 1 : 0;
        const closure = mix(sourceClosure, i === 0 ? face.leftClosure : face.rightClosure, face.weight);
        const open = mix(1, i === 0 ? face.left : face.right, face.weight) * (1 - closure), referenceCell = eyeImage.naturalWidth / 8;
        const shape = i === 0 ? face.leftShape : face.rightShape, side = i === 0 ? 1 : -1;
        ctx.save(); ctx.translate(x, y); ctx.rotate(layout.angle);
        ctx.strokeStyle = "#704626"; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (open > .015) {
          ctx.save(); ctx.beginPath();
          // Preserve the pupil's width and texture. Eyelids move over it;
          // neither the eye bitmap nor the accessory is vertically scaled.
          const view = pose.orientation === "quarter" ? .83 : 1, padX = .3 * view, padY = .65 * view;
          const top = -height / 2 - padY + (height + padY * 2) * (1 - open) * mix(.8, .5, closure);
          const bottom = height / 2 + padY - (height + padY * 2) * (1 - open) * mix(.2, .5, closure);
          const contour = face.weight * (1 - closure);
          // Centre the mirrored slope: changing only one endpoint also moved
          // the two eyelid midpoints in opposite vertical directions.
          const startSlope = shape === E.focus ? -side * height * .065 * contour : shape === E.worry ? side * height * .04 * contour : 0;
          ctx.moveTo(-width / 2 - .3 + gazeX, top + gazeY + startSlope);
          if (shape === E.focus) ctx.lineTo(width / 2 + .3 + gazeX, top + gazeY - startSlope);
          else if (shape === E.worry) ctx.quadraticCurveTo(gazeX, top + gazeY + height * .12 * contour, width / 2 + .3 + gazeX, top + gazeY - startSlope);
          else ctx.lineTo(width / 2 + .3 + gazeX, top + gazeY);
          ctx.lineTo(width / 2 + .3 + gazeX, bottom + gazeY);
          if (shape === E.soft) ctx.quadraticCurveTo(gazeX, bottom + gazeY - height * .1 * contour, -width / 2 - .3 + gazeX, bottom + gazeY);
          else ctx.lineTo(-width / 2 - .3 + gazeX, bottom + gazeY);
          ctx.closePath(); ctx.clip();
          // The measured brown component excludes its antialiased fringe.
          // Include that fringe so a round source eye is not cropped flat.
          ctx.drawImage(eyeImage, (original.bounds[0] - .3) / 80 * referenceCell, (original.bounds[1] - .65) / 80 * referenceCell, (original.bounds[2] - original.bounds[0] + .6) / 80 * referenceCell, (original.bounds[3] - original.bounds[1] + 1.3) / 80 * referenceCell, -width / 2 - padX + gazeX, -height / 2 - padY + gazeY, width + padX * 2, height + padY * 2);
          if (face.shine > 0) { ctx.fillStyle = `rgba(255,253,235,${face.shine * face.weight * .9})`; ctx.beginPath(); ctx.ellipse(-width * .12 + gazeX, -height * .17 + gazeY, width * .12, height * .16, -.3, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        if (closure > .35 && (shape === E.smile || shape === E.squeeze || sourceClosure)) {
          // Contracted lids use a soft lower arc, distinct from the happy
          // upper arch. No literal chevron or pointed punctuation eye.
          const t = (closure - .35) / .65;
          ctx.globalAlpha = t * t * (3 - 2 * t);
          ctx.lineWidth = Math.max(1.15, height * .27); ctx.beginPath();
          const squeeze = shape === E.squeeze ? face.weight : 0;
          ctx.moveTo(-width * .43, mix(height * .12, -height * .14, squeeze));
          ctx.quadraticCurveTo(0, mix(-height * .62, height * .5, squeeze), width * .43, mix(height * .12, -height * .14, squeeze));
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        if (face.brow) { ctx.globalAlpha = face.weight; ctx.lineWidth = .65; const lift = Math.abs(face.brow), by = -height / 2 - .8; ctx.beginPath(); ctx.moveTo(-width * .38, by + side * face.brow * .7); ctx.quadraticCurveTo(0, by - lift * .75, width * .38, by - side * face.brow * .7); ctx.stroke(); ctx.globalAlpha = 1; }
        if (face.tears > 0) { ctx.fillStyle = `rgba(117,175,204,${face.tears * face.weight * .9})`; ctx.beginPath(); ctx.ellipse(width * .28 * side, height * .55, .55, 1, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        painted++;
      }
      if (m && mouthFill) {
          ctx.save(); ctx.translate(mouthX, mouthY); ctx.rotate(layout.angle);
          ctx.strokeStyle = "#765030"; ctx.fillStyle = "#7c5238"; ctx.lineWidth = .8; ctx.lineCap = "round"; ctx.lineJoin = "round";
          const nativeHeight = m.bounds[3] - m.bounds[1], nativeOpen = nativeHeight > 2;
          const opening = mix(nativeOpen ? .85 : 0, face.open, face.weight);
          // Chattering moves a level mouth along the face normal. Opposite
          // offsets at its corners made a tilted mouth instead of a shiver.
          const tremble = Math.sin(expression.progress * Math.PI * 18) * face.tremble * face.weight * .65;
          const round = face.mouth === M.round ? 1 : face.mouthRound;
          const targetWidth = mix(face.mouth === M.line || face.mouth === M.inhale ? 1.9 : 2.6, face.mouth === M.inhale ? .65 + face.open * .2 : .8 + face.open * .65, round);
          const width = mix((m.bounds[2] - m.bounds[0]) / 2, targetWidth, face.weight);
          const targetSmile = face.mouth === M.line || face.mouth === M.round || face.mouth === M.inhale ? 0 : face.mouth === M.pout ? face.smile - .2 : face.smile;
          const curve = targetSmile * 1.8;
          const roundHeight = .7 + face.open * (face.mouth === M.inhale ? 4 : 2.5);
          const nativeEdge = nativeOpen ? -nativeHeight / 2 : 0;
          const edge = mix(nativeEdge, 0, face.weight);
          const topCurve = mix(nativeOpen ? nativeEdge + nativeHeight * .1 : .45, mix(curve - face.open * .5, -roundHeight, round), face.weight);
          const bottomCurve = mix(nativeOpen ? nativeEdge + nativeHeight * 2 : .45, mix(curve + face.open * 5, roundHeight, round), face.weight);
          if (nativeOpen) {
            const colour = [0, 0, 0]; let count = 0;
            const left = Math.ceil(m.bounds[0] * SCALE), right = Math.floor(m.bounds[2] * SCALE);
            const top = Math.ceil(m.bounds[1] * SCALE), bottom = Math.floor(m.bounds[3] * SCALE);
            for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
              const k = (y * PIXELS + x) * 4, r = original.data[k], g = original.data[k + 1], b = original.data[k + 2];
              if (original.data[k + 3] > 200 && r > 190 && r > g * 1.15 && g > 125 && g < 200 && b > 90 && b < 190) {
                colour[0] += r; colour[1] += g; colour[2] += b; count++;
              }
            }
            const sourceColour = count ? colour.map(n => n / count) : [213, 151, 121];
            ctx.fillStyle = `rgb(${sourceColour.map((n, i) => Math.round(mix(n, [124, 82, 56][i], face.weight))).join(",")})`;
          }
          // One deforming contour owns both the native mouth and the target.
          // No second source mouth survives underneath at entry or recovery.
          ctx.beginPath(); ctx.moveTo(-width, edge + tremble);
          if (face.mouth === M.wave) {
            const mid = mix((edge + topCurve) / 2, edge, face.weight), amplitude = 1.35 * face.weight;
            ctx.quadraticCurveTo(-width / 2, mid - amplitude, 0, mid);
            ctx.quadraticCurveTo(width / 2, mid + amplitude, width, edge + tremble);
          } else ctx.quadraticCurveTo(0, topCurve + tremble, width, edge + tremble);
          if (bottomCurve - topCurve > .03 && nativeOpen && face.weight < 1) {
            // The authored happy mouth has upright sides and a rounded U
            // floor. Preserve that shape near entry/recovery; a single
            // quadratic turns it into a pointed V even at almost-zero weight.
            const sideY = mix(nativeEdge + nativeHeight * .7, (edge * 2 + bottomCurve) / 3, face.weight);
            const floorY = mix(nativeEdge + nativeHeight, (edge + bottomCurve) / 2, face.weight);
            const sideX = mix(width, width * 2 / 3, face.weight), floorX = mix(width * .65, width / 3, face.weight);
            ctx.bezierCurveTo(sideX, sideY, floorX, floorY, 0, floorY);
            ctx.bezierCurveTo(-floorX, floorY, -sideX, sideY, -width, edge + tremble);
          } else if (bottomCurve - topCurve > .03) ctx.quadraticCurveTo(0, bottomCurve + tremble, -width, edge + tremble);
          if (bottomCurve - topCurve > .03) { ctx.fill(); ctx.stroke(); }
          else ctx.stroke();
          const tongue = mix(nativeOpen ? .8 : 0, face.mouth === M.grin ? face.open : 0, face.weight);
          if (face.mouth === M.tongue && face.weight > .01) {
            ctx.globalAlpha = face.weight; ctx.fillStyle = "#d59779"; ctx.strokeStyle = "#9b6450"; ctx.lineWidth = .4;
            const root = Math.max(.2, bottomCurve * .22), tip = root + 1.25 + face.open * .45;
            ctx.beginPath(); ctx.moveTo(-width * .6, root); ctx.lineTo(width * .6, root);
            ctx.bezierCurveTo(width * .6, tip, -width * .6, tip, -width * .6, root);
            ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
          } else if (tongue > .03 && opening > .03) {
            ctx.fillStyle = "#d59779"; ctx.beginPath(); ctx.ellipse(0, Math.max(0, bottomCurve * .28), width * .45, tongue * .55, 0, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
      }
      ctx.restore();
      if (!painted) { hide(); return false; }
      // The source is intentionally alpha253 in many opaque-looking regions.
      // A source-over face would increase its opacity. Replace the current
      // sprite plane instead, conserving every alpha byte and all non-face /
      // orange-cheek pixels. No source file or body geometry is rewritten.
      const final = ctx.getImageData(0, 0, PIXELS, PIXELS);
      const admission = Math.min(1, face.weight / .15), sourceBlend = admission * admission * (3 - 2 * admission);
      for (let i = 0; i < final.data.length; i += 4) {
        // Orange square cheeks can intersect the eye patch. A source's red
        // laughing mouth/tongue is also orange by RGB, but belongs to the
        // separately bounded mouth patch and must not survive a new face.
        const x = i / 4 % PIXELS / SCALE, y = Math.floor(i / 4 / PIXELS) / SCALE;
        const sourceMouth = m && x >= m.bounds[0] - .6 && x <= m.bounds[2] + .6 && y >= m.bounds[1] - .6 && y <= m.bounds[3] + .6;
        const keep = !allowed[i / 4] || !sourceMouth && original.data[i] > 210 && original.data[i + 1] < 190 && original.data[i + 2] < 135;
        for (let k = 0; k < 3; k++) final.data[i + k] = keep ? original.data[i + k] : Math.round(mix(original.data[i + k], final.data[i + k], sourceBlend));
        final.data[i + 3] = original.data[i + 3];
      }
      ctx.putImageData(final, 0, 0);
      canvas.style.transform = `translate3d(${selected.frame.x / 80 * 100}%,${selected.frame.y / 80 * 100}%,0)`;
      canvas.style.clipPath = `inset(${selected.frame.clip.map(n => `${n / 80 * 100}%`).join(" ")})`;
      canvas.hidden = false; lastDraw = draw; return true;
    },
  };
}
