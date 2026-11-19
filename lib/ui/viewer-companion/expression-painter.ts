import { companionEyeGlyph, companionFaceBackground } from "./face-plate";
import overrides from "./expression-pose-overrides.json";
import policy from "./appearance-policy.json";
import anchors from "./expression-anchors-161.json";
import { companionFaceLayout } from "./face-layout";
import { restoreCompanionSpiralEyes } from "./spiral-eyes";
import { compositeCompanionFaceInk, restoreCompanionTearInk } from "./face-ink";
import { peekDecodedCompanionSprite, type CompanionSpriteSelection } from "./sprite-quality";
import { COMPANION_EYE_SHAPE as E, COMPANION_MOUTH_SHAPE as M, sampleCompanionExpression, type CompanionExpressionId } from "./expressions";
import { companionAppearanceEyes, companionAppearancePoint, companionAppearanceBounds, companionAppearanceFrames, resolveCompanionAppearanceSource } from "./appearance";

type Point = readonly number[];
type Eye = { center: Point; bounds: Point; skinSamples?: readonly Point[] };
type Anchor = { physicalIndex: number; index: number; source: number; orientation: string; roll: number; eyes: Eye[]; mouth: { x: number; y: number; bounds: number[] } | null };
const poses = new Map<number, Anchor>([...anchors.frames,...overrides.frames].map(a => [a.physicalIndex, { ...a, eyes: companionAppearanceEyes(a.physicalIndex,a.eyes),
  mouth: a.mouth ? { ...companionAppearancePoint(a.physicalIndex,a.mouth),bounds:companionAppearanceBounds(a.physicalIndex,a.mouth.bounds) } : null }]));
// Owner 2026-11-18: the ORIGINAL running drawing is the size/texture
// authority. Using idle and shrinking quarter views twice made every eye tiny.
export const COMPANION_EXPRESSION_REFERENCE_INDEX = policy.eye.referencePhysicalIndex;
const reference = anchors.frames.find(a => a.physicalIndex === COMPANION_EXPRESSION_REFERENCE_INDEX)!;
const sources = anchors.sources.map(resolveCompanionAppearanceSource);
// Admission is immutable for a source cell. Testing against the current
// morphed height made the same closed face fail on entry and open at its peak.
const referenceHeights = reference.eyes.map(eye => eye.bounds[3] - eye.bounds[1]);
const sharedEyeHeight = referenceHeights.reduce((sum, height) => sum + height, 0) / 2;
const sourceEyeStates = new Map(Array.from(poses.values()).map(pose => {
  const states = pose.eyes.map((eye, i) => {
    if (pose.source === 9) return 1;
    const depth = eye.bounds[3] - eye.bounds[1], view = 1;
    const minimum = Math.min(referenceHeights[i], sharedEyeHeight) * view * .78;
    const maximum = Math.max(referenceHeights[i], sharedEyeHeight) * view * .78;
    return depth < minimum ? 1 : depth >= maximum ? 0 : undefined;
  });
  return [pose.physicalIndex, states.length === 2 && states[0] === states[1] ? states[0] : undefined] as const;
}));
// Read the immutable parent, never a recursively restyled reference atlas.
export const COMPANION_EXPRESSION_REFERENCE_SRC = anchors.sources[reference.source].src;
export const COMPANION_PETTING_EYE_STROKE_GAIN = policy.eye.pettingStrokeGain;
export function companionEyeStroke(height: number, petting = false) {
  return Math.max(.9, Math.min(1.3, height * .2)) * (petting ? COMPANION_PETTING_EYE_STROKE_GAIN : 1);
}
const PIXELS = 192, SCALE = PIXELS / 80;
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Follow the existing 4.8s CSS breath; linger closed between quiet exhales. */
export function sampleCompanionSleepMouth(elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  const phase = elapsedMs % 4800 / 4800;
  const amount = Math.max(0, Math.min(1, phase < .44 ? (phase - .12) / .32 : (.82 - phase) / .38));
  return amount * amount * (3 - 2 * amount);
}

/** A live code-native face rig, under the unchanged accessory layer and in
 * the exact registered sprite plane. Body/ears/cheeks/source pixels and all
 * transforms remain owned by the existing renderer. Only opaque eye/mouth
 * interiors can receive a patch. No independent animation loop or image node. */
export function createCompanionExpressionPainter(canvas: HTMLCanvasElement, readImage: (src: string) => HTMLImageElement | undefined = peekDecodedCompanionSprite) {
  canvas.width = canvas.height = PIXELS;
  const ctx = canvas.getContext("2d"), scratch = document.createElement("canvas"); scratch.width = scratch.height = PIXELS;
  const pixels = scratch.getContext("2d", { willReadFrequently: true });
  const inkCanvas = document.createElement("canvas"); inkCanvas.width = inkCanvas.height = PIXELS;
  const ink = inkCanvas.getContext("2d", { willReadFrequently: true });
  let lastCell = "", lastDraw = "", original: ImageData | undefined;
  const allowed = new Uint8Array(PIXELS * PIXELS);
  const hide = () => { canvas.hidden = true; lastDraw = ""; };
  const background = (box: number[], feature: 1 | 2 = 1, skinSamples?: readonly Point[], nativePlate = false) => {
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
    if (count < 3 && nativePlate && original) {
      // Offline native-style baking can use the surrounding opaque cream ring
      // when an old spiral/closed lid occupies all four local corners.
      for (let y = Math.max(0, top - 5); y <= Math.min(PIXELS - 1, bottom + 5) && count < 32; y++) for (let x = Math.max(0, left - 5); x <= Math.min(PIXELS - 1, right + 5) && count < 32; x++) {
        if (x >= left && x <= right && y >= top && y <= bottom) continue;
        const i = (y * PIXELS + x) * 4, bytes = original.data;
        if (bytes[i + 3] < 245 || bytes[i] < 220 || bytes[i + 1] < 200 || bytes[i + 2] < 150 || bytes[i] - bytes[i + 1] > 40) continue;
        for (let k = 0; k < 3; k++) colour[k] += bytes[i + k]; count++;
      }
    }
    if (count < 3) return;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) allowed[y * PIXELS + x] = feature;
    return `rgb(${colour.map(n => Math.round(n / count)).join(",")})`;
  };
  return {
    hide,
    paint(selected: CompanionSpriteSelection | undefined, expression: { id: CompanionExpressionId; progress: number } | null, blinkOrOptions: number | { native?: string; referenceImage?: HTMLImageElement; sleepMouth?: number } = 0) {
      const options = typeof blinkOrOptions === "number" ? undefined : blinkOrOptions;
      const blink = typeof blinkOrOptions === "number" ? blinkOrOptions : 0;
      const native = options?.native, blinkOnly = !expression && !native;
      const mouthOnly = native === "closed" && options?.sleepMouth !== undefined;
      if (!ctx || !pixels || !ink || !selected || !expression && !native && blink < .005) { hide(); return false; }
      const pose = poses.get(selected.physicalIndex), image = readImage(selected.src), eyeImage = blinkOnly || mouthOnly ? image : native && options?.referenceImage ? options.referenceImage : readImage(COMPANION_EXPRESSION_REFERENCE_SRC);
      if (!pose || pose.index !== selected.index || (sources[pose.source].src !== selected.src && (!native || anchors.sources[pose.source].src !== selected.src)) || !image || !eyeImage) { hide(); return false; }
      const authoredFrame = companionAppearanceFrames.get(selected.physicalIndex);
      const authoredState = authoredFrame?.eyeState;
      const sleeping = Boolean(native && [11, 78].includes(authoredFrame?.nativeCell ?? -1));
      if (mouthOnly && (!sleeping || !Number.isFinite(options?.sleepMouth))) { hide(); return false; }
      const sleepMouth = mouthOnly ? Math.round(Math.max(0, Math.min(1, options!.sleepMouth!)) * 64) / 64 : 0;
      const sourceCat=companionAppearanceFrames.get(selected.physicalIndex)?.mouthState==="cat";
      if (!native && authoredState === "spiral") { hide(); return false; }
      const sourceClosure = native ? 0 : authoredState ? ["closed", "sad-closed", "squeeze", "cry"].includes(authoredState) ? 1 : 0 : sourceEyeStates.get(selected.physicalIndex);
      if (sourceClosure === undefined) { hide(); return false; }
      const face = native ? { ...sampleCompanionExpression("melt", .5), weight: 1, left: 1, right: 1, leftShape: E.round as number, rightShape: E.round as number, leftClosure: 0, rightClosure: 0, mouth: (sourceCat?M.cat:M.smile) as number, smile: native === "sad-closed" || native === "cry" ? -.4 : .35, open: !sourceCat && !["closed", "sad-closed"].includes(native) && pose.mouth && pose.mouth.bounds[3] - pose.mouth.bounds[1] > 2 ? .45 : 0 } : { ...sampleCompanionExpression(expression?.id ?? "awake", expression?.progress ?? 0) };
      if (native) {
        const closed = ["closed", "sad-closed"].includes(native), squeeze = ["squeeze", "cry", "sad-closed"].includes(native);
        if (closed || squeeze || native === "wink-orange") { face.leftShape = squeeze ? E.squeeze : E.smile; face.leftClosure = 1; }
        if (closed || squeeze || native === "wink-yellow") { face.rightShape = squeeze ? E.squeeze : E.smile; face.rightClosure = 1; }
        if (native === "spiral") { face.left = face.right = 0; }
        if (sleeping) { face.leftShape = face.rightShape = E.squeeze; face.leftClosure = face.rightClosure = 1; face.mouth = M.smile; face.open = 0; face.smile = .24; }
        if (mouthOnly) { face.mouthRound = sleepMouth; face.open = .18 * sleepMouth; face.smile = .24 * (1 - sleepMouth); }
        if (native === "cry") { face.mouth = M.pout; face.open = 0; face.smile = -.4; }
      }
      // Row9 is the authored petting smile, including static wardrobe/meadow
      // previews. Morph its arch continuously into/out of the live melt face.
      // Other smiles keep their gentle curve; squeeze/cry retain their own lid.
      const pettingArch = native ? Number(pose.source === 9) : mix(Number(pose.source === 9), Number(expression?.id === "melt"), face.weight);
      const layout = companionFaceLayout(pose);
      if (face.weight < .005 && !blinkOnly) { hide(); return false; }
      const key = `${selected.src}:${selected.index}`, draw = blinkOnly ? `${key}:blink:${Math.round(blink * 64)}` : `${key}:${native ?? expression!.id}:${mouthOnly ? sleepMouth : native ? 0 : Math.floor(expression!.progress * 240)}`;
      if (draw === lastDraw && !canvas.hidden) return true;
      const cell = image.naturalWidth / selected.grid, ox = selected.index % selected.grid * cell, oy = Math.floor(selected.index / selected.grid) * cell;
      if (key !== lastCell) { pixels.clearRect(0, 0, PIXELS, PIXELS); pixels.drawImage(image, ox, oy, cell, cell, 0, 0, PIXELS, PIXELS); original = pixels.getImageData(0, 0, PIXELS, PIXELS); lastCell = key; }
      if (!original) { hide(); return false; }
      allowed.fill(0); pixels.putImageData(original, 0, 0); ctx.putImageData(original, 0, 0); ctx.save(); ctx.scale(SCALE, SCALE);
      // Clear every valid face patch before drawing any feature. Clearing
      // a large authored mouth after the eyes used to erase the new eyelids.
      const eyePatches = (mouthOnly ? [] : pose.eyes).map((eye, i) => {
        const original = reference.eyes[i];
        const sharedWidth = Math.max(...reference.eyes.map(eye => eye.bounds[2] - eye.bounds[0]));
        const sharedHeight = Math.max(...reference.eyes.map(eye => eye.bounds[3] - eye.bounds[1]));
        const view = pose.orientation === "quarter" ? (original.bounds[2] - original.bounds[0]) / sharedWidth : 1;
        const width = native === "spiral" ? eye.bounds[2] - eye.bounds[0] : sharedWidth * view, height = native === "spiral" ? eye.bounds[3] - eye.bounds[1] : sharedHeight;
        const maskWidth = Math.max(original.bounds[2] - original.bounds[0], sharedWidth) * view, maskHeight = sharedHeight;
        const [x, y] = eye.center;
        const fringe = native ? 1.4 : .65;
        let box = [Math.min(eye.bounds[0], x - maskWidth / 2 - 1) - fringe, Math.min(eye.bounds[1], y - maskHeight / 2 - 1.6) - fringe, Math.max(eye.bounds[2], x + maskWidth / 2 + 1) + fringe, Math.max(eye.bounds[3], y + maskHeight / 2 + 1.2) + fringe];
        // The baked eyelid can be larger than its historical landmark. On a
        // canonical cell use its opaque cream ring too, just as during baking;
        // otherwise an orange corner rejects the primary patch and the tiny
        // historical fallback leaves the new arch behind the moving pupil.
        let fill = background(box, 1, eye.skinSamples, Boolean(native || authoredState));
        // Drooping ears keep their original contour and colour.
        if (!fill) { box = [eye.bounds[0] - .4, eye.bounds[1] - .4, eye.bounds[2] + .4, eye.bounds[3] + .4]; fill = background(box, 1, undefined, Boolean(native || authoredState)); }
        return { original, width, height, x, y, box, fill };
      });
      // A paired expression is admitted atomically. A folded ear/transparent
      // margin can reject just one patch; painting its partner alone creates
      // an unintended wink and can flicker as the authored cell changes.
      if (!mouthOnly && (eyePatches.length !== 2 || eyePatches.some(patch => !patch.fill))) {
        ctx.restore(); hide(); return false;
      }
      const m = blinkOnly ? null : pose.mouth;
      const sourceMouthX = m ? authoredState && !native ? layout.mouthX : m.x : 0;
      const sourceMouthY = m ? authoredState && !native ? layout.mouthY : m.y : 0;
      const targetMouthX = m ? native ? layout.mouthX : sourceMouthX + Math.max(-.6, Math.min(.6, layout.mouthX - sourceMouthX)) : 0;
      const targetMouthY = m ? native ? layout.mouthY : sourceMouthY + Math.max(-.9, Math.min(.9, layout.mouthY - sourceMouthY)) : 0;
      const mouthX = mix(sourceMouthX, targetMouthX, face.weight), mouthY = mix(sourceMouthY, targetMouthY, face.weight);
      // One fixed opaque admission corridor covers the native and target
      // mouth throughout the finite morph. It is independently reproducible
      // from the public pose, without requiring a hidden animation phase.
      const mouthFringe = native || pose.source === 9 ? 2 : .5;
      const mouthBox = m ? mouthOnly ? [targetMouthX - 3.4, targetMouthY - 2, targetMouthX + 3.4, targetMouthY + 3.6]
        : [Math.min(m.bounds[0] - mouthFringe, sourceMouthX - 3.4, targetMouthX - 3.4), Math.min(m.bounds[1] - mouthFringe, sourceMouthY - 2, targetMouthY - 2), Math.max(m.bounds[2] + mouthFringe, sourceMouthX + 3.4, targetMouthX + 3.4), Math.max(m.bounds[3] + mouthFringe, sourceMouthY + 3.6, targetMouthY + 3.6)] : undefined;
      const mouthFill = mouthBox ? background(mouthBox, 2, undefined, Boolean(native || authoredState)) : undefined;
      if (mouthOnly && !mouthFill) { ctx.restore(); hide(); return false; }
      // Repair the union once. Separate patches restored pixels from the
      // uncleaned source at overlaps: a mouth rectangle could bring back a
      // clipped fragment of the eyelid that the eye repair had just removed.
      // Final admission below still limits writes to each validated patch.
      const patches = [...eyePatches, ...(mouthBox && mouthFill ? [{ box: mouthBox, fill: mouthFill }] : [])];
      const left = Math.round(Math.min(...patches.map(p => p.box[0])) * SCALE), top = Math.round(Math.min(...patches.map(p => p.box[1])) * SCALE);
      const right = Math.round(Math.max(...patches.map(p => p.box[2])) * SCALE), bottom = Math.round(Math.max(...patches.map(p => p.box[3])) * SCALE);
      const fallback = (mouthOnly ? mouthFill! : eyePatches[0].fill!).match(/\d+/g)!.map(Number);
      const data = companionFaceBackground(original.data, PIXELS, [left, top, right, bottom], fallback);
      ctx.putImageData(new ImageData(data, right - left + 1, bottom - top + 1), left, top);
      ink.clearRect(0, 0, PIXELS, PIXELS); ink.save(); ink.scale(SCALE, SCALE);
      let painted = mouthOnly ? 1 : 0;
      for (let i = 0; i < eyePatches.length; i++) {
        const { original, width, height, x, y, fill } = eyePatches[i]; if (!fill) continue;
        // The original dizzy rings are restored atomically after mouth repair.
        if (native === "spiral") { painted++; continue; }
        const gazeX = Math.max(-width * .28, Math.min(width * .28, face.gazeX * .9)) * face.weight;
        const gazeY = Math.max(-height * .25, Math.min(height * .25, face.gazeY * .8)) * face.weight;
        // A smiling source pose starts closed. Morph that lid into the target
        // instead of crossfading the old smile bitmap behind a new pupil.
        const nativeClosure = !native && authoredState === (i === 0 ? "wink-orange" : "wink-yellow") ? 1 : sourceClosure;
        const closure = blinkOnly ? blink : mix(nativeClosure, i === 0 ? face.leftClosure : face.rightClosure, face.weight);
        const open = mix(1, i === 0 ? face.left : face.right, face.weight) * (1 - closure), referenceCell = eyeImage.naturalWidth / 8;
        const shape = i === 0 ? face.leftShape : face.rightShape, side = i === 0 ? 1 : -1;
        ink.save(); ink.translate(x, y); ink.rotate(layout.angle);
        ink.strokeStyle = "#704626"; ink.lineCap = "round"; ink.lineJoin = "round";
        if (open > .015) {
          ink.save(); ink.beginPath();
          // A nearly closed pupil used to survive as a flat one-pixel bar
          // through the curved lid at recovery. Fade that last sliver smoothly.
          const aperture = Math.max(0, Math.min(1, (open - .015) / .145));
          ink.globalAlpha = aperture * aperture * (3 - 2 * aperture);
          // Preserve the pupil's width and texture. Eyelids move over it;
          // neither the eye bitmap nor the accessory is vertically scaled.
          const padX = .3 * width / (original.bounds[2] - original.bounds[0]), padY = .65 * height / (original.bounds[3] - original.bounds[1]);
          const top = -height / 2 - padY + (height + padY * 2) * (1 - open) * mix(.8, .5, closure);
          const bottom = height / 2 + padY - (height + padY * 2) * (1 - open) * mix(.2, .5, closure);
          const contour = face.weight * (1 - closure);
          // Centre the mirrored slope: changing only one endpoint also moved
          // the two eyelid midpoints in opposite vertical directions.
          const startSlope = shape === E.focus ? -side * height * .065 * contour : shape === E.worry ? side * height * .04 * contour : 0;
          ink.moveTo(-width / 2 - .3 + gazeX, top + gazeY + startSlope);
          if (shape === E.focus) ink.lineTo(width / 2 + .3 + gazeX, top + gazeY - startSlope);
          else if (shape === E.worry) ink.quadraticCurveTo(gazeX, top + gazeY + height * .12 * contour, width / 2 + .3 + gazeX, top + gazeY - startSlope);
          else ink.lineTo(width / 2 + .3 + gazeX, top + gazeY);
          ink.lineTo(width / 2 + .3 + gazeX, bottom + gazeY);
          if (shape === E.soft) ink.quadraticCurveTo(gazeX, bottom + gazeY - height * .1 * contour, -width / 2 - .3 + gazeX, bottom + gazeY);
          else ink.lineTo(-width / 2 - .3 + gazeX, bottom + gazeY);
          ink.closePath(); ink.clip();
          // The measured brown component excludes its antialiased fringe.
          // Include that fringe so a round source eye is not cropped flat.
          if (blinkOnly) {
            // Read this same already-canonical cell, never another cell's skin
            // or the image-wide reference glyph cache. Keep running304 size.
            ink.drawImage(image, ox + (x - width / 2 - .3) * cell / 80, oy + (y - height / 2 - .65) * cell / 80,
              (width + .6) * cell / 80, (height + 1.3) * cell / 80,
              -width / 2 - .3 + gazeX, -height / 2 - .65 + gazeY, width + .6, height + 1.3);
          } else {
          const glyph=companionEyeGlyph(eyeImage,reference.eyes,i,8,reference.index);
          ink.drawImage(glyph.canvas, (original.bounds[0] - .3) / 80 * referenceCell-glyph.x, (original.bounds[1] - .65) / 80 * referenceCell-glyph.y, (original.bounds[2] - original.bounds[0] + .6) / 80 * referenceCell, (original.bounds[3] - original.bounds[1] + 1.3) / 80 * referenceCell, -width / 2 - padX + gazeX, -height / 2 - padY + gazeY, width + padX * 2, height + padY * 2);
          }
          if (face.shine > 0) { ink.fillStyle = `rgba(255,253,235,${face.shine * face.weight * .9})`; ink.beginPath(); ink.ellipse(-width * .12 + gazeX, -height * .17 + gazeY, width * .12, height * .16, -.3, 0, Math.PI * 2); ink.fill(); }
          ink.restore();
        }
        if (closure > .35 && (blinkOnly || shape === E.smile || shape === E.squeeze || nativeClosure)) {
          // Contracted lids use a soft lower arc, distinct from the happy
          // upper arch. No literal chevron or pointed punctuation eye.
          const t = (closure - .35) / .65;
          ink.globalAlpha = t * t * (3 - 2 * t);
          ink.lineWidth = companionEyeStroke(height, native ? pose.source === 9 : expression?.id === "melt"); ink.beginPath();
          const nativeSqueeze = !native && ["squeeze", "cry", "sad-closed"].includes(authoredState ?? "") ? 1 : 0;
          const squeeze = blinkOnly ? .64 : mix(nativeSqueeze, shape === E.squeeze ? 1 : 0, face.weight);
          // Sleeping lids relax into a shallow lower arc. Keep the deeper
          // squeeze/cry and the approved petting arch on their own paths.
          const lidHalfWidth = width * (sleeping ? .46 : .49);
          const lidEnd = sleeping ? height * .01 : mix(height * .08, -height * .14, squeeze);
          ink.moveTo(-lidHalfWidth, lidEnd);
          ink.quadraticCurveTo(0, sleeping ? height * .16 : mix(-height * mix(.36, policy.eye.pettingArchControl, pettingArch), height * .5, squeeze), lidHalfWidth, lidEnd);
          ink.stroke(); ink.globalAlpha = 1;
        }
        if (face.brow) { ink.globalAlpha = face.weight; ink.lineWidth = .65; const lift = Math.abs(face.brow), by = -height / 2 - .8; ink.beginPath(); ink.moveTo(-width * .38, by + side * face.brow * .7); ink.quadraticCurveTo(0, by - lift * .75, width * .38, by - side * face.brow * .7); ink.stroke(); ink.globalAlpha = 1; }
        if (native === "cry") {
          // Join the native droplets to the outer lower lid with one soft
          // continuous trail; the old repair used to leave isolated blue bits.
          const tx = -side * width * .48, ty = -height * .1;
          ink.fillStyle = "#45bbea"; ink.beginPath(); ink.moveTo(tx - .35, ty);
          ink.bezierCurveTo(tx - .4, ty + 3, tx - 2, ty + 5.2, tx - 1.5, ty + 7.6);
          ink.bezierCurveTo(tx - 1, ty + 9.2, tx + 1.3, ty + 9.2, tx + 1.6, ty + 7.6);
          ink.bezierCurveTo(tx + 1.8, ty + 5.3, tx + .4, ty + 3, tx + .35, ty);
          ink.closePath(); ink.fill();
        } else if (face.tears > 0) { ink.fillStyle = `rgba(117,175,204,${face.tears * face.weight * .9})`; ink.beginPath(); ink.ellipse(width * .28 * side, height * .55, .55, 1, 0, 0, Math.PI * 2); ink.fill(); }
        ink.restore();
        painted++;
      }
      if (m && mouthFill) {
          ink.save(); ink.translate(mouthX, mouthY); ink.rotate(layout.angle);
          ink.strokeStyle = "#765030"; ink.fillStyle = "#7c5238"; ink.lineWidth = .8; ink.lineCap = "round"; ink.lineJoin = "round";
          const measuredHeight = m.bounds[3] - m.bounds[1];
          const nativeOpen = !sourceCat && (authoredState && !native ? !["closed", "sad-closed"].includes(authoredState) && measuredHeight > 2 : measuredHeight > 2);
          const nativeHeight = authoredState && !native ? nativeOpen ? 2.8 : .8 : measuredHeight;
          const canonicalSource = Boolean(authoredState && !native), sourceOpening = canonicalSource ? nativeOpen ? .45 : 0 : nativeOpen ? .85 : 0;
          const sourceSmile = ["sad-closed", "cry"].includes(authoredState ?? "") ? -.4 : .35;
          const opening = mix(sourceOpening, face.open, face.weight);
          // Chattering moves a level mouth along the face normal. Opposite
          // offsets at its corners made a tilted mouth instead of a shiver.
          const tremble = Math.sin((expression?.progress ?? .5) * Math.PI * 18) * face.tremble * face.weight * .4;
          const round = face.mouth === M.round ? 1 : face.mouthRound;
          const targetWidth = mix(face.mouth === M.line || face.mouth === M.inhale ? 1.9 : 2.6, face.mouth === M.inhale ? .65 + face.open * .2 : .8 + face.open * .65, round);
          const width = mix(canonicalSource && !sourceCat ? 2.6 : (m.bounds[2] - m.bounds[0]) / 2, native && sourceCat ? (m.bounds[2] - m.bounds[0]) / 2 : targetWidth, face.weight);
          const targetSmile = face.mouth === M.line || face.mouth === M.round || face.mouth === M.inhale ? 0 : face.mouth === M.pout ? face.smile - .2 : face.smile;
          const curve = targetSmile * 1.8;
          const roundHeight = .7 + face.open * (face.mouth === M.inhale ? 4 : 2.5);
          const nativeEdge = nativeOpen ? -nativeHeight / 2 : 0;
          const edge = mix(canonicalSource ? 0 : nativeEdge, 0, face.weight);
          const topCurve = mix(canonicalSource ? sourceSmile * 1.8 - sourceOpening * .5 : nativeOpen ? nativeEdge + nativeHeight * .1 : .45, mix(curve - face.open * .5, -roundHeight, round), face.weight);
          const bottomCurve = mix(canonicalSource ? sourceSmile * 1.8 + sourceOpening * 5 : nativeOpen ? nativeEdge + nativeHeight * 2 : .45, mix(curve + face.open * 5, roundHeight, round), face.weight);
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
            const sourceColour = canonicalSource ? [124, 82, 56] : count ? colour.map(n => n / count) : [213, 151, 121];
            ink.fillStyle = `rgb(${sourceColour.map((n, i) => Math.round(mix(n, [124, 82, 56][i], face.weight))).join(",")})`;
          }
          // One deforming contour owns both the native mouth and the target.
          // No second source mouth survives underneath at entry or recovery.
          ink.beginPath(); ink.moveTo(-width, edge + tremble);
          if (face.mouth === M.wave) {
            const mid = mix((edge + topCurve) / 2, edge, face.weight), amplitude = 1.35 * face.weight;
            ink.quadraticCurveTo(-width / 2, mid - amplitude, 0, mid);
            ink.quadraticCurveTo(width / 2, mid + amplitude, width, edge + tremble);
          } else {
            // The original sideways-3/omega mouth is two rounded lobes.
            // Morph one contour; never crossfade two independent mouth lines.
            const cat=mix(sourceCat?1:0,face.mouth===M.cat?1:0,face.weight);
            const middle=mix((edge+topCurve)/2,edge-.1,cat)+tremble;
            const control=mix((edge+topCurve)/2,edge+Math.min(.9,width*.38)*2,cat)+tremble;
            ink.quadraticCurveTo(-width/2,control,0,middle);
            ink.quadraticCurveTo(width/2,control,width,edge+tremble);
          }
          const depth = Math.max(0, bottomCurve - topCurve);
          if (depth > 0) {
            // Preserve main's continuous low-intensity mouth floor while the
            // baked canonical source and omega keep one contour.
            const nativeBlend = nativeOpen && !canonicalSource ? 1 - face.weight : 0;
            const bottom = (edge + bottomCurve) / 2;
            const sideY = mix((edge * 2 + bottomCurve) / 3, nativeEdge + nativeHeight * .7, nativeBlend);
            const floorY = mix(bottom, nativeEdge + nativeHeight, nativeBlend);
            const sideX = mix(width * 2 / 3, width, nativeBlend), floorX = mix(width / 3, width * .65, nativeBlend);
            ink.bezierCurveTo(sideX, sideY + tremble, floorX, floorY + tremble, 0, floorY + tremble);
            ink.bezierCurveTo(-floorX, floorY + tremble, -sideX, sideY + tremble, -width, edge + tremble);
            ink.fill();
          }
          ink.stroke();
          const tongue = mix(nativeOpen ? .8 : 0, face.mouth === M.grin ? face.open : 0, face.weight);
          if (face.mouth === M.tongue && face.weight > .01) {
            ink.globalAlpha = face.weight; ink.fillStyle = "#d59779"; ink.strokeStyle = "#9b6450"; ink.lineWidth = .4;
            const root = Math.max(.2, bottomCurve * .22), tip = root + 1.25 + face.open * .45;
            ink.beginPath(); ink.moveTo(-width * .6, root); ink.lineTo(width * .6, root);
            ink.bezierCurveTo(width * .6, tip, -width * .6, tip, -width * .6, root);
            ink.fill(); ink.stroke(); ink.globalAlpha = 1;
          } else if (tongue > 0 && opening > 0) {
            ink.globalAlpha = Math.min(1, opening / .03);
            ink.fillStyle = "#d59779"; ink.beginPath(); ink.ellipse(0, Math.max(0, bottomCurve * .28), width * .45, tongue * .55, 0, 0, Math.PI * 2); ink.fill(); ink.globalAlpha = 1;
          }
          ink.restore();
      }
      ink.restore();
      ctx.restore();
      if (!painted) { hide(); return false; }
      // The source is intentionally alpha253 in many opaque-looking regions.
      // A source-over face would increase its opacity. Replace the current
      // sprite plane instead, conserving every alpha byte. Restore the cheek
      // background first, then put the real facial ink ABOVE it. No body
      // geometry or immutable source file is rewritten.
      const final = ctx.getImageData(0, 0, PIXELS, PIXELS);
      const admission = blinkOnly ? Math.min(1, blink / .38) : authoredState && !native ? 1 : Math.min(1, face.weight / .28), sourceBlend = admission * admission * (3 - 2 * admission);
      for (let i = 0; i < final.data.length; i += 4) {
        // Orange square cheeks can intersect the eye patch. A source's red
        // laughing mouth/tongue is also orange by RGB, but belongs to the
        // separately bounded mouth patch and must not survive a new face.
        const x = i / 4 % PIXELS / SCALE, y = Math.floor(i / 4 / PIXELS) / SCALE;
        const sourceMouth = m && allowed[i / 4] === 2 && (authoredState && !native
          ? x >= sourceMouthX - 3.4 && x <= sourceMouthX + 3.4 && y >= sourceMouthY - 2 && y <= sourceMouthY + 3.6
          : x >= Math.min(m.bounds[0] - .6, layout.x - 3.4) && x <= Math.max(m.bounds[2] + .6, layout.x + 3.4) && y >= Math.min(m.bounds[1] - .6, layout.y - .5) && y <= m.bounds[3] + 1.2);
        const blinkMouth = blinkOnly && pose.mouth && x >= layout.mouthX - 3.4 && x <= layout.mouthX + 3.4 && y >= layout.mouthY - 2 && y <= layout.mouthY + 3.6;
        const keep = blinkMouth || !allowed[i / 4] || !sourceMouth && original.data[i] > 210 && original.data[i + 1] < 190 && original.data[i + 2] < 135;
        for (let k = 0; k < 3; k++) final.data[i + k] = keep ? original.data[i + k] : Math.round(mix(original.data[i + k], final.data[i + k], sourceBlend));
        final.data[i + 3] = original.data[i + 3];
      }
      if (native === "cry") restoreCompanionTearInk(final.data, original.data);
      compositeCompanionFaceInk(final.data, original.data, ink.getImageData(0, 0, PIXELS, PIXELS).data, sourceBlend);
      // The owner approved these baked eyes. Even overlapping repair corridors
      // must leave every non-mouth byte exactly as it was in that source.
      if (mouthOnly) for (let i = 0; i < allowed.length; i++) {
        if (allowed[i] !== 2) final.data.set(original.data.subarray(i * 4, i * 4 + 4), i * 4);
      }
      if (native === "spiral") restoreCompanionSpiralEyes(final.data, original.data, selected.physicalIndex);
      ctx.putImageData(final, 0, 0);
      canvas.style.transform = `translate3d(${selected.frame.x / 80 * 100}%,${selected.frame.y / 80 * 100}%,0)`;
      canvas.style.clipPath = `inset(${selected.frame.clip.map(n => `${n / 80 * 100}%`).join(" ")})`;
      canvas.hidden = false; lastDraw = draw; return true;
    },
  };
}
