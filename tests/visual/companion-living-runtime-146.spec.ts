import {expect,test,type Page} from "@playwright/test";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {SETTINGS_EPOCH,SETTINGS_EPOCH_KEY} from "@/lib/ui/motion";
import {DEFAULT_COMPANION_PREFERENCES,COMPANION_PERSONALITIES,type CompanionPersonality} from "@/lib/ui/viewer-companion/preferences";
import {DEFAULT_COMPANION_MEMORY} from "@/lib/ui/viewer-companion/care";
import {COMPANION_PERSONALITY_SCENES} from "@/lib/ui/viewer-companion/personality-scene-catalog";
import {chooseCompanionPersonality,openCompanionHome,placeCompanionOnHomeFloor} from "./helpers/companion-home";
import {settlePanelLayout} from "./helpers/panel-layout";
import {guardCompanionQa,startCompanionQaProbe,type DailyProof,type QaObservation} from "./helpers/companion-qa";

const output=resolve(process.env.COMPANION146_OUTPUT??".scratch-pw/companion-146/runtime");
const proofByPage=new WeakMap<Page,DailyProof>();
type ProbeWindow=Window&{companionDaily142?:{frames:QaObservation[];stop:()=>void}};
test.use({viewport:{width:1920,height:1100},serviceWorkers:"block",storageState:{cookies:[],origins:[]}});
test.setTimeout(135000);
test.beforeEach(async({page,context,baseURL})=>{proofByPage.set(page,await guardCompanionQa(page,context,baseURL!));});
test.afterEach(async({page},info)=>{
 const frames=await samples(page,true).catch(()=>[]),proof=proofByPage.get(page)!;await Promise.allSettled(proof.pending);
 mkdirSync(output,{recursive:true});const file=resolve(output,`${info.title.replace(/[^a-z0-9]+/gi,"-")}-${Date.now()}.json`);
 writeFileSync(file,JSON.stringify({status:info.status,scope:"146 real runtime: native UI object creation/placement/personality/roam; decoded DOM sprite and same-ID carried objects. No RNG/clock/brain/geometry override; sampled activities, not exhaustive model coverage.",proof:{...proof,pending:undefined},frames},null,2),{flag:"wx"});
 await info.attach("146-native-runtime",{path:file,contentType:"application/json"});await page.screenshot({path:file.replace(/\.json$/,".png")}).catch(()=>{});
 expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);
 expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.served===c.local)).toBe(true);
 expect(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR??".next","BUILD_ID"),"utf8").trim()).toBe(proof.build);
});
async function samples(page:Page,stop=false) {return page.evaluate(stop=>{const p=(window as ProbeWindow).companionDaily142;if(stop)p?.stop();return p?.frames??[];},stop);}
async function fixture(page:Page,personality:CompanionPersonality,surface:"viewer"|"studio"|"preview"="viewer",hunger=.05) {
 await page.addInitScript(({defaults,memory,epoch,key,hunger})=>{
  const values={[key]:epoch,"vic.gfxPref":"max","vic.gfx":JSON.stringify({mode:"full",at:Date.now(),v:3}),"vic.reduceMotion":"off","vic.sound":"off","vic.ambient":"off","vic.dark":"on","vic_avatar_side":"left","vic.premiereStage":"off"};
  for(const[k,v]of Object.entries(values))localStorage.setItem(k,v);
  localStorage.setItem("vic.viewerCompanion",JSON.stringify({version:1,...defaults,enabled:true,roam:false,sleep:true,sound:false,learnFromYou:false,activeWhileVisible:true,heartPrank:false,cardPrank:false,panelPrank:false,rarePrank:false}));
  localStorage.setItem("vic.viewerCompanionCare",JSON.stringify({version:3,...memory,energy:.95,hunger}));
 },{defaults:DEFAULT_COMPANION_PREFERENCES,memory:DEFAULT_COMPANION_MEMORY,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY,hunger});
 await page.goto(surface==="viewer"?"/visual-fixture/poster?avatar=1":"/visual-fixture/studio?role=owner&y=2026&m=10&hour=12&weather=clear");
 await page.bringToFront();await settlePanelLayout(page);await page.evaluate(()=>document.fonts.ready);
 if(surface==="preview"){await page.locator(".io-preview").click();await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();await settlePanelLayout(page);}
 await chooseCompanionPersonality(page,personality);const home=await openCompanionHome(page);await placeCompanionOnHomeFloor(page);return home;
}
async function roam(page:Page) {
 const home=await openCompanionHome(page);await home.getByRole("button",{name:"빅타민 수첩 열기",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"빅타민 수첩",exact:true});
 await dialog.getByRole("tablist",{name:"빅타민 프로필",exact:true}).getByRole("tab",{name:"환경설정",exact:true}).click();
 await dialog.getByRole("tab",{name:"움직임",exact:true}).click();await dialog.locator('[data-act="companion-roam"]').setChecked(true);
 await dialog.getByRole("button",{name:"닫기",exact:true}).click();await page.mouse.move(2,2);
}
for(const surface of ["viewer","studio","preview"] as const)test(`146 ${surface} tidy carries all four same physical toys into the box before leisure`,async({page})=>{
 const home=await fixture(page,"tidy",surface),button=home.getByRole("button",{name:"장난감 상자 열기",exact:true});
 for(let n=0;n<4;n++){await button.focus();await button.press("Enter");await expect(page.locator(".vc-toy")).toHaveCount(n+1);}
 await expect.poll(()=>page.locator('.vc-toy[data-falling="false"]').count()).toBe(4);
 const ids=await page.locator(".vc-toy").evaluateAll(nodes=>nodes.map(n=>(n as HTMLElement).dataset.toyId!));expect(new Set(ids).size).toBe(4);
 const opening=(await home.locator(".vc-toy-box-opening").boundingBox())!;
 await startCompanionQaProbe(page);await roam(page);await expect(page.locator(".vc-toy")).toHaveCount(0,{timeout:110000});
 // DOM removal can precede the next80ms observation. Require that actual
 // post-removal frame instead of racing a stale sample of the fourth carry.
 await expect.poll(async()=>(await samples(page)).some(f=>f.toyPlay?.toys.length===0),{timeout:3000,intervals:[80]}).toBe(true);
 const frames=await samples(page);
 for(const id of ids){
  const carried=frames.filter(f=>f.visible&&f.decoded&&f.toyPlay?.toys.some(t=>t.id===id&&t.carried));
  expect(carried.length,`${id} visibly transported before removal`).toBeGreaterThanOrEqual(2);
  const last=carried.at(-1)!,item=last.toyPlay!.toys.find(t=>t.id===id)!,r=item.rect!;
  expect(Math.hypot(r.x+r.width/2-opening.x-opening.width/2,r.y+r.height-opening.y-opening.height/2),`${id} reaches the real box opening`).toBeLessThan(25);
  expect(frames.some(f=>f.at>last.at&&!f.toyPlay?.toys.some(t=>t.id===id))).toBe(true);
 }
 const first=frames.find(f=>f.toyPlay?.toys.some(t=>t.carried))!;
 expect(frames.filter(f=>f.at>first.at&&f.toyPlay?.toys.length&&f.scene==="T01"&&f.command==="pose").length,"remaining chores do not stop for repeated T01 grooming/bows").toBe(0);
});
for(const personality of COMPANION_PERSONALITIES.filter(p=>p!=="homebody"))test(`146 ${personality} actually lives on the public calendar across a continuous active sequence`,async({page})=>{
 await fixture(page,personality);await startCompanionQaProbe(page);await roam(page);
 await expect.poll(async()=>{
  const f=await samples(page);return f.filter(s=>s.visible&&s.decoded&&!/^companion-home/.test(s.platform)&&(s.walkSource||s.jumpSource));
 },{timeout:personality==="sleepy"?95000:75000,intervals:[500]}).not.toHaveLength(0);
 const before=(await samples(page)).at(-1)!.at;
 await expect.poll(async()=>(await samples(page)).at(-1)!.at-before,{timeout:18000,intervals:[500]}).toBeGreaterThanOrEqual(12000);
 const frames=await samples(page),publicMoves=frames.filter(f=>f.visible&&f.decoded&&!/^companion-home/.test(f.platform)&&(f.walkSource||f.jumpSource));
 expect(publicMoves.length).toBeGreaterThanOrEqual(5);
 expect(Math.max(...publicMoves.map(f=>f.x))-Math.min(...publicMoves.map(f=>f.x))+Math.max(...publicMoves.map(f=>f.y))-Math.min(...publicMoves.map(f=>f.y))).toBeGreaterThan(48);
 const first=publicMoves[0],next=frames.filter(f=>f.at>=first.at&&f.at<=first.at+10000&&f.eligible);
 // A sleepy pet may legitimately nap after the real outing. Its ordinary
 // need is recorded, never counted as active outdoor coverage for others.
 const resting=personality==="sleepy"&&next.some(f=>f.state==="sleep"||(typeof f.energy==="number"&&f.energy<=.55));
 if(!resting){
  const publicActive=next.filter(f=>!/^companion-home/.test(f.platform)&&(f.walkSource||f.jumpSource));
  expect(publicActive.length,"an outside arrival continues with actual decoded locomotion").toBeGreaterThanOrEqual(8);
  expect(next.filter(f=>f.platform==="companion-home"&&f.state!=="jump").length,"does not reset to sofa between outside activities").toBe(0);
 }
});
test("146 gourmet commits to one real meal instead of walking between several food goals",async({page})=>{
 const home=await fixture(page,"gourmet","viewer",.7),button=home.getByRole("button",{name:"밥 꺼내기",exact:true});
 for(let n=0;n<3;n++){await button.focus();await button.press("Enter");await expect(page.locator(".vc-food")).toHaveCount(n+1);}
 await expect(page.locator(".vc-food[data-falling]")).toHaveCount(0);
 const foodIds=await page.locator(".vc-food").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.food!));
 expect(new Set(foodIds).size).toBe(3);
 const foodIdsIn=(frame:QaObservation)=>(frame.items??"").split("|")[0].split(",").filter(Boolean);
   // A real authored meal owns its same physical item before the ordinary
   // brain starts an eating episode. Read both actual ownership channels;
   // retain unknown/conflicting IDs so a target switch cannot disappear.
   const mealOwners=new Set(["routine-meal",...COMPANION_PERSONALITY_SCENES.filter(recipe=>recipe.steps.some(step=>step.kind==="food"&&step.mode==="eat")).map(recipe=>recipe.id)]);
   const goalsIn=(frame:QaObservation)=>[frame.goal,frame.command==="food"&&mealOwners.has(frame.scene)?frame.sceneItemId:undefined].filter((id):id is string=>Boolean(id));
 await startCompanionQaProbe(page);await roam(page);
 // A stopped-roam eat sprite can precede the real outing. Start from the
 // observed enabled session, then require a newly acquired physical target.
 await expect.poll(async()=>(await samples(page)).some(f=>f.roam===true&&f.eligible&&f.visible&&f.decoded&&f.state==="eat"&&foodIds.includes(f.goal??"")),{timeout:80000,intervals:[500]}).toBe(true);
 const observed=await samples(page),roamIndex=observed.findIndex(f=>f.roam===true&&f.eligible);
 expect(roamIndex).toBeGreaterThanOrEqual(0);
   const active=observed.slice(roamIndex),acquired=active.find(f=>goalsIn(f).some(id=>foodIds.includes(id))),firstEat=active.find(f=>f.eligible&&f.visible&&f.decoded&&f.state==="eat"&&foodIds.includes(f.goal??""));
 expect(acquired).toBeTruthy();expect(firstEat).toBeTruthy();
   const goal=goalsIn(acquired!)[0];
   expect(active.some(f=>f.at<acquired!.at&&goalsIn(f).length===0),"roam begins before the food goal is acquired").toBe(true);
 expect(firstEat!.at,"acquisition precedes the actual meal").toBeGreaterThan(acquired!.at);
 expect(firstEat!.goal,"the approached food is the food actually eaten").toBe(goal);
   const commitment=active.filter(f=>f.at<=firstEat!.at),goals=new Set(commitment.flatMap(goalsIn));
 expect(goals.size,"one committed physical food before the first actual meal").toBe(1);
   expect(commitment.some(f=>{
    const step=COMPANION_PERSONALITY_SCENES.find(recipe=>recipe.id===f.scene)?.steps[Number(f.beat)];
    return (f.command==="compare"||f.command==="food"&&step?.kind==="food"&&step.mode==="compare")&&(f.walkSource||f.jumpSource);
   }),"comparison cannot create a second travel destination").toBe(false);
 expect(commitment.filter(f=>f.at>=acquired!.at).every(f=>foodIdsIn(f).includes(goal)),"the same physical food stays present throughout approach").toBe(true);
   const travel=commitment.filter(f=>goalsIn(f).includes(goal)&&f.visible&&f.decoded&&(f.walkSource||f.jumpSource));
 expect(travel.length,"a decoded approach to the committed food is observed").toBeGreaterThanOrEqual(2);
 expect(Math.max(...travel.map(f=>f.x))-Math.min(...travel.map(f=>f.x))+Math.max(...travel.map(f=>f.y))-Math.min(...travel.map(f=>f.y)),"the approach actually changes the actor's painted position").toBeGreaterThan(4);
 await expect.poll(()=>page.locator(".vc-food").evaluateAll((nodes,id)=>nodes.some(node=>(node as HTMLElement).dataset.food===id),goal),{timeout:25000,intervals:[250]}).toBe(false);
 // Removal and the following action must also reach the read-only trace;
 // an eat label or one stale eating sprite is not completion evidence.
 await expect.poll(async()=>(await samples(page)).some(f=>f.at>firstEat!.at&&!foodIdsIn(f).includes(goal)&&f.roam===true&&f.eligible&&f.visible&&f.decoded&&f.sourceClipMeasured&&f.paintedSource?.passed&&f.state!=="eat"&&f.state!=="idle"&&!f.wash?.row9),{timeout:12000,intervals:[250]}).toBe(true);
 const frames=await samples(page),removed=frames.find(f=>f.at>firstEat!.at&&!foodIdsIn(f).includes(goal));expect(removed).toBeTruthy();
 const eating=frames.filter(f=>f.at>=firstEat!.at&&f.at<removed!.at&&f.eligible&&f.visible&&f.decoded&&f.state==="eat");
 expect(eating.length,"the same-ID meal has a nonempty decoded eating interval").toBeGreaterThanOrEqual(2);
 expect(eating.every(f=>f.goal===goal)).toBe(true);
 expect(eating.some(f=>f.wash?.row9),"the actual eating source is painted before physical consumption").toBe(true);
});
