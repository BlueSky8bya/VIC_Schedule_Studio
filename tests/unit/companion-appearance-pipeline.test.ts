import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import policy from "@/lib/ui/viewer-companion/appearance-policy.json";
import edition from "@/lib/ui/viewer-companion/appearance-edition.json";
import { companionEyeStroke, COMPANION_EXPRESSION_REFERENCE_INDEX, COMPANION_EXPRESSION_REFERENCE_SRC } from "@/lib/ui/viewer-companion/expression-painter";

const cli=(...args:string[])=>execFileSync(process.execPath,["scripts/companion-consistency/pipeline.mjs",...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
describe("current appearance policy and selective pipeline",()=>{
  it("binds runtime to the original running eye and gives petting exactly a small stroke gain",()=>{
    expect(COMPANION_EXPRESSION_REFERENCE_INDEX).toBe(304);
    expect(COMPANION_EXPRESSION_REFERENCE_SRC).toBe(policy.eye.referenceSrc);
    expect(policy.eye.referenceSha256).toBe("977e0a047d92c6a3ba3426058805d000f6ee6c1d1ab86bfca28f50a32f42fa6e");
    for(const height of [4.5,5,5.833333,6.25])expect(companionEyeStroke(height,true)/companionEyeStroke(height)).toBeCloseTo(1.15,12);
    expect(JSON.parse(cli("doctor"))).toMatchObject({referencePhysicalIndex:304,referenceSha256:policy.eye.referenceSha256});
  });
  it("distinguishes global eye policy from a single native ear correction in its impact plan",()=>{
    const all=JSON.parse(cli("plan","--scope=eyes")),ear=JSON.parse(cli("plan","--scope=ears","--native=62"));
    expect(all.frames).toHaveLength(520);expect(all.packets).toHaveLength(33);
    expect(ear.nativeKeys).toEqual([62]);expect(ear.packets).toEqual([18,27]);
    expect(ear.frames).toEqual([...Array.from({length:16},(_,i)=>288+i),...Array.from({length:16},(_,i)=>432+i)]);
  });
  it("never invokes body derivation for a headwear-only build",()=>{
    const files=["lib/ui/viewer-companion/appearance-edition.json",...edition.packets.map(packet=>`public${packet.src}`)];
    const before=files.map(file=>readFileSync(file));
    expect(cli("build","--scope=headwear")).toContain("body/eye packets left unchanged");
    for(const [i,file]of files.entries())expect(readFileSync(file).equals(before[i]),file).toBe(true);
    const plan=JSON.parse(cli("plan","--scope=headwear"));expect(plan.frames).toEqual([]);expect(plan.packets).toEqual([]);
    expect(()=>cli("plan","--scope=ears","--native=NaN")).toThrow();
  });
});
