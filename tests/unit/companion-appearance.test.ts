import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import edition from "@/lib/ui/viewer-companion/appearance-edition.json";
import nativeParts from "@/scripts/companion-consistency/native-parts.json";
import policy from "@/lib/ui/viewer-companion/appearance-policy.json";
import expressionOverrides from "@/lib/ui/viewer-companion/expression-pose-overrides.json";
import base from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import living from "@/lib/ui/viewer-companion/living-motion-sprite.json";
import { companionAppearanceBounds, companionAppearanceEyes, companionAppearanceFrame, companionAppearanceFrames, companionAppearanceGridRows, companionAppearanceLandmark, companionAppearancePoint, companionAppearanceSource, resolveCompanionAppearanceSource } from "@/lib/ui/viewer-companion/appearance";
import { companionEyeScale143Source } from "@/lib/ui/viewer-companion/eye-scale-143";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const predecessors = [...base.atlases, ...play.atlases, ...living.atlases];
const registeredFrames = [...base.frames,
  ...play.frames.map(frame => ({ ...frame, atlas: frame.atlas + base.atlases.length })),
  ...living.frames.map(frame => ({ ...frame, atlas: frame.atlas + base.atlases.length + play.atlases.length }))];
const receipt = JSON.parse(readFileSync("art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json", "utf8")) as {
  slots: { nativeCell: number; source: string; sourceSha256: string; rig?: object; body: { left: number; right: number; bottom: number } }[];
};
const measuredEars = nativeParts.ears as Record<string, (number[] | null)[]>;
const measuredEyes = nativeParts.eyes as Record<string, string>;
const measuredFolds = nativeParts.folded as Record<string, boolean[]>;
const eyeExceptions = new Set([...Array.from({ length: 16 }, (_, index) => 144 + index), 266]);
const SIZE = 192;

// Read-only independent measurement. The existing frozen-pose samplers locate
// native labels; this does not call material-source's normalization function
// or trust its stored measuredArea. Alpha is read from actual encoded output.
const encodedBodyMeasurement = String.raw`
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { extractKeys } from './scripts/prepare-companion-motion-115.mjs';
import { bakeEyeStyleKey, prepareFamilyKey } from './scripts/prepare-companion-eye-style.mjs';
const receipt=JSON.parse(await fs.readFile('art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json'));
const specs=JSON.parse(await fs.readFile('scripts/companion-consistency/native-parts.json'));
const edition=JSON.parse(await fs.readFile('lib/ui/viewer-companion/appearance-edition.json'));
const {keys}=await extractKeys(await fs.readFile(receipt.slots[0].source)), size=192, count=size*size;
const masks=keys.map((key,id)=>{
  const seen=new Uint8Array(key.width*key.height); let largest=[];
  for(let i=0;i<seen.length;i++)if(!seen[i]&&key.rgba[i*4+3]>=64){
    const component=[i];seen[i]=1;
    for(let q=0;q<component.length;q++){
      const x=component[q]%key.width,y=Math.floor(component[q]/key.width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const xx=x+dx,yy=y+dy,j=yy*key.width+xx;
        if(xx>=0&&yy>=0&&xx<key.width&&yy<key.height&&!seen[j]&&key.rgba[j*4+3]>=64){seen[j]=1;component.push(j);}
      }
    }
    if(component.length>largest.length)largest=component;
  }
  const main=new Uint8Array(seen.length),ear=new Uint8Array(seen.length);
  for(const i of largest)main[i]=1;
  const ears=specs.ears[id]??[];
  for(let y=0;y<key.height;y++)for(let x=0;x<key.width;x++){
    const px=(x+.5)/key.width*100,py=(y+.5)/key.height*100;
    for(const part of ears){if(!part)continue;const [rx,ry,tx,ty,width]=part,dx=tx-rx,dy=ty-ry;
      const t=((px-rx)*dx+(py-ry)*dy)/(dx*dx+dy*dy);if(t<-.06||t>1.36)continue;
      const along=Math.max(0,Math.min(1,t));
      const radius=width*(t<.18?.5+Math.max(0,t)*2.5:t>1?Math.sqrt(Math.max(0,1-((t-1)/.36)**2)):1);
      if(Math.hypot(px-rx-dx*along,py-ry-dy*along)<=radius)ear[y*key.width+x]=1;
    }
  }
  return {main,ear};
});
const results=[];
for(let atlas=0;atlas<edition.packets.length;atlas++){
  const packet=edition.packets[atlas];
  const [source,encoded]=await Promise.all([sharp(await fs.readFile('public'+packet.parentSrc)).ensureAlpha().raw().toBuffer(),sharp(await fs.readFile('public'+packet.src)).ensureAlpha().raw().toBuffer()]);
  for(const frame of edition.frames.filter(frame=>frame.atlas===atlas)){
    const slot=receipt.slots[frame.physicalIndex],key=keys[frame.nativeCell],frozen=masks[frame.nativeCell];
    const body=new Uint8Array(count),ear=new Uint8Array(count);
    const sample=(x,y,px,py)=>{
      const ix=Math.max(0,Math.min(key.width-1,Math.round(px))),iy=Math.max(0,Math.min(key.height-1,Math.round(py))),j=iy*key.width+ix;
      body[y*size+x]=frozen.main[j];ear[y*size+x]=frozen.ear[j];
    };
    if(slot.rig)bakeEyeStyleKey(key,slot.rig,slot.fit.scale,slot.fit.offset,sample);else await prepareFamilyKey(key,slot.fit,sample);
    const ox=frame.index%8*size,oy=Math.floor(frame.index/8)*size;
    const {scale,pivot}=frame.material;let sourceArea=0,encodedArea=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*size+x,offset=((oy+y)*1536+ox+x)*4;
      if(body[i]&&!ear[i])sourceArea+=source[offset+3]/255;
      const px=(x+.5-pivot.x*2.4)/scale+pivot.x*2.4-.5,py=(y+.5-pivot.y*2.4)/scale+pivot.y*2.4-.5;
      if(Math.floor(px)<0||Math.floor(py)<0||Math.floor(px)>=size-1||Math.floor(py)>=size-1)continue;
      const nearest=Math.round(py)*size+Math.round(px);
      if(body[nearest]&&!ear[nearest])encodedArea+=encoded[offset+3]/255;
    }
    results.push({physicalIndex:frame.physicalIndex,sourceArea,encodedArea});
  }
}
process.stdout.write(JSON.stringify(results));
`;

describe("20261118 companion appearance edition", () => {
  it("resolves only exact predecessor path/SHA pairs and leaves unknown frozen sources intact", () => {
    expect(edition.version).toBe(3);
    expect(edition.packets).toHaveLength(33);
    expect(new Set(edition.packets.map(packet => packet.src)).size).toBe(33);
    expect(new Set(edition.packets.map(packet => packet.parentSrc)).size).toBe(33);
    for (const packet of edition.packets) {
      const source = Object.freeze({ src: packet.parentSrc, sha256: packet.parentSha256, bytes: 1, width: 1, height: 1, gridRows: 2, marker: "preserve" });
      expect(companionAppearanceSource(source)).toEqual({ ...source, src: packet.src, sha256: packet.sha256, bytes: packet.bytes,
        width: packet.width, height: packet.height, gridRows: packet.gridRows });
      expect(source).toMatchObject({ src: packet.parentSrc, sha256: packet.parentSha256, bytes: 1, width: 1, height: 1 });
      for (const wrong of [Object.freeze({ ...source, src: `${packet.parentSrc}?different` }),
        Object.freeze({ ...source, sha256: "0".repeat(64) }), Object.freeze({ ...source, src: packet.src })]) {
        expect(companionAppearanceSource(wrong)).toBe(wrong);
        expect(resolveCompanionAppearanceSource(wrong)).toBe(wrong);
      }
      expect(companionAppearanceGridRows(packet.src)).toBe(packet.gridRows);
      expect(companionAppearanceGridRows(`${packet.src}?different`)).toBeUndefined();
    }
    for (const source of predecessors) {
      expect(resolveCompanionAppearanceSource(source)).toEqual(companionAppearanceSource(companionEyeScale143Source(source)));
    }
  });

  it("keeps all 520 atlas/index/x/y registrations and 41 playback rows while replacing only measured clips", () => {
    expect(edition.frames).toHaveLength(520);
    expect(companionAppearanceFrames.size).toBe(520);
    expect(companionSpriteMetadata.frames).toEqual(registeredFrames.map((frame, index) => ({ ...frame, clip: companionAppearanceFrames.get(index)!.clip })));
    expect(companionSpriteMetadata.rows).toEqual([...base.rows,
      ...play.rows.map(row => row.map(index => index + base.frames.length)),
      ...living.rows.map(row => row.map(index => index + base.frames.length + play.frames.length))]);
    expect(companionSpriteMetadata.rows).toHaveLength(41);
    expect(edition.frames.map(frame => frame.physicalIndex).sort((a, b) => a - b)).toEqual(Array.from({ length: 520 }, (_, index) => index));
    for (const frame of edition.frames) {
      const original = registeredFrames[frame.physicalIndex], selected = selectCompanionSprite(frame.physicalIndex);
      const packet = edition.packets[frame.atlas];
      expect({ atlas: frame.atlas, index: frame.index, nativeCell: frame.nativeCell }).toEqual({ atlas: original.atlas, index: original.index, nativeCell: receipt.slots[frame.physicalIndex].nativeCell });
      expect(selected.frame).toEqual({ ...original, clip: frame.clip });
      expect(companionAppearanceFrame(frame.physicalIndex, original)).toEqual({ ...original, clip: frame.clip });
      expect(selected).toMatchObject({ physicalIndex: frame.physicalIndex, index: frame.index, src: packet.src, grid: 8, gridRows: packet.gridRows });
    }
  });

  it("uses one same-native uniform area correction and maps every landmark through its unchanged body-foot pivot", () => {
    const sourcesByNative = new Map<number, typeof edition.frames>();
    for (const frame of edition.frames) {
      const group = sourcesByNative.get(frame.nativeCell) ?? [];
      group.push(frame); sourcesByNative.set(frame.nativeCell, group);
    }
    for (const frame of edition.frames) {
      const material = frame.material, slot = receipt.slots[frame.physicalIndex];
      const group = sourcesByNative.get(frame.nativeCell)!;
      const reference = group.find(candidate => !receipt.slots[candidate.physicalIndex].rig) ?? group[0];
      expect(material.reference).toBe(reference.physicalIndex);
      expect(material.targetArea).toBe(reference.material.sourceArea);
      expect(material.sourceArea).toBeGreaterThan(0);
      expect(material.scale).toBeCloseTo(Math.sqrt(material.targetArea / material.sourceArea), 12);
      expect(material.pivot).toEqual({ x: (slot.body.left + slot.body.right) / 2 / 2.4, y: slot.body.bottom / 2.4 });
      const point = Object.freeze({ x: 13.25, y: 51.5, marker: "retained" });
      const affine = (x: number, y: number) => ({ x: material.pivot.x + (x - material.pivot.x) * material.scale,
        y: material.pivot.y + (y - material.pivot.y) * material.scale });
      expect(companionAppearancePoint(frame.physicalIndex, point)).toEqual({ ...point, ...affine(point.x, point.y) });
      expect(companionAppearancePoint(frame.physicalIndex, material.pivot)).toEqual(material.pivot);
      const bounds = [12, 34, 23, 48], a = affine(12, 34), b = affine(23, 48);
      expect(companionAppearanceBounds(frame.physicalIndex, bounds)).toEqual([a.x, a.y, b.x, b.y]);
      const eye = { center: [18, 41], bounds, skinSamples: [[14, 35], [22, 47]], marker: "eye" };
      const center = affine(18, 41), skinA = affine(14, 35), skinB = affine(22, 47);
      expect(companionAppearanceEyes(frame.physicalIndex, [eye])).toEqual([{ ...eye, center: [center.x, center.y],
        bounds: [a.x, a.y, b.x, b.y], skinSamples: [[skinA.x, skinA.y], [skinB.x, skinB.y]] }]);
      expect(companionAppearanceLandmark(frame.physicalIndex, { ...point, width: 7, roll: 18 })).toEqual({ ...point,
        ...affine(point.x, point.y), width: 7 * material.scale, roll: 18 });
      expect(point).toEqual({ x: 13.25, y: 51.5, marker: "retained" });
    }
    const unchanged = Object.freeze({ x: 13, y: 14 });
    expect(companionAppearancePoint(-1, unchanged)).toBe(unchanged);
    expect(companionAppearanceBounds(-1, [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(edition.eyeReference).toEqual({ referencePhysicalIndex: 304, referenceSrc: edition.packets[19].parentSrc,
      referenceSha256: edition.packets[19].parentSha256, pettingStrokeGain: 1.15, pettingArchControl: .76 });
    expect(edition.eyeReference).toEqual(policy.eye);
    expect(policy.material.referenceScope).toBe("same-native-only");
    expect(policy.material.referenceSelection).toBe("first-nonrig-else-first");
    expect(expressionOverrides.frames.map(frame => frame.physicalIndex)).toEqual([323, 324, 325, 331, 332, 333]);
    for (const pose of expressionOverrides.frames) {
      const registered = registeredFrames[pose.physicalIndex];
      expect({ atlas: pose.source, index: pose.index }).toEqual({ atlas: registered.atlas, index: registered.index });
      expect(pose.eyes).toHaveLength(2);
      expect(pose.eyes.every(eye => [...eye.center, ...eye.bounds].every(Number.isFinite))).toBe(true);
      expect([326, 327, 328, 329, 330]).not.toContain(pose.physicalIndex);
    }
  });

  it("keeps four anatomical ear identities, explicit visibility and native eye state across fitted copies", () => {
    expect(nativeParts.earIdentity).toEqual(["orange", "yellow"]);
    const eyeStates = new Map<number, Set<string>>();
    for (const frame of edition.frames) {
      const ears = measuredEars[frame.nativeCell];
      expect(ears, `native ear identity ${frame.nativeCell}`).toHaveLength(2);
      expect(frame.parts.map(part => part.owner)).toEqual([0, 1, 2, 3, 4]);
      expect(frame.parts[0].visible).toBe(true);
      expect(frame.folded).toEqual(measuredFolds[frame.nativeCell] ?? [false, false]);
      for (let side = 0; side < 2; side++) {
        for (const part of frame.parts.slice(1 + side * 2, 3 + side * 2)) {
          expect(part.visible).toBe(part.pixels > 0);
          if (!ears[side]) expect(part.visible).toBe(false); // Occluded ear has no invented attachment.
          if (part.visible) {
            expect(part.source.width).toBe(part.right - part.left + 1);
            expect(part.source.height).toBe(part.bottom - part.top + 1);
          } else {
            expect(part.pixels).toBe(0);
            expect(part.source.width * part.source.height).toBe(0);
          }
        }
      }
      expect(frame.eyeState).toBe(eyeExceptions.has(frame.physicalIndex) ? "closed" : measuredEyes[frame.nativeCell] ?? "open");
      if (!eyeExceptions.has(frame.physicalIndex)) {
        const states = eyeStates.get(frame.nativeCell) ?? new Set<string>();
        states.add(frame.eyeState); eyeStates.set(frame.nativeCell, states);
      }
    }
    for (const states of eyeStates.values()) expect(states.size).toBe(1);
  });

  it("checks actual packet/predecessor SHA, byte lengths, dimensions and frozen native provenance", async () => {
    for (const packet of edition.packets) {
      const bytes = readFileSync(`public${packet.src}`), parent = readFileSync(`public${packet.parentSrc}`);
      expect(hash(bytes), packet.src).toBe(packet.sha256);
      expect(bytes.length, packet.src).toBe(packet.bytes);
      expect(hash(parent), packet.parentSrc).toBe(packet.parentSha256);
      const [output, input] = await Promise.all([sharp(bytes).metadata(), sharp(parent).metadata()]);
      expect({ width: output.width, height: output.height }).toEqual({ width: packet.width, height: packet.height });
      expect({ width: input.width, height: input.height }).toEqual({ width: 1536, height: 384 });
      expect(packet.width).toBe(SIZE * 8);
      expect(packet.height).toBe(SIZE * packet.gridRows);
      expect(packet.gridRows).toBeGreaterThan(2);
    }
    const frozen = receipt.slots[0];
    expect(hash(readFileSync(frozen.source))).toBe(frozen.sourceSha256);
  }, 30_000);

  it("independently measures encoded body alpha against frozen native component/ear labels and bounds same-native residual variation", () => {
    const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", encodedBodyMeasurement], {
      cwd: process.cwd(), encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
    })) as { physicalIndex: number; sourceArea: number; encodedArea: number }[];
    expect(result).toHaveLength(520);
    const groups = new Map<number, { source: number[]; encoded: number[] }>();
    for (const measured of result) {
      const frame = companionAppearanceFrames.get(measured.physicalIndex)!;
      expect(measured.sourceArea, `frozen source body ${measured.physicalIndex}`).toBeCloseTo(frame.material.sourceArea, 6);
      expect(measured.encodedArea, `actual encoded body ${measured.physicalIndex}`).toBeCloseTo(frame.material.measuredArea, 6);
      expect(Math.abs(measured.encodedArea / frame.material.targetArea - 1), `native target raster error ${measured.physicalIndex}`).toBeLessThanOrEqual(policy.material.maxRasterAreaError);
      const group = groups.get(frame.nativeCell) ?? { source: [], encoded: [] };
      group.source.push(measured.sourceArea); group.encoded.push(measured.encodedArea); groups.set(frame.nativeCell, group);
    }
    for (const [native, group] of groups) {
      const sourceRatio = Math.max(...group.source) / Math.min(...group.source);
      const encodedRatio = Math.max(...group.encoded) / Math.min(...group.encoded);
      expect(encodedRatio, `native ${native} actual body area max/min`).toBeLessThan(1.015);
      if (sourceRatio > 1.02) expect(encodedRatio, `native ${native} correction reduces fitted-copy pumping`).toBeLessThan(sourceRatio);
    }
  }, 65_000);

  it("reassembles all 520 poses with exact alpha/visible RGBA and zero overlap or gaps; only alpha-zero RGB is canonicalized", async () => {
    for (const [atlas, packet] of edition.packets.entries()) {
      const { data, info } = await sharp(readFileSync(`public${packet.src}`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info.channels).toBe(4);
      for (const frame of edition.frames.filter(frame => frame.atlas === atlas)) {
        const whole = Buffer.alloc(SIZE * SIZE * 4), assembled = Buffer.alloc(whole.length), occupied = new Uint8Array(SIZE * SIZE);
        const ox = frame.index % 8 * SIZE, oy = Math.floor(frame.index / 8) * SIZE;
        for (let y = 0; y < SIZE; y++) data.copy(whole, y * SIZE * 4, ((oy + y) * info.width + ox) * 4, ((oy + y) * info.width + ox + SIZE) * 4);
        let overlaps = 0, copied = 0;
        for (const part of frame.parts) {
          if (!part.visible) continue;
          const crop = part.source;
          expect([part.left, part.top, part.right, part.bottom, crop.x, crop.y, crop.width, crop.height].every(Number.isInteger)).toBe(true);
          expect(part.left).toBeGreaterThanOrEqual(0); expect(part.top).toBeGreaterThanOrEqual(0);
          expect(part.right).toBeLessThan(SIZE); expect(part.bottom).toBeLessThan(SIZE);
          expect(crop.x).toBeGreaterThanOrEqual(0); expect(crop.y).toBeGreaterThanOrEqual(SIZE * 2);
          expect(crop.x + crop.width).toBeLessThanOrEqual(info.width);
          expect(crop.y + crop.height).toBeLessThanOrEqual(info.height);
          let opaque = 0;
          for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
            const source = ((crop.y + y) * info.width + crop.x + x) * 4;
            if (!data[source + 3]) continue;
            const target = (part.top + y) * SIZE + part.left + x;
            if (occupied[target]) overlaps++;
            occupied[target]++; opaque++; copied++;
            data.copy(assembled, target * 4, source, source + 4);
          }
          expect(opaque, `frame ${frame.physicalIndex} owner ${part.owner}`).toBe(part.pixels);
        }
        let missing = 0, wholePixels = 0, alphaChanges = 0, visibleRgbaChanges = 0;
        const visible = { left: SIZE, top: SIZE, right: -1, bottom: -1 };
        for (let i = 0; i < occupied.length; i++) {
          const offset = i * 4;
          if (whole[offset + 3] !== assembled[offset + 3]) alphaChanges++;
          if (whole[offset + 3]) {
            wholePixels++; if (!occupied[i]) missing++;
            visible.left = Math.min(visible.left, i % SIZE); visible.right = Math.max(visible.right, i % SIZE);
            visible.top = Math.min(visible.top, Math.floor(i / SIZE)); visible.bottom = Math.max(visible.bottom, Math.floor(i / SIZE));
            if (!whole.subarray(offset, offset + 4).equals(assembled.subarray(offset, offset + 4))) visibleRgbaChanges++;
          } else {
            // Lossless WebP may rewrite RGB beneath alpha0 independently in
            // the whole and packed bands. Canonicalize only those invisible
            // RGB channels; every alpha byte and alpha>0 RGBA stays exact.
            whole.fill(0, offset, offset + 3);
            assembled.fill(0, offset, offset + 3);
          }
        }
        expect({ overlaps, missing, copied }, `frame ${frame.physicalIndex}`).toEqual({ overlaps: 0, missing: 0, copied: wholePixels });
        expect({ alphaChanges, visibleRgbaChanges }, `frame ${frame.physicalIndex}`).toEqual({ alphaChanges: 0, visibleRgbaChanges: 0 });
        expect(assembled.equals(whole), `alpha-zero-RGB-canonicalized RGBA reconstruction frame ${frame.physicalIndex}`).toBe(true);
        const measuredClip = [visible.top / 2.4 - 2, (SIZE - visible.right - 1) / 2.4 - 2,
          (SIZE - visible.bottom - 1) / 2.4 - 2, visible.left / 2.4 - 2].map((value, side) =>
          Math.min(registeredFrames[frame.physicalIndex].clip[side], Math.max(0, Number(value.toFixed(6)))));
        expect(frame.clip, `encoded alpha clip ${frame.physicalIndex}`).toEqual(measuredClip);
      }
    }
  }, 30_000);
});
