import { test, expect } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionPersonality, openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { guardCompanionQa, startCompanionQaProbe, finishCompanionQa, type DailyProof } from "./helpers/companion-qa";
import { companionTraceMode } from "./helpers/companion-evidence-policy";

test.use({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block", trace: companionTraceMode(),
  video: { mode: "on", size: { width: 1440, height: 1100 } } });
test.setTimeout(235000);
type Frame = { at: number; scene: string; serial: string; beat: string; command: string; state: string; platform: string; x: number; y: number; decoded: boolean; sourceClipMeasured: boolean; pose: number; controls: string };
for (const surface of ["viewer","studio","preview"] as const) {
  test(`TV comparison ${surface}: observes both real channels at TV then sofa without intermediate sofa return`, async ({ page,context,baseURL },info) => {
    let proof: DailyProof | undefined,completed=false,error: string | undefined;
    const scenario={ id:`tv-comparison-${surface}`,surface,personality:"curious",seconds:180,width:1440,motion:"full" };
    try {
      proof=await guardCompanionQa(page,context,baseURL!);
      await page.addInitScript(({defaults,care,epoch,key})=>{
        for(const [k,v] of Object.entries({[key]:epoch,"vic.gfxPref":"max","vic.gfx":JSON.stringify({mode:"full",at:Date.now(),v:3}),"vic.reduceMotion":"off","vic.sound":"off","vic.ambient":"off","vic.dark":"off","vic_avatar_side":"left","vic.premiereStage":"off"}))localStorage.setItem(k,v);
        localStorage.setItem("vic.viewerCompanion",JSON.stringify({version:1,...defaults,enabled:true,roam:true,sleep:true,sound:false}));
        localStorage.setItem("vic.viewerCompanionCare",JSON.stringify({version:3,...care,hunger:.05,energy:.9}));
      },{defaults:DEFAULT_COMPANION_PREFERENCES,care:DEFAULT_COMPANION_MEMORY,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY});
      await page.goto(surface==="viewer"?"/visual-fixture/poster?avatar=1":`/visual-fixture/studio?role=owner&y=2026&m=6&weather=clear${surface==="preview"?"&viewer=1":""}`);
      await page.bringToFront();await settlePanelLayout(page);await page.evaluate(()=>document.fonts.ready);
      await chooseCompanionPersonality(page,"curious");const home=await openCompanionHome(page);
      await startCompanionQaProbe(page,{sampleIntervalMs:40,captureMs:190000});
      // Studio/preview use the existing clear-weather fixture, excluding rainy C12.
      // Real toy return opens the existing brief indoor TV opportunity.
      // This fixture proves the comparison in that context, not its frequency.
      await home.getByRole("button",{name:"장난감 상자 열기",exact:true}).click();await page.mouse.move(2,2);
      for (let opportunity=0;opportunity<2;opportunity++) {
        await page.waitForTimeout(40000);
        const completedComparison=await page.evaluate(()=>{const f=(window as typeof window & {companionDaily142?:{frames:Frame[]}}).companionDaily142?.frames??[];return f.some(row=>row.scene==="C04"&&row.beat==="3"&&row.state==="look"&&row.decoded&&row.sourceClipMeasured);});
        if(completedComparison) continue;
        const earlierIds = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-toy-id")));
        await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
        if (await page.locator(".vc-companion").isVisible()) {
          // Put the newly introduced real toy near the observed public actor
          // with native input. Geometry is read from painted day containers;
          // no runtime platform, object position or scene is written.
          const fresh = page.locator(".vc-toy");
          const freshId = await fresh.evaluateAll((nodes, old) => nodes.map(node => node.getAttribute("data-toy-id")).find(id => id && !old.includes(id)), earlierIds);
          const target = await page.locator(".vc-companion").evaluate(actor => {
            if (/^companion-home/.test(actor.getAttribute("data-platform") ?? "")) return null;
            const r = actor.getBoundingClientRect(), x = r.left + r.width / 2, y = r.bottom;
            const days = [...document.querySelectorAll<HTMLElement>(".public-day,.studio-day,.agenda-day")]
              .filter(node => !node.closest("[inert],[hidden],[aria-hidden='true']"))
              .map(node => node.getBoundingClientRect()).filter(d => d.width > 70 && d.bottom > 150 && d.bottom < innerHeight - 10);
            return days.map(d => ({ x: Math.max(d.left+30, Math.min(d.right-30, x+55)), y: d.bottom-38 }))
              .sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))
              .find(p => Math.hypot(p.x-x,p.y-y) < 130) ?? null;
          });
          if (freshId && target) {
            const toy = page.locator(`.vc-toy[data-toy-id="${freshId}"]`);
            await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 7000 });
            const rect = await toy.boundingBox();
            if (rect) {
              await page.mouse.move(rect.x + rect.width/2, rect.y + rect.height/2);
              await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 12 }); await page.mouse.up();
              await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 7000 });
              await info.attach("actual-new-toy-input", { body: JSON.stringify({ id: freshId, target, settledPlatform: await toy.getAttribute("data-platform") }), contentType: "application/json" });
            }
          }
        }

      }
      await page.mouse.move(2,2);await page.waitForTimeout(101000);
      const frames=await page.evaluate(()=> (window as typeof window & {companionDaily142?:{frames:Frame[]}}).companionDaily142?.frames??[]);
      const firstCandidates=frames.filter(f=>f.scene==="C04"&&f.beat==="1"&&f.command==="watch"&&f.state==="look"&&f.decoded&&f.sourceClipMeasured);
      const second=frames.filter(f=>f.scene==="C04"&&f.beat==="3"&&f.command==="watch"&&f.state==="look"&&f.decoded&&f.sourceClipMeasured);
      expect(firstCandidates.length,"C04 first actual decoded TV-front watch must be observed").toBeGreaterThan(10);
      const serial=firstCandidates[0].serial,first=firstCandidates.filter(f=>f.serial===serial),paired=second.filter(f=>f.serial===serial);
      expect(first.length,"Same C04 must supply all first-watch observations").toBeGreaterThan(10);
      expect(paired.length,"Same C04 must reach its second actual sofa viewing").toBeGreaterThan(20);
      expect(first.every(f=>f.platform.startsWith("companion-home-floor"))).toBe(true);
      expect(paired.every(f=>f.platform==="companion-home")).toBe(true);
      expect(first.at(-1)!.at-first[0].at).toBeGreaterThanOrEqual(1400*.8-80);
      expect(paired.at(-1)!.at-paired[0].at).toBeGreaterThanOrEqual(3000*.8-80);
      expect(first[0].controls.split("|")[0]).not.toBe(paired[0].controls.split("|")[0]);
      const between=frames.filter(f=>f.scene==="C04"&&f.serial===serial&&f.at>=first[0].at&&Number(f.beat)<3);
      expect(between.some(f=>f.platform==="companion-home"),"No sofa visit between two physical channel controls").toBe(false);
      await info.attach("actual-tv-comparison",{body:JSON.stringify({surface,first:{at:first[0].at,end:first.at(-1)!.at,platform:first[0].platform,channel:first[0].controls.split("|")[0]},second:{at:paired[0].at,end:paired.at(-1)!.at,platform:paired[0].platform,channel:paired[0].controls.split("|")[0]},sampledSourceFrames:first.length+paired.length}),contentType:"application/json"});
      completed=true;
    }catch(e){error=String(e);throw e;}
    finally{if(proof)await finishCompanionQa(page,info,proof,scenario,completed,error);}
  });
}
