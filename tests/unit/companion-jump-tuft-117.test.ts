import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import metadata from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import receipt from "../../art-src/빅타민/동행/작업회차/20261018-점프노란조각교정117/패킹파생기록.json";
import parentAnchors from "../../art-src/빅타민/동행/작업회차/20261018-점프노란조각교정117/고정입력/accessory-anchors.json";
const run="art-src/빅타민/동행/작업회차/20261018-점프노란조각교정117";
const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");

describe("117 single jump corner conservation",()=>{
  it("changes only the requested native corner, retaining original eyes, ears and every other source RGBA pixel",async()=>{
    const before=await sharp(`${run}/고정입력/점프키6_원본RGBA.png`).ensureAlpha().raw().toBuffer();
    const after=await sharp(receipt.correctedKey.path).ensureAlpha().raw().toBuffer();
    let changes=0;
    for(let y=0;y<105;y++)for(let x=0;x<104;x++)for(let c=0;c<4;c++){
      const p=(y*104+x)*4+c;
      if(x>=29||y<76)expect(after[p]).toBe(before[p]);
      if(after[p]!==before[p])changes++;
    }
    expect(changes).toBe(receipt.sourceChangedChannels);expect(changes).toBeGreaterThan(0);
    expect(hash(readFileSync(receipt.parentNative.path))).toBe(receipt.parentNative.sha256);
    expect(hash(readFileSync(receipt.generatedNative.path))).toBe(receipt.generatedNative.sha256);
    expect(receipt.generationCalls).toBe(1);
  });
  it("preserves every unaffected displayed pixel and all head/face anchors through all16 rise rigs",async()=>{
    const before=await sharp(`public${receipt.parentPacket.src}`).ensureAlpha().raw().toBuffer();
    const after=await sharp(`public${receipt.packet.src}`).ensureAlpha().raw().toBuffer();
    expect(hash(readFileSync(`public${receipt.parentPacket.src}`))).toBe(receipt.parentPacket.sha256);
    expect(metadata.atlases[4]).toEqual(receipt.packet);
    expect(anchors.sources[4]).toEqual({src:receipt.packet.src,sha256:receipt.packet.sha256,bytes:receipt.packet.bytes});
    for(const frame of receipt.frames){
      const cell=frame.physicalIndex-64;let changed=0;
      for(let y=0;y<192;y++)for(let x=0;x<192;x++){
        const p=((Math.floor(cell/8)*192+y)*1536+cell%8*192+x)*4;
        const different=before[p+3]!==after[p+3]||(before[p+3]>0||after[p+3]>0)&&[0,1,2].some(c=>before[p+c]!==after[p+c]);
        if(!different)continue;
        expect(x).toBeLessThan(82);expect(y).toBeGreaterThanOrEqual(125);changed++;
      }
      expect(changed).toBeGreaterThan(0);
      expect(anchors.frames[frame.physicalIndex].head).toEqual(parentAnchors.frames[frame.physicalIndex].head);
      expect(anchors.frames[frame.physicalIndex].face).toEqual(parentAnchors.frames[frame.physicalIndex].face);
    }
    for(let i=0;i<anchors.frames.length;i++)if(i<64||i>79)expect(anchors.frames[i]).toEqual(parentAnchors.frames[i]);
    const report=JSON.parse(execFileSync(process.execPath,["scripts/prepare-companion-jump-tuft-117.mjs","--check"],{encoding:"utf8"}));
    expect(report).toMatchObject({check:true,frames:16,registrationPreserved:true});
  },15_000);
});
