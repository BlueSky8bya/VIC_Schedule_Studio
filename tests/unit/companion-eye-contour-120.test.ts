import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const run = "art-src/빅타민/동행/작업회차/20261019-눈매윤곽교정120";
const prior119 = "art-src/빅타민/동행/작업회차/20261019-표정체적교정119";
const names = ["hd-motion-sprite", "play-motion-sprite", "living-motion-sprite"];
const expectedTargets = new Map([[1, [9, 10]], [10, [266]], [78, [519]]]);
const expectedPhysical = [9, 10, 266, 519];
const expectedPackets = new Map([[0, "vitamin-action-00"], [16, "vitamin-action-16"], [32, "vitamin-episodes-00"]]);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const readJson = <T,>(filename: string): T => JSON.parse(readFileSync(filename, "utf8")) as T;
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Metadata = { atlases: Atlas[]; frames: Frame[]; rows: number[][]; [key: string]: unknown };
type Key = { nativeCell: number; parentPath: string; parentSha256: string; correctedPath: string; correctedSha256: string; maskPath: string; maskSha256: string; width: number; height: number; physicalIndices: number[] };
type Composite = { generationCalls: number; generationCallsByThisScript: number; eyeGenerationCalls120: number; reused119EyeRaw: { path: string; sha256: string }; requestedSpecialistReviews: number; independentArtReviewsByThisScript: number; postGenerationArtReviews: number; ownerApproval: boolean; requestedReports: Array<{ path: string; sha256: string }>; nativeRaw: string; rawSha256: string; keys: Key[] };
type DeltaFrame = { physicalIndex: number; nativeCell: number; atlas: number; cell: number; parentFrame: Frame; frame: Frame; registrationChanged: boolean; bakeChangedPixels: number; deltaRows: number[][]; frozenFit: unknown; fixedTemplatePlacement?: { left: number; top: number; afterOffsetCompensation: { x: number; y: number } } };
type Packet = { atlas: number; family: string; localAtlas: number; parentPacket: Atlas; packet: Atlas; physicalIndices: number[]; visibleChangedPixels: number; alphaChangedPixels: number; invisibleRgbChannelsNormalized: number };
type Receipt = { generationCalls: number; generationCallsByThisScript: number; independentArtReviewsByThisScript: number; reused119EyeProposal: boolean; parentNative: { path: string; sha256: string }; generatedNative: { path: string; sha256: string }; sources: Key[]; frames: DeltaFrame[]; packets: Packet[]; physicalIndices: number[]; registrationChanges: number[]; frozenAnchors: { path: string; sha256: string; regeneratedByThisScript: boolean }; immutableParentPackets: Atlas[]; prior117PacketPreserved: Atlas; prior119BodyPacketsPreserved: Atlas[]; stagedMetadata: Record<string, string> };
type Anchors = { frames: Array<Record<string, unknown>>; rows: number[][]; sources: Array<{ src: string; sha256: string; bytes: number }> };

const combine = (metadata: Metadata[]) => {
  let atlasOffset = 0, frameOffset = 0;
  const result: { atlases: Atlas[]; frames: Frame[]; rows: number[][] } = { atlases: [], frames: [], rows: [] };
  for (const family of metadata) {
    result.atlases.push(...family.atlases);
    result.frames.push(...family.frames.map(frame => ({ ...frame, atlas: frame.atlas + atlasOffset })));
    result.rows.push(...family.rows.map(row => row.map(index => index + frameOffset)));
    atlasOffset += family.atlases.length; frameOffset += family.frames.length;
  }
  return result;
};
const packetOffset = (cell: number, x: number, y: number) => ((Math.floor(cell / 8) * 192 + y) * 1536 + cell % 8 * 192 + x) * 4;

describe("120 source-bound eye/contour packet conservation", () => {
  it("low-pass filters a large checker reduction and preserves translucent colour without transparent-RGB fringes", () => {
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import {prefilterCozy120 as filter} from './scripts/prepare-companion-eye-contour-targets-120.mjs';
      const width=128,height=96,scale=.093,checker=Buffer.alloc(width*height*4),edge=Buffer.alloc(checker.length);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const at=(y*width+x)*4,value=(x+y)%2?255:0;
        checker.set([value,value,value,255],at);
        edge.set(x<64?[200,120,80,128]:[0,255,20,0],at);
      }
      const checkerBefore=Buffer.from(checker),edgeBefore=Buffer.from(edge),small=filter(checker,width,height,scale),soft=filter(edge,width,height,scale);
      const interior=[];for(let y=2;y<small.height-2;y++)for(let x=2;x<small.width-2;x++)interior.push(small.data[(y*small.width+x)*4]);
      let colourError=0,partial=0;
      for(let at=0;at<soft.data.length;at+=4)if(soft.data[at+3]){
        for(let c=0;c<3;c++)colourError=Math.max(colourError,Math.abs(soft.data[at+c]-[200,120,80][c]));
        if(soft.data[at+3]<128)partial++;
      }
      console.log(JSON.stringify({size:[small.width,small.height],min:Math.min(...interior),max:Math.max(...interior),colourError,partial,inputUnchanged:checker.equals(checkerBefore)&&edge.equals(edgeBefore)}));
    `], { encoding: "utf8" });
    const report = JSON.parse(result) as { size: number[]; min: number; max: number; colourError: number; partial: number; inputUnchanged: boolean };
    expect(report.size).toEqual([12, 9]);
    expect(report.min).toBeGreaterThanOrEqual(120); expect(report.max).toBeLessThanOrEqual(135);
    expect(report.colourError).toBeLessThanOrEqual(1); expect(report.partial).toBeGreaterThan(0);
    expect(report.inputUnchanged).toBe(true);
  });

  it("binds three exact source canvases to immutable114/119 inputs and one new cozy generation", async () => {
    const composite = readJson<Composite>(`${run}/합성파생기록.json`), receipt = readJson<Receipt>(`${run}/패킹파생기록.json`), previous = readJson<Receipt>(`${prior119}/패킹파생기록.json`);
    expect(composite.generationCalls).toBe(1);
    expect(composite).toMatchObject({ generationCallsByThisScript: 0, eyeGenerationCalls120: 0, requestedSpecialistReviews: 2, independentArtReviewsByThisScript: 0, postGenerationArtReviews: 0, ownerApproval: false });
    expect(receipt).toMatchObject({ generationCalls: 1, generationCallsByThisScript: 0, independentArtReviewsByThisScript: 0, reused119EyeProposal: true, registrationChanges: [] });
    expect(hash(readFileSync(receipt.parentNative.path))).toBe("8cfa1fd98c63eff8b06dba9d0950391509e60d194c878b5881a16176be245ba4");
    expect(receipt.parentNative.sha256).toBe(hash(readFileSync(receipt.parentNative.path)));
    expect(hash(readFileSync(previous.generatedNative.path))).toBe("ec389e3364a77ddb4f6999a8b94087544b9543a731d0b4af04947f84ed638682");
    expect(composite.reused119EyeRaw).toEqual(previous.generatedNative);
    expect(composite.requestedReports).toHaveLength(2);
    for (const report of composite.requestedReports) expect(hash(readFileSync(report.path))).toBe(report.sha256);
    expect(hash(readFileSync(composite.nativeRaw))).toBe(composite.rawSha256);
    expect(receipt.generatedNative).toEqual({ path: composite.nativeRaw, sha256: composite.rawSha256 });
    expect(composite.nativeRaw).not.toBe(previous.generatedNative.path);
    expect(composite.keys).toHaveLength(3);
    expect(new Set(composite.keys.map(key => key.nativeCell))).toEqual(new Set(expectedTargets.keys()));
    expect(receipt.physicalIndices).toEqual(expectedPhysical);
    const proof115 = readJson<{ keys: Array<{ box: { left: number; top: number; width: number; height: number }; cropRgbaSha256: string }>; slots: Array<{ fit: unknown }> }>("art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json");
    for (const key of composite.keys) {
      expect(key.physicalIndices).toEqual(expectedTargets.get(key.nativeCell));
      for (const [filename, sha] of [[key.parentPath, key.parentSha256], [key.correctedPath, key.correctedSha256], [key.maskPath, key.maskSha256]]) expect(hash(readFileSync(filename))).toBe(sha);
      const before = await sharp(key.parentPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const after = await sharp(key.correctedPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const mask = await sharp(key.maskPath).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
      expect([before.info.width, before.info.height, before.info.channels]).toEqual([key.width, key.height, 4]);
      expect([after.info.width, after.info.height, after.info.channels]).toEqual([key.width, key.height, 4]);
      expect([mask.info.width, mask.info.height, mask.info.channels]).toEqual([key.width, key.height, 1]);
      if (key.nativeCell === 78) expect(hash(before.data)).toBe(proof115.keys[78].cropRgbaSha256);
      else {
        const old = previous.sources.find(source => source.nativeCell === key.nativeCell)!;
        expect(hash(readFileSync(old.correctedPath))).toBe(old.correctedSha256);
        expect(before.data.equals(await sharp(old.correctedPath).ensureAlpha().raw().toBuffer())).toBe(true);
      }
      let changed = 0, escaped = 0, eyeAlphaChanges = 0;
      for (let point = 0; point < key.width * key.height; point++) {
        const at = point * 4;
        if (key.nativeCell !== 78 && before.data[at + 3] !== after.data[at + 3]) eyeAlphaChanges++;
        if (before.data.subarray(at, at + 4).equals(after.data.subarray(at, at + 4))) continue;
        changed++; if (!mask.data[point]) escaped++;
      }
      expect(changed, `native${key.nativeCell} contains an actual masked correction`).toBeGreaterThan(0);
      expect(escaped).toBe(0); expect(eyeAlphaChanges).toBe(0);
      if (key.nativeCell !== 78) {
        const proposed = await sharp(`${run}/고정입력/119등록후_키${key.nativeCell}_마스크전.png`).ensureAlpha().raw().toBuffer();
        expect(hash(proposed)).toBe(key.nativeCell === 1 ? "ede672b073a4473ea2f1e5a595c5aa187e077e3e8ca14d27595b5068a7a065cc" : "f96282f4ad41b166029de4ab933b369b1e9094c632cc99fb544163fbe61a3bf3");
        expect(changed).toBe(key.nativeCell === 1 ? 6 : 5);
        const mouth = await sharp(`${run}/고정입력/키${key.nativeCell}_기존실제입보호.png`).greyscale().raw().toBuffer();
        expect([...mouth].filter(Boolean)).toHaveLength(key.nativeCell === 1 ? 17 : 80);
        for (let point = 0; point < mouth.length; point++) if (mouth[point]) {
          expect(mask.data[point], `native${key.nativeCell} mouth protection${point}`).toBe(0);
          expect(after.data.subarray(point * 4, point * 4 + 4)).toEqual(before.data.subarray(point * 4, point * 4 + 4));
        }
        const contactPoints = key.nativeCell === 1 ? [[39, 64], [39, 65], [39, 66], [73, 63], [74, 64], [70, 66]] : [[45, 58], [46, 59], [78, 57], [79, 57], [78, 58]];
        for (const [x, y] of contactPoints) {
          expect(mouth[y * key.width + x]).toBe(0);
          expect(mask.data[y * key.width + x], `known119 excluded contact${key.nativeCell}:${x},${y}`).toBeGreaterThan(0);
          const at = (y * key.width + x) * 4;
          expect(after.data.subarray(at, at + 3)).toEqual(proposed.subarray(at, at + 3));
        }
      }
    }
    for (const frame of receipt.frames) expect(frame.frozenFit).toEqual(proof115.slots[frame.physicalIndex].fit);
  });

  it("replaces exactly packets0/16/32 and preserves every row, frame and other30 atlas references", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    const parents = names.map(name => readJson<Metadata>(`${run}/고정입력/${name}.json`));
    // Preserve the exact120 evidence after131 takes row9 ownership. Current
    // successor conservation is checked by companion-petting-happiness-131.
    const active = names.map(name => readJson<Metadata>(receipt.stagedMetadata[name]));
    for (const name of names) expect(readFileSync(`${run}/고정입력/${name}.json`).equals(readFileSync(`${prior119}/정리본/${name}.json`))).toBe(true);
    const before = combine(parents), after = combine(active);
    expect(after.rows).toEqual(before.rows); expect(after.frames).toEqual(before.frames);
    expect(after.atlases).toHaveLength(33); expect(after.frames).toHaveLength(520);
    expect(receipt.packets.map(packet => packet.atlas)).toEqual([0, 16, 32]);
    const changes: number[] = [];
    for (let atlas = 0; atlas < after.atlases.length; atlas++) {
      if (JSON.stringify(after.atlases[atlas]) !== JSON.stringify(before.atlases[atlas])) changes.push(atlas);
      if (expectedPackets.has(atlas)) {
        expect(after.atlases[atlas].src).toBe(`/companion/hd/${expectedPackets.get(atlas)}-eye-contour-120-v1.webp`);
        expect(after.atlases[atlas]).toEqual(receipt.packets.find(packet => packet.atlas === atlas)!.packet);
      } else expect(after.atlases[atlas]).toEqual(before.atlases[atlas]);
    }
    expect(changes).toEqual([0, 16, 32]);
    expect(after.atlases[4].src).toContain("tuft-117");
    expect(after.atlases[22].src).toContain("expression-119"); expect(after.atlases[31].src).toContain("expression-119");
    for (let family = 0; family < active.length; family++) {
      expect({ ...active[family], atlases: parents[family].atlases }).toEqual(parents[family]);
    }
    expect(receipt.frames.map(frame => frame.physicalIndex)).toEqual(expectedPhysical);
    for (const frame of receipt.frames) { expect(frame.frame).toEqual(frame.parentFrame); expect(frame.registrationChanged).toBe(false); }
    expect(receipt.frames.find(frame => frame.physicalIndex === 519)!.fixedTemplatePlacement).toBeDefined();
  });

  it("keeps all historical packets immutable and all516 non-target cells visibly exact", async () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    expect(receipt.immutableParentPackets).toHaveLength(33);
    const changedTargets = new Set<number>();
    for (const old of receipt.immutableParentPackets) {
      const bytes = readFileSync(`public${old.src}`);
      expect(hash(bytes)).toBe(old.sha256); expect(bytes.length).toBe(old.bytes);
    }
    for (const packet of receipt.packets) {
      const parentBytes = readFileSync(`public${packet.parentPacket.src}`), newBytes = readFileSync(`public${packet.packet.src}`);
      expect(hash(newBytes)).toBe(packet.packet.sha256); expect(newBytes.length).toBe(packet.packet.bytes);
      const before = await sharp(parentBytes).ensureAlpha().raw().toBuffer();
      const after = await sharp(newBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([after.info.width, after.info.height, after.info.channels]).toEqual([1536, 384, 4]);
      let alphaChangedPixels = 0, visibleChangedPixels = 0;
      for (let cell = 0; cell < 16; cell++) {
        const physicalIndex = packet.atlas * 16 + cell, delta = receipt.frames.find(frame => frame.physicalIndex === physicalIndex);
        const allowed = new Uint8Array(192 * 192);
        for (const [y, left, right] of delta?.deltaRows ?? []) for (let x = left; x < right; x++) allowed[y * 192 + x] = 1;
        let changedPixels = 0, escaped = 0, alphaChanged = 0, clippedAlphaPixels = 0;
        for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
          const at = packetOffset(cell, x, y), alphaDiff = before[at + 3] !== after.data[at + 3];
          const visibleDiff = Boolean(before[at + 3] || after.data[at + 3]) && [0, 1, 2].some(channel => before[at + channel] !== after.data[at + channel]);
          if (delta && after.data[at + 3]) {
            const clip = delta.frame.clip;
            if (x < clip[3] * 2.4 || x >= 192 - clip[1] * 2.4 || y < clip[0] * 2.4 || y >= 192 - clip[2] * 2.4) clippedAlphaPixels++;
          }
          if (alphaDiff) { alphaChanged++; alphaChangedPixels++; }
          if (visibleDiff) visibleChangedPixels++;
          if (!alphaDiff && !visibleDiff) continue;
          changedPixels++; if (!allowed[y * 192 + x]) escaped++;
        }
        if (!expectedPhysical.includes(physicalIndex)) expect(changedPixels, `untargeted cell${physicalIndex}`).toBe(0);
        else { expect(changedPixels).toBeGreaterThan(0); changedTargets.add(physicalIndex); }
        expect(escaped, `displayed change escaped source delta${physicalIndex}`).toBe(0);
        expect(clippedAlphaPixels, `physical${physicalIndex} escaped its retained registration clip`).toBe(0);
        if (physicalIndex !== 519) expect(alphaChanged).toBe(0);
      }
      expect(alphaChangedPixels).toBe(packet.alphaChangedPixels);
      expect(visibleChangedPixels).toBe(packet.visibleChangedPixels);
      expect(packet.invisibleRgbChannelsNormalized).toBeGreaterThanOrEqual(0);
    }
    expect([...changedTargets].sort((a, b) => a - b)).toEqual(expectedPhysical);
    expect(520 - changedTargets.size).toBe(516);
    for (const preserved of [receipt.prior117PacketPreserved, ...receipt.prior119BodyPacketsPreserved]) expect(hash(readFileSync(`public${preserved.src}`))).toBe(preserved.sha256);
  });

  it("keeps all516 non-target anchor records while the separate anchor step binds current packet sources", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`), parent = readJson<Anchors>(`${run}/고정입력/accessory-anchors.json`), current = readJson<Anchors>(`${run}/정리본/accessory-anchors.json`);
    expect(receipt.frozenAnchors.regeneratedByThisScript).toBe(false);
    expect(hash(readFileSync(receipt.frozenAnchors.path))).toBe(receipt.frozenAnchors.sha256);
    expect(hash(readFileSync(receipt.frozenAnchors.path))).toBe("8501cc74e23861bc80d89cd231b38c330189dfdc268f75a52abacb4b28cd0e17");
    expect(readFileSync(receipt.frozenAnchors.path).equals(readFileSync(`${prior119}/정리본/accessory-anchors.json`))).toBe(true);
    expect(current.frames).toHaveLength(520); expect(current.rows).toEqual(parent.rows);
    for (let index = 0; index < 520; index++) if (!expectedPhysical.includes(index)) expect(current.frames[index], `untargeted anchor${index}`).toEqual(parent.frames[index]);
    const active = combine(names.map(name => readJson<Metadata>(receipt.stagedMetadata[name])));
    expect(current.sources).toEqual(active.atlases.map(({ src, sha256, bytes }) => ({ src, sha256, bytes })));
    expect(current.rows).toEqual(active.rows);
  });

  it("rejects the default historical119 writer before any output changes under current120 ownership", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`), old = readJson<Receipt>(`${prior119}/패킹파생기록.json`);
    const paths = [...names.map(name => `lib/ui/viewer-companion/${name}.json`), ...receipt.packets.map(packet => `public${packet.packet.src}`), ...old.packets.map(packet => `public${packet.packet.src}`), `${run}/패킹파생기록.json`, `${prior119}/패킹파생기록.json`];
    const before = paths.map(filename => hash(readFileSync(filename)));
    expect(() => execFileSync(process.execPath, ["scripts/prepare-companion-expression-volume-119.mjs"], { encoding: "utf8", stdio: "pipe" })).toThrow(/unrelated active metadata/);
    expect(paths.map(filename => hash(readFileSync(filename)))).toEqual(before);
  }, 30_000);

  it("rejects a foreign owner in any of the three120 metadata families without modifying active files", () => {
    const paths = names.map(name => `lib/ui/viewer-companion/${name}.json`), before = paths.map(filename => hash(readFileSync(filename)));
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import fs from 'node:fs';
      import {assertCompanionMetadataSetOwnership as guard} from './scripts/prepare-companion-expression-volume-119.mjs';
      const names=${JSON.stringify(names)};
      const parent=names.map(name=>JSON.parse(fs.readFileSync('${run}/고정입력/'+name+'.json','utf8')));
      const intended=names.map(name=>JSON.parse(fs.readFileSync('${run}/정리본/'+name+'.json','utf8')));
      guard(structuredClone(parent),parent,intended);guard(structuredClone(intended),parent,intended);
      const rejected=[];
      for(let family=0;family<3;family++){
        const foreign=structuredClone(intended);foreign[family].unrelatedLaterOwner=true;
        try{guard(foreign,parent,intended);rejected.push(false);}catch(error){rejected.push(error.message.includes('unrelated active metadata'));}
      }
      console.log(JSON.stringify(rejected));
    `], { encoding: "utf8" });
    expect(JSON.parse(result)).toEqual([true, true, true]);
    expect(paths.map(filename => hash(readFileSync(filename)))).toEqual(before);
  });

  it("refuses historical120 reproduction over the131 successor without changing its immutable evidence", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    const paths = [...names.map(name => `lib/ui/viewer-companion/${name}.json`), ...Object.values(receipt.stagedMetadata), ...receipt.packets.map(packet => `public${packet.packet.src}`), ...receipt.immutableParentPackets.map(packet => `public${packet.src}`), `${run}/패킹파생기록.json`, "lib/ui/viewer-companion/accessory-anchors.json"];
    const before = paths.map(filename => hash(readFileSync(filename)));
    expect(() => execFileSync(process.execPath, ["scripts/prepare-companion-eye-contour-120.mjs", "--check"], { encoding: "utf8", stdio: "pipe" })).toThrow(/unrelated active metadata/);
    expect(paths.map(filename => hash(readFileSync(filename)))).toEqual(before);
  }, 30_000);
});
