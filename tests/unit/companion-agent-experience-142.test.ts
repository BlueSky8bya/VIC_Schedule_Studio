import { describe, expect, it } from "vitest";
import { createCompanionAgentExperience, COMPANION_EXPERIENCE_FAMILIES } from "@/lib/ui/viewer-companion/agent-experience";
import { COMPANION_PERSONALITIES } from "@/lib/ui/viewer-companion/preferences";

const choice = { personality:"tidy" as const,context:"home" as const,family:"cleanup" as const,learn:true };
describe("142 bounded actual-effect experience", () => {
  it("keeps the personality prior before actual experience and with learning OFF", () => {
    const policy=createCompanionAgentExperience();
    expect(policy.score(choice)).toBe(0);
    expect(policy.observe({...choice,effect:"toy-returned",learn:false})).toBe(false);
    expect(policy.snapshot().entries).toEqual([]);
    policy.observe({...choice,effect:"toy-returned"});
    const before=policy.snapshot();
    expect(policy.score({...choice,learn:false})).toBe(0);
    expect(policy.observe({...choice,effect:"route-failed",learn:false})).toBe(false);
    expect(policy.snapshot()).toEqual(before);
  });
  it("learns only accepted actual effects; a pose or collection cannot reward anything", () => {
    const policy=createCompanionAgentExperience();
    for(const effect of ["pose","selected","discovered","ready","collected"])
      expect(policy.observe({...choice,effect:effect as "ate"})).toBe(false);
    expect(policy.snapshot().entries).toEqual([]);
    expect(policy.observe({...choice,effect:"route-failed",family:undefined})).toBe(false);
    expect(policy.observe({...choice,effect:"toy-returned"})).toBe(true);
    expect(policy.snapshot().entries[0]).toMatchObject({family:"cleanup",count:1,mean:1});
    expect(policy.score(choice)).toBeGreaterThan(0);
  });
  it("discounts old outcomes and bounds contextual UCB so successes and failures alter a tie-break", () => {
    const policy=createCompanionAgentExperience();
    for(let i=0;i<20;i++) policy.observe({...choice,effect:"toy-returned"});
    const successful=policy.score(choice),count=policy.snapshot().entries[0].count;
    expect(count).toBeLessThan(20);
    for(let i=0;i<70;i++) policy.observe({...choice,effect:"route-failed"});
    expect(policy.score(choice)).toBeLessThan(successful);
    expect(policy.score({...choice,family:"explore"})).toBeGreaterThan(policy.score(choice));
    for(const family of COMPANION_EXPERIENCE_FAMILIES) expect(policy.score({...choice,family})).toBeGreaterThanOrEqual(-.1);
    for(const family of COMPANION_EXPERIENCE_FAMILIES) expect(policy.score({...choice,family})).toBeLessThanOrEqual(.2);
    expect(policy.score({...choice,context:"outside"})).toBe(0);
    expect(policy.score({...choice,personality:"gourmet"})).toBe(0);
  });
  it("normalizes the full126 abstract keys, clips values and returns independent snapshots below24KB", () => {
    const entries=COMPANION_PERSONALITIES.flatMap(personality=>(["home","outside"] as const).flatMap(context=>COMPANION_EXPERIENCE_FAMILIES.map(family=>({personality,context,family,count:1e9,mean:3,foodId:"forbidden",title:"forbidden",at:123}))));
    const policy=createCompanionAgentExperience({v:1,entries});
    const snapshot=policy.snapshot(); expect(snapshot.entries).toHaveLength(126);
    expect(snapshot.entries.every(entry=>entry.count===255&&entry.mean===1)).toBe(true);
    const encoded=JSON.stringify(snapshot);expect(encoded.length).toBeLessThan(24000);
    expect(encoded).not.toMatch(/forbidden|foodId|title|"at"/);
    snapshot.entries[0].mean=0; expect(policy.snapshot().entries[0].mean).toBe(1);
    policy.clear();expect(policy.snapshot().entries).toEqual([]);
    policy.restore(snapshot);expect(policy.snapshot().entries).toHaveLength(126);
  });
  it("rejects malformed schemas/keys/numbers without retaining arbitrary payload fields", () => {
    const policy=createCompanionAgentExperience();
    for(const input of [null,[],"raw",{v:2,entries:[]},{v:1,entries:[{...choice,count:NaN,mean:1},{...choice,count:0,mean:0},{...choice,personality:"owner",count:1,mean:1},{...choice,context:"private-calendar",count:1,mean:1}]}]) {
      policy.restore(input);expect(policy.snapshot().entries).toEqual([]);
    }
    policy.restore({v:1,entries:Array.from({length:9999},()=>({...choice,count:2,mean:-10}))});
    expect(policy.snapshot().entries).toHaveLength(1);expect(policy.snapshot().entries[0].mean).toBe(0);
  });
});
