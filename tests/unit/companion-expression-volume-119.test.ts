import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const run = "art-src/빅타민/동행/작업회차/20261019-표정체적교정119";
const names = ["hd-motion-sprite", "play-motion-sprite", "living-motion-sprite"];
const expectedTargets = new Map([[1, [9, 10]], [64, [356, 357, 358, 359]], [65, [360, 361, 362, 363]], [73, [514]], [67, [496, 497, 498, 499]], [10, [266]]]);
const expectedPhysical = [...expectedTargets.values()].flat().sort((a, b) => a - b);
const expectedPackets = new Map([[0, "vitamin-action-00"], [16, "vitamin-action-16"], [22, "vitamin-play-03"], [31, "vitamin-play-12"], [32, "vitamin-episodes-00"]]);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const readJson = <T,>(filename: string): T => JSON.parse(readFileSync(filename, "utf8")) as T;
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Metadata = { atlases: Atlas[]; frames: Frame[]; rows: number[][]; [key: string]: unknown };
type Key = { nativeCell: number; parentPath: string; parentSha256: string; correctedPath: string; correctedSha256: string; maskPath: string; maskSha256: string; width: number; height: number; physicalIndices: number[] };
type Composite = { generationCalls: number; nativeRaw: string; rawSha256: string; keys: Key[] };
type DeltaFrame = { physicalIndex: number; nativeCell: number; atlas: number; cell: number; parentFrame: Frame; frame: Frame; registrationChanged: boolean; bakeChangedPixels: number; deltaRows: number[][]; fixedTemplatePlacement?: { left: number; top: number; afterOffsetCompensation: { x: number; y: number } } };
type Packet = { atlas: number; parentPacket: Atlas; packet: Atlas; physicalIndices: number[]; alphaChangedPixels: number; invisibleRgbChannelsNormalized: number };
type Receipt = { generationCalls: number; generationCallsByThisScript: number; independentArtReviewsByThisScript: number; parentNative: { path: string; sha256: string }; generatedNative: { path: string; sha256: string }; sources: Key[]; frames: DeltaFrame[]; packets: Packet[]; physicalIndices: number[]; registrationChanges: number[]; frozenAnchors: { path: string; sha256: string; regeneratedByThisScript: boolean }; immutableParentPackets: Atlas[]; prior117PacketPreserved: Atlas; prior118PacketPreserved: Atlas; sameOriginalFitAndTemplatePlacement: boolean };
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

describe("119 masked expression/body packet conservation", () => {
  it("binds six exact source canvases/masks to the single preserved generated native", async () => {
    const composite = readJson<Composite>(`${run}/합성파생기록.json`), receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    expect(composite.generationCalls).toBe(1);
    expect(receipt).toMatchObject({ generationCalls: 1, generationCallsByThisScript: 0, independentArtReviewsByThisScript: 0, sameOriginalFitAndTemplatePlacement: true });
    expect(hash(readFileSync(composite.nativeRaw))).toBe(composite.rawSha256);
    expect(receipt.generatedNative).toEqual({ path: composite.nativeRaw, sha256: composite.rawSha256 });
    expect(hash(readFileSync(receipt.parentNative.path))).toBe("8cfa1fd98c63eff8b06dba9d0950391509e60d194c878b5881a16176be245ba4");
    expect(receipt.parentNative.sha256).toBe(hash(readFileSync(receipt.parentNative.path)));
    expect(composite.keys).toHaveLength(6);
    expect(new Set(composite.keys.map(key => key.nativeCell))).toEqual(new Set(expectedTargets.keys()));
    expect(receipt.physicalIndices).toEqual(expectedPhysical);
    expect(receipt.sources.map(source => source.nativeCell).sort((a, b) => a - b)).toEqual([...expectedTargets.keys()].sort((a, b) => a - b));
    for (const key of composite.keys) {
      expect(key.physicalIndices).toEqual(expectedTargets.get(key.nativeCell));
      for (const [filename, sha] of [[key.parentPath, key.parentSha256], [key.correctedPath, key.correctedSha256], [key.maskPath, key.maskSha256]]) expect(hash(readFileSync(filename))).toBe(sha);
      const before = await sharp(key.parentPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const after = await sharp(key.correctedPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const mask = await sharp(key.maskPath).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
      expect([before.info.width, before.info.height, before.info.channels]).toEqual([key.width, key.height, 4]);
      expect([after.info.width, after.info.height, after.info.channels]).toEqual([key.width, key.height, 4]);
      expect([mask.info.width, mask.info.height, mask.info.channels]).toEqual([key.width, key.height, 1]);
      let changed = 0, escaped = 0, faceAlphaChanges = 0;
      for (let point = 0; point < key.width * key.height; point++) {
        const at = point * 4;
        if (key.nativeCell !== 67 && before.data[at + 3] !== after.data[at + 3]) faceAlphaChanges++;
        if (before.data.subarray(at, at + 4).equals(after.data.subarray(at, at + 4))) continue;
        changed++; if (!mask.data[point]) escaped++;
      }
      expect(changed, `native${key.nativeCell} contains an actual masked correction`).toBeGreaterThan(0);
      expect(escaped).toBe(0); expect(faceAlphaChanges).toBe(0);
    }
    const yawn = composite.keys.find(key => key.nativeCell === 10)!;
    const prior118 = readJson<{ correctedKey: { path: string; sha256: string } }>("art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118/패킹파생기록.json");
    expect(hash(readFileSync(prior118.correctedKey.path))).toBe(prior118.correctedKey.sha256);
    const yawnParent = await sharp(yawn.parentPath).ensureAlpha().raw().toBuffer();
    const priorPixels = await sharp(prior118.correctedKey.path).ensureAlpha().raw().toBuffer();
    expect(yawnParent.equals(priorPixels)).toBe(true);
  });

  it("changes exactly five packet references and preserves all metadata except optional body67 registration", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    const parents = names.map(name => readJson<Metadata>(`${run}/고정입력/${name}.json`));
    //119 remains immutable evidence after120 takes active packet ownership.
    const active = names.map(name => readJson<Metadata>(`${run}/정리본/${name}.json`));
    const before = combine(parents), after = combine(active);
    expect(after.rows).toEqual(before.rows);
    expect(after.atlases).toHaveLength(33); expect(after.frames).toHaveLength(520);
    expect(receipt.packets.map(packet => packet.atlas).sort((a, b) => a - b)).toEqual([...expectedPackets.keys()].sort((a, b) => a - b));
    const packetChanges: number[] = [], registrationChanges: number[] = [];
    for (let atlas = 0; atlas < after.atlases.length; atlas++) {
      if (JSON.stringify(after.atlases[atlas]) !== JSON.stringify(before.atlases[atlas])) packetChanges.push(atlas);
      if (expectedPackets.has(atlas)) {
        expect(after.atlases[atlas].src).toBe(`/companion/hd/${expectedPackets.get(atlas)}-expression-119-v1.webp`);
        expect(after.atlases[atlas]).toEqual(receipt.packets.find(packet => packet.atlas === atlas)!.packet);
      } else expect(after.atlases[atlas]).toEqual(before.atlases[atlas]);
    }
    expect(packetChanges).toEqual([0, 16, 22, 31, 32]);
    for (let index = 0; index < 520; index++) {
      if (JSON.stringify(after.frames[index]) !== JSON.stringify(before.frames[index])) registrationChanges.push(index);
      if (index < 496 || index > 499) expect(after.frames[index]).toEqual(before.frames[index]);
    }
    expect(registrationChanges).toEqual(receipt.registrationChanges);
    expect(registrationChanges.every(index => index >= 496 && index <= 499)).toBe(true);
    for (let family = 0; family < active.length; family++) {
      const restored = structuredClone(active[family]);
      restored.atlases = parents[family].atlases;
      restored.frames = parents[family].frames;
      expect(restored).toEqual(parents[family]);
      expect(active[family]).toEqual(readJson<Metadata>(`${run}/정리본/${names[family]}.json`));
    }
    expect(receipt.frames.map(frame => frame.physicalIndex)).toEqual(expectedPhysical);
    for (const frame of receipt.frames.filter(frame => frame.nativeCell === 67)) expect(frame.fixedTemplatePlacement).toBeDefined();
  });

  it("keeps every old packet immutable and all504 non-target cells visibly exact", async () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    expect(receipt.immutableParentPackets).toHaveLength(33);
    expect(receipt.packets).toHaveLength(5);
    const changedTargets = new Set<number>();
    for (const old of receipt.immutableParentPackets) {
      const bytes = readFileSync(`public${old.src}`);
      expect(hash(bytes)).toBe(old.sha256); expect(bytes.length).toBe(old.bytes);
    }
    for (const packet of receipt.packets) {
      const parentBytes = readFileSync(`public${packet.parentPacket.src}`), newBytes = readFileSync(`public${packet.packet.src}`);
      expect(hash(parentBytes)).toBe(packet.parentPacket.sha256);
      expect(hash(newBytes)).toBe(packet.packet.sha256); expect(newBytes.length).toBe(packet.packet.bytes);
      const before = await sharp(parentBytes).ensureAlpha().raw().toBuffer();
      const after = await sharp(newBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([after.info.width, after.info.height, after.info.channels]).toEqual([1536, 384, 4]);
      let alphaChangedPixels = 0;
      for (let cell = 0; cell < 16; cell++) {
        const physicalIndex = packet.atlas * 16 + cell, delta = receipt.frames.find(frame => frame.physicalIndex === physicalIndex);
        const allowed = new Uint8Array(192 * 192);
        for (const [y, left, right] of delta?.deltaRows ?? []) for (let x = left; x < right; x++) allowed[y * 192 + x] = 1;
        let changedPixels = 0, escaped = 0, alphaChanged = 0;
        for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
          const at = packetOffset(cell, x, y), alphaDiff = before[at + 3] !== after.data[at + 3];
          const visibleDiff = Boolean(before[at + 3] || after.data[at + 3]) && [0, 1, 2].some(channel => before[at + channel] !== after.data[at + channel]);
          if (alphaDiff) { alphaChanged++; alphaChangedPixels++; }
          if (!alphaDiff && !visibleDiff) continue;
          changedPixels++; if (!allowed[y * 192 + x]) escaped++;
        }
        if (!expectedPhysical.includes(physicalIndex)) expect(changedPixels, `untargeted cell${physicalIndex}`).toBe(0);
        else { expect(changedPixels).toBeGreaterThan(0); changedTargets.add(physicalIndex); }
        expect(escaped, `displayed change escaped baked source delta${physicalIndex}`).toBe(0);
        if (physicalIndex < 496 || physicalIndex > 499) expect(alphaChanged).toBe(0);
      }
      expect(alphaChangedPixels).toBe(packet.alphaChangedPixels);
      expect(packet.invisibleRgbChannelsNormalized).toBeGreaterThanOrEqual(0);
    }
    expect([...changedTargets].sort((a, b) => a - b)).toEqual(expectedPhysical);
    expect(520 - changedTargets.size).toBe(504);
    expect(hash(readFileSync(`public${receipt.prior117PacketPreserved.src}`))).toBe(receipt.prior117PacketPreserved.sha256);
    expect(receipt.prior117PacketPreserved.src).toContain("tuft-117");
    expect(hash(readFileSync(`public${receipt.prior118PacketPreserved.src}`))).toBe("17c96fe6080085cc8772bedc4dcb89de37a9c60c9166722db5b38ee6fabac8c9");
  });

  it("preserves all504 non-target anchor records and leaves regeneration to the separate anchor step", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`), parent = readJson<Anchors>(`${run}/고정입력/accessory-anchors.json`), current = readJson<Anchors>(`${run}/정리본/accessory-anchors.json`);
    expect(receipt.frozenAnchors.regeneratedByThisScript).toBe(false);
    expect(hash(readFileSync(receipt.frozenAnchors.path))).toBe(receipt.frozenAnchors.sha256);
    expect(current.frames).toHaveLength(520); expect(current.rows).toEqual(parent.rows);
    for (let index = 0; index < 520; index++) if (!expectedPhysical.includes(index)) expect(current.frames[index], `untargeted anchor${index}`).toEqual(parent.frames[index]);
    const active = combine(names.map(name => readJson<Metadata>(`${run}/정리본/${name}.json`)));
    expect(current.sources).toEqual(active.atlases.map(({ src, sha256, bytes }) => ({ src, sha256, bytes })));
    expect(current.rows).toEqual(active.rows);
  });

  it("rejects unrelated ownership in any metadata family without writing outputs", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    const protectedPaths = [...names.map(name => `lib/ui/viewer-companion/${name}.json`), ...receipt.packets.map(packet => `public${packet.packet.src}`), `${run}/패킹파생기록.json`];
    const before = protectedPaths.map(filename => hash(readFileSync(filename)));
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import fs from 'node:fs';
      import { assertCompanionMetadataSetOwnership as guard } from './scripts/prepare-companion-expression-volume-119.mjs';
      const names=${JSON.stringify(names)};
      const parent=names.map(name=>JSON.parse(fs.readFileSync('${run}/고정입력/'+name+'.json','utf8')));
      const intended=names.map(name=>JSON.parse(fs.readFileSync('${run}/정리본/'+name+'.json','utf8')));
      guard(structuredClone(parent),parent,intended);guard(structuredClone(intended),parent,intended);
      const rejected=[];
      for(let family=0;family<3;family++){
        const unrelated=structuredClone(intended);unrelated[family].unrelatedLaterOwner=true;
        try{guard(unrelated,parent,intended);rejected.push(false);}catch(error){rejected.push(error.message.includes('unrelated active metadata'));}
      }
      console.log(JSON.stringify(rejected));
    `], { encoding: "utf8" });
    expect(JSON.parse(result)).toEqual([true, true, true]);
    expect(protectedPaths.map(filename => hash(readFileSync(filename)))).toEqual(before);
  });

  it("reproduces all five siblings and three metadata snapshots without changing any outputs", () => {
    const receipt = readJson<Receipt>(`${run}/패킹파생기록.json`);
    const protectedPaths = [...names.map(name => `lib/ui/viewer-companion/${name}.json`), ...receipt.packets.map(packet => `public${packet.packet.src}`), ...receipt.immutableParentPackets.map(packet => `public${packet.src}`), `${run}/패킹파생기록.json`];
    const before = protectedPaths.map(filename => hash(readFileSync(filename)));
    const report = JSON.parse(execFileSync(process.execPath, ["scripts/prepare-companion-expression-volume-119.mjs", "--check", "--artifacts-only"], { encoding: "utf8" }));
    expect(report).toMatchObject({ check: true, artifactsOnly: true, packets: 5, physicalIndices: expectedPhysical, parentPacketsPreserved: 33, anchorsRegenerated: false });
    expect(protectedPaths.map(filename => hash(readFileSync(filename)))).toEqual(before);
  }, 30_000);

  it("requires --check for the historical artifacts-only flag", () => {
    expect(() => execFileSync(process.execPath, ["scripts/prepare-companion-expression-volume-119.mjs", "--artifacts-only"], { encoding: "utf8", stdio: "pipe" })).toThrow(/--artifacts-only requires --check/);
  });
});
