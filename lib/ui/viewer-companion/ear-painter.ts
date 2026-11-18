import edition from "./appearance-edition.json";
import { companionAppearanceEyes, companionAppearanceFrames } from "./appearance";
import expressionAnchors from "./expression-anchors-161.json";
import expressionOverrides from "./expression-pose-overrides.json";
import { peekDecodedCompanionSprite, type CompanionSpriteSelection } from "./sprite-quality";
import type { CompanionAccessoryArtFrame } from "./accessory-art";
import { warpCompanionPompom } from "./pompom";
type Placement = { art: CompanionAccessoryArtFrame; x: number; y: number; width: number; rotation: number; mirror?: number; stretchY?: number; rotor?: number; rearArt?: CompanionAccessoryArtFrame };
type Anchor = { x: number; y: number; width: number; roll: number };
const faceAnchors = new Map([...expressionAnchors.frames, ...expressionOverrides.frames].map(frame => [frame.physicalIndex, frame]));
export function companionPompomProtectedY(index: number) {
  const frame = companionAppearanceFrames.get(index);
  if (!frame) return 192;
  const eyes = companionAppearanceEyes(index, faceAnchors.get(index)?.eyes ?? []);
  const lowerFace = frame.mouth?.y ?? (frame.parts[0].top + frame.parts[0].source.height * .7) / 2.4;
  return Math.ceil(Math.max(lowerFace + 5, ...eyes.map(eye => eye.bounds[3] + 4)) * 2.4);
}

/** Four anatomical ear slots, body, face and worn hat are assembled at native
 * resolution and downsampled once. Independent CSS layers create AA cracks. */
export function createCompanionEarPainter(host: HTMLElement) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 384;
  canvas.className = "vc-character-composite"; canvas.dataset.earSlots = "orange-root orange-tip yellow-root yellow-tip";
  host.replaceChildren(canvas);
  const ctx = canvas.getContext("2d"), body = document.createElement("canvas"); body.width = body.height = 192;
  const bodyCtx = body.getContext("2d", { willReadFrequently: true });
  let last = "", bodyKey = "", bodyMask: Uint8Array | undefined, bodyPixels: ImageData | undefined, bodyBottom = 0;
  const hide = () => { host.hidden = true; host.parentElement?.removeAttribute("data-layered"); host.parentElement?.removeAttribute("data-pompom-only"); last = ""; };
  const drawArt = (image: HTMLImageElement, art: CompanionAccessoryArtFrame, point: Anchor, placement: Placement, pivot?: { x: number; y: number }) => {
    if (!ctx) return;
    const scale = point.width / art.content.width, cx = pivot?.x ?? art.content.x + art.content.width / 2, cy = pivot?.y ?? art.content.y + art.content.height / 2;
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(point.roll * Math.PI / 180); ctx.scale(placement.mirror ?? 1, placement.stretchY ?? 1);
    ctx.drawImage(image, art.x, art.y, art.width, art.height, -cx * scale, -cy * scale, art.width * scale, art.height * scale); ctx.restore();
  };
  return {
    hide,
    paint(selected: CompanionSpriteSelection | undefined, placement: Placement | null, hat: HTMLImageElement | undefined, rear: HTMLImageElement | undefined, rotor: Anchor | null, face?: HTMLCanvasElement, pompom?: number) {
      const frame = selected && companionAppearanceFrames.get(selected.physicalIndex), packet = frame && edition.packets[frame.atlas], image = selected && peekDecodedCompanionSprite(selected.src);
      if (!ctx || !bodyCtx || !selected || !frame || !packet || packet.src !== selected.src || frame.index !== selected.index || !image || placement && !hat || !placement && pompom === undefined) { hide(); return false; }
      host.hidden = false; host.parentElement?.setAttribute("data-layered", "true");
      host.parentElement?.toggleAttribute("data-pompom-only", !placement);
      canvas.toggleAttribute("data-body-only", !placement);
      const key = `${selected.src}:${selected.index}:${placement?.art.src}:${placement?.art.index}:${placement?.mirror ?? 1}:${placement?.stretchY ?? 1}:${placement?.x}:${placement?.y}:${placement?.width}:${placement?.rotation}:${placement?.rotor ?? 0}:${Boolean(face)}:${pompom ?? 0}`;
      if (!face && key === last) return true;
      ctx.clearRect(0, 0, 384, 384); ctx.save(); ctx.translate(96, 96); ctx.scale(2.4, 2.4);
      if (placement?.rearArt && rear && rotor) drawArt(rear, placement.rearArt, { ...rotor, roll: rotor.roll + (placement.rotor ?? 0) }, placement, { x: placement.art.content.x + placement.art.content.width / 2, y: 22 });
      const drawPart = (owner: number) => {
        const part = frame.parts[owner]; if (!part.visible) return;
        const source = part.source;
        ctx.drawImage(image, source.x, source.y, source.width, source.height, part.left / 2.4, part.top / 2.4, source.width / 2.4, source.height / 2.4);
      };
      for (let owner = 1; owner <= 4; owner++) if (!(owner % 2 === 0 && frame.folded[Math.floor((owner - 1) / 2)])) drawPart(owner);
      if (face || pompom) {
        const cellKey = `${selected.src}:${selected.index}`;
        if (bodyKey !== cellKey) {
          const part = frame.parts[0], source = part.source;
          bodyCtx.clearRect(0, 0, 192, 192); bodyCtx.drawImage(image, source.x, source.y, source.width, source.height, part.left, part.top, source.width, source.height);
          bodyPixels = bodyCtx.getImageData(0, 0, 192, 192); const pixels = bodyPixels.data; bodyMask = new Uint8Array(192 * 192); bodyBottom = 0;
          for (let i = 0; i < bodyMask.length; i++) { bodyMask[i] = pixels[i * 4 + 3]; if (bodyMask[i]) bodyBottom = Math.floor(i / 192) + 1; } bodyKey = cellKey;
        }
        const pixels = face ? face.getContext("2d")!.getImageData(0, 0, 192, 192) : new ImageData(new Uint8ClampedArray(bodyPixels!.data), 192, 192);
        if (face) for (let i = 0; i < bodyMask!.length; i++) pixels.data[i * 4 + 3] = bodyMask![i];
        if (pompom) pixels.data.set(warpCompanionPompom(pixels.data, 192, 192, companionPompomProtectedY(selected.physicalIndex), bodyBottom, frame.material.pivot.x * 2.4, pompom));
        bodyCtx.putImageData(pixels, 0, 0); ctx.drawImage(body, 0, 0, 80, 80);
      } else drawPart(0);
      if (placement && hat) drawArt(hat, placement.art, { x: placement.x, y: placement.y, width: placement.width, roll: placement.rotation }, placement);
      for (let owner = 2; owner <= 4; owner += 2) if (frame.folded[Math.floor((owner - 1) / 2)]) drawPart(owner);
      ctx.restore(); canvas.style.transform = `translate(${selected.frame.x / 160 * 100}%,${selected.frame.y / 160 * 100}%)`;
      canvas.dataset.pose = String(selected.physicalIndex); last = key; return true;
    },
  };
}
