import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
const output=process.env.COMPANION161_PET_OUTPUT??".scratch-pw/expressions161-pet";
const fonts=new Set([...readFileSync(resolve("app/fonts.css"),"utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(x=>x[1]));
test.use({viewport:{width:1473,height:945},storageState:{cookies:[],origins:[]},serviceWorkers:"block"});
for(const surface of ["viewer","studio","preview"] as const)for(const input of ["keyboard","pointer"] as const)test(`161 ${surface} ${input} petting keeps face and eyewear in the unchanged material plane`,async({page,context,baseURL})=>{
 const errors:string[]=[],rejected:string[]=[],origin=new URL(baseURL!).origin;page.on("pageerror",e=>errors.push(e.message));
 const manifest=JSON.parse(readFileSync(resolve(".next/server/server-reference-manifest.json"),"utf8")).node as Record<string,{exportedName?:string}>,previews=new Set(Object.entries(manifest).filter(([,a])=>a.exportedName==="getPublicPreviewAction").map(([id])=>id));
 await context.route("**/*",route=>{const req=route.request(),url=new URL(req.url());if(req.resourceType()==="font")return fulfillReadOnlyFont(route,fonts,rejected);
  if(url.origin===origin&&req.method()==="POST"&&url.pathname==="/visual-fixture/studio"&&previews.has(req.headers()["next-action"]))return route.fulfill({contentType:"text/x-component",body:`0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n`});
  if(url.origin!==origin||!["GET","HEAD"].includes(req.method())){rejected.push(req.method()+" "+url.pathname);return route.abort();}if(url.pathname.startsWith("/api/"))return route.fulfill({json:{isLive:false}});return route.continue();});
 await page.addInitScript(({prefs,care,epoch,key})=>{for(const[k,v]of Object.entries({[key]:epoch,"vic.viewerCompanion":JSON.stringify({version:1,...prefs,enabled:true,roam:false,feeding:false,sleep:false,petting:true,personality:"affectionate",personalitySource:"manual",learnFromYou:false}),"vic.viewerCompanionCare":JSON.stringify({version:3,...care,hunger:.1,energy:.95}),"vic.gfxPref":"max","vic.gfx":JSON.stringify({mode:"full",v:3,at:Date.now()}),"vic.reduceMotion":"off","vic.sound":"off","vic.ambient":"off","vic.dark":"off","vic.premiereStage":"off"}))localStorage.setItem(k,v);
  localStorage.setItem("vic.viewerCompanionCollection",JSON.stringify({version:1,foods:[],behaviors:[],situations:[],gifts:{unlocked:["round-glasses"],equipped:"round-glasses",pending:null}}));
 },{prefs:DEFAULT_COMPANION_PREFERENCES,care:DEFAULT_COMPANION_MEMORY,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY});
 await page.goto(surface==="viewer"?"/visual-fixture/poster?avatar=1":"/visual-fixture/studio?role=owner&y=2025&m=10");await page.bringToFront();await settlePanelLayout(page);
 if(surface==="preview"){await page.locator(".io-preview").click();await settlePanelLayout(page);}
 await openCompanionHome(page);await placeCompanionOnHomeFloor(page);await page.mouse.move(2,2);
 const actor=page.getByRole("button",{name:"빅타민 · 쓰다듬고 옮기기",exact:true}),pet=page.locator('.vc-companion'),glasses=pet.locator('.vc-wearable-front');
 if(surface==="viewer"&&input==="keyboard"){const seat=(await page.locator('.vc-home-cushion').boundingBox())!;await actor.focus();await actor.press("p");await page.mouse.click(seat.x+seat.width/2,seat.y+seat.height/2);await page.mouse.move(2,2);await expect(pet).toHaveAttribute("data-platform","companion-home");}
 await expect(pet).toHaveAttribute("data-accessory","round-glasses");const beforeWidth=await glasses.evaluate(n=>parseFloat((n as HTMLElement).style.width));
 // Observe the finite face during the actual input. Reading only after
 // several async assertions can legitimately sample its neutral recovery.
 await page.evaluate(()=>{const frames: {expression:string; width:number;canvas:number[];area:number;spriteVisibility:string}[]=[];let raf=0;const tick=()=>{const n=document.querySelector<HTMLElement>('.vc-companion'),front=n?.querySelector<HTMLElement>('.vc-wearable-front'),canvas=n?.querySelector<HTMLCanvasElement>('.vc-expression-face'),pose=n?.querySelector<HTMLElement>('.vc-pose');if(n?.dataset.expression&&/shy|melt|greeting/.test(n.dataset.expression)&&front&&canvas&&!canvas.hidden&&pose){const m=new DOMMatrixReadOnly(getComputedStyle(pose).transform);frames.push({expression:n.dataset.expression,width:parseFloat(front.style.width),canvas:[canvas.width,canvas.height],area:m.a*m.d-m.b*m.c,spriteVisibility:getComputedStyle(n.querySelector('.vc-sprite')!).visibility});}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);(window as Window&{petProof163?:{frames:typeof frames;stop:()=>void}}).petProof163={frames,stop(){cancelAnimationFrame(raf);}};});
 if(input==="keyboard"){await actor.focus();await actor.press("Enter");}
 else{const r=(await actor.boundingBox())!;for(let i=0;i<18;i++){await page.mouse.move(r.x+r.width*(i%2?.35:.65),r.y+r.height*.52,{steps:3});await page.waitForTimeout(55);if(/shy|melt|greeting/.test(await pet.getAttribute("data-expression")??""))break;}}
 await expect.poll(()=>page.evaluate(()=>(window as Window&{petProof163?:{frames:unknown[]}}).petProof163?.frames.length??0),{timeout:5000}).toBeGreaterThan(0);await page.waitForTimeout(150);
 const frames=await page.evaluate(()=>{const probe=(window as Window&{petProof163?:{frames:{expression:string;width:number;canvas:number[];area:number;spriteVisibility:string}[];stop:()=>void}}).petProof163!;probe.stop();return probe.frames;});
 expect(frames.length).toBeGreaterThan(2);for(const proof of frames){expect(proof.canvas).toEqual([192,192]);expect(proof.spriteVisibility).toBe("hidden");expect(Math.abs(proof.area-1)).toBeLessThan(.002);expect(proof.width/beforeWidth).toBeGreaterThan(.88);expect(proof.width/beforeWidth).toBeLessThan(1.12);}
 mkdirSync(output,{recursive:true});await page.screenshot({path:resolve(output,`${surface}-${input}.png`)});writeFileSync(resolve(output,`${surface}-${input}.json`),JSON.stringify({frames,beforeWidth,errors,rejected,scope:"Frame observations during real keyboard/hover input with synthetic owned glasses; original material plane, no injected expression or runtime state. Still capture can show finite neutral recovery; trace/video preserve the actual sequence."},null,2));expect(errors).toEqual([]);expect(rejected).toEqual([]);
});
