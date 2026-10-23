import { companionTraceMode } from "./helpers/companion-evidence-policy";
import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { analyzeSofaScroll143, SOFA_SCROLL_143_TITLE, SOFA_SCROLL_156_SOURCES } from "../../scripts/companion-qa/sofa-render-156.mjs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_NAMES } from "@/lib/ui/viewer-companion/preferences";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionAccessoryPlacement } from "@/lib/ui/viewer-companion/accessory";
import { COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { COMPANION_TV_SCREEN_CLIP, COMPANION_TV_SCREEN_TRANSFORM } from "@/lib/ui/viewer-companion/home-tv-art";
import { enableCompanion143Diagnostics, readCompanion143Diagnostics } from "./helpers/companion-qa";

const output = process.env.COMPANION143_OUTPUT ?? ".scratch-pw/companion-143/native";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Probe = { frames: unknown[]; overflow: boolean; stop: () => void };
type ProbeWindow = Window & { living143?: Probe };
const errors = new WeakMap<Page, { errors: string[]; rejected: string[] }>();
type SofaProof156 = { build: string; sourceDigest: string; sourceFiles: {path:string;sha256:string}[];
  chunks: {path:string;served:string;local:string}[]; pending: Promise<void>[];
  paintSamples:{name:string;sha256:string;beforeAt:number;afterAt:number;pixelWidth:number;pixelHeight:number}[] };
const sofaProofs = new WeakMap<Page,SofaProof156>();
const sofaWindows = new WeakMap<Page,{began:number;ended:number;dimensions:{client:number;full:number;overflow:string}}>();
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
test.use({ viewport: { width: 1920, height: 850 }, deviceScaleFactor:1, serviceWorkers: "block",
  trace:companionTraceMode(),video:{mode:"on",size:{width:1920,height:850}} });
test.setTimeout(100_000);
test.beforeEach(async ({ page, context, baseURL }, info) => {
  await enableCompanion143Diagnostics(page);
  const proof = { errors: [] as string[], rejected: [] as string[] }; errors.set(page, proof);
  const origin = new URL(baseURL!).origin;
  if(info.title===SOFA_SCROLL_143_TITLE){
    const bindingPath=process.env.COMPANION156_SOURCE_FREEZE;
    if(!bindingPath)throw Error("Exact new source-freeze.json is required for resident-sofa certification");
    const freeze=JSON.parse(readFileSync(bindingPath,"utf8")) as {contentDigest:string;sourceFiles:{path:string;sha256:string}[]};
    if(!/^[a-f0-9]{64}$/.test(freeze.contentDigest)||sha256(JSON.stringify(freeze.sourceFiles))!==freeze.contentDigest)throw Error("Invalid frozen source digest");
    const sourceFiles=SOFA_SCROLL_156_SOURCES.map((path:string)=>{
      const actual=sha256(readFileSync(resolve(path))),expected=freeze.sourceFiles.find(entry=>entry.path===path);
      if(!expected||actual!==expected.sha256)throw Error("Frozen sofa source mismatch");
      return {path,sha256:actual};
    });
    const buildRoot=process.env.VISUAL_TEST_BUILD_DIR??".next";
    const bound:SofaProof156={build:readFileSync(resolve(buildRoot,"BUILD_ID"),"utf8").trim(),sourceDigest:freeze.contentDigest,sourceFiles,chunks:[],pending:[],paintSamples:[]};
    sofaProofs.set(page,bound);
    page.on("response",response=>{
      const url=new URL(response.url());if(url.origin!==origin||!url.pathname.startsWith("/_next/static/")||!/\.(?:js|css)$/.test(url.pathname))return;
      bound.pending.push((async()=>{const bytes=await response.body(),local=readFileSync(resolve(buildRoot,url.pathname.slice("/_next/".length)));
        bound.chunks.push({path:url.pathname,served:sha256(bytes),local:sha256(local)});
      })().catch(error=>{proof.errors.push("Sofa chunk proof: "+String(error));}));
    });
  }
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string,{exportedName?:string}>;
  const previews = new Set(Object.entries(actions).filter(([,entry])=>entry.exportedName==="getPublicPreviewAction").map(([id])=>id));
  page.on("pageerror", error => proof.errors.push(error.message));
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.resourceType() === "font" && url.origin !== origin) return fulfillReadOnlyFont(route, fonts, proof.rejected);
    if(url.origin===origin && request.method()==="POST" && url.pathname==="/visual-fixture/studio" && previews.has(request.headers()["next-action"]))return route.fulfill({contentType:"text/x-component",body:`0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n`});
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live APIs in native fixture" });
    return route.continue();
  });
  await page.addInitScript(({ epoch, epochKey, preferences, memory, collectionKey, eyewear, moving }) => {
    const values = { [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({mode:"full",at:Date.now(),v:3}), "vic.sound":"off", "vic.ambient":"off", "vic.dark":"on", "vic.reduceMotion":"off", "vic_avatar_side":"left", "vic.premiereStage":"off", "vic.viewerCompanion":JSON.stringify({version:1,...preferences,personality:"homebody",personalitySource:"manual",roam:false,sleep:false,activeWhileVisible:true,enabled:true,heartPrank:false,cardPrank:false,panelPrank:false,rarePrank:false}), "vic.viewerCompanionCare":JSON.stringify({version:3,...memory,energy:.9,hunger:.1}) };
    for (const [key,value] of Object.entries(values)) localStorage.setItem(key,value);
    if(eyewear)localStorage.setItem(collectionKey,JSON.stringify({version:1,foods:[],behaviors:[],situations:[],gifts:{pending:null,unlocked:["round-glasses"],equipped:"round-glasses",activeMs:0,interactionCredit:0}}));
    if(moving){const selected=JSON.parse(localStorage.getItem("vic.viewerCompanion")!);localStorage.setItem("vic.viewerCompanion",JSON.stringify({...selected,roam:true}));}
  }, {epoch:SETTINGS_EPOCH,epochKey:SETTINGS_EPOCH_KEY,preferences:DEFAULT_COMPANION_PREFERENCES,memory:DEFAULT_COMPANION_MEMORY,collectionKey:COMPANION_COLLECTION_KEY,eyewear:info.title.includes("actual indoor pet"),moving:info.title.includes("sofa stays aligned")});
});
for (const surface of ["viewer","studio","preview"] as const) test(`143 ${surface} room items follow independent light and five local TV pictures`,async({page})=>{
  await page.goto(surface==="viewer"?"/visual-fixture/poster?avatar=1":"/visual-fixture/studio?role=owner&y=2026&m=6&hour=21&weather=clear");
  await page.bringToFront();await settlePanelLayout(page);
  if(surface==="preview"){await page.locator(".io-preview").click();await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();await settlePanelLayout(page);}
  const home=await openCompanionHome(page);await expect(page.locator(".vc-companion")).toBeVisible();
  const invoke=async(selector:string)=>{await home.locator(selector).focus();await page.keyboard.press("Enter");};
  const room=home.locator(".vc-home-room"),lamp=home.locator(".vc-home-lamp");
  if(await lamp.getAttribute("aria-pressed")==="true")await invoke(".vc-home-lamp");
  for(let i=0;i<3 && await home.locator(".vc-home-window").getAttribute("data-curtain")!=="closed";i++)await invoke(".vc-curtain-control");
  const before=await room.getAttribute("data-lamp-lit");await invoke(".vc-curtain-control");await page.waitForTimeout(250);
  expect(await room.getAttribute("data-lamp-lit")).toBe(before);
  await invoke(".vc-curtain-control");await invoke(".vc-curtain-control");
  await invoke(".vc-dispenser");await invoke(".vc-toy-box");
  const food=page.locator(".vc-food"),toy=page.locator(".vc-toy");await expect(food).toHaveCount(1);await expect(toy).toHaveCount(1);
  await expect(food).not.toHaveAttribute("data-falling");await expect(toy).toHaveAttribute("data-falling","false");
  const light=(node:typeof food)=>node.evaluate(el=>Number(getComputedStyle(el).getPropertyValue("--vc-item-room-light")));
  await expect.poll(()=>light(food)).toBeLessThan(1);await expect.poll(()=>light(toy)).toBeLessThan(1);
  const roomBounds=(await room.boundingBox())!;
  for(const item of [food,toy]){
    const b=(await item.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height-5);await page.mouse.down();
    await page.mouse.move(Math.min(1200,roomBounds.x+roomBounds.width+350),Math.min(700,roomBounds.y+roomBounds.height+80),{steps:15});
    await expect.poll(()=>light(item)).toBe(1);await page.mouse.up();await page.mouse.move(2,2);
  }
  const curtain=await home.locator(".vc-home-window").getAttribute("data-curtain");await invoke(".vc-home-lamp");
  expect(await home.locator(".vc-home-window").getAttribute("data-curtain")).toBe(curtain);
  for(const channel of ["tori","nature","cooking","toys","moon"]){
    await invoke(".vc-home-tv");await expect(room).toHaveAttribute("data-tv",channel);
    const picture=home.locator(`.vc-tv-picture[data-channel="${channel}"]`);await expect(picture).toBeVisible();
    expect(await picture.locator("img").evaluate(async(image:HTMLImageElement)=>{await image.decode();return image.complete&&image.naturalWidth>0;})).toBe(true);
    expect(await picture.locator("img").getAttribute("src")).toMatch(/^\/companion\/home\/(135|143)\/tv-screen-/);
    const bounds=(await picture.boundingBox())!;expect(bounds.width).toBeGreaterThan(10);expect(bounds.height).toBeGreaterThan(10);
    await expect(home.locator(".vc-home-tv-projection clipPath path")).toHaveAttribute("d",COMPANION_TV_SCREEN_CLIP);
    const projection=await home.locator(".vc-home-tv-screen").evaluate((node,expected)=>{
      // CSSOM normalizes number precision and exponent notation. Compare the
      // actual declaration with the same immutable projection parsed by this
      // browser; no geometric tolerance or different plane is accepted.
      const reference=document.createElement("div").style;reference.transform=expected;
      return {actual:(node as HTMLElement).style.transform,expected:reference.transform};
    },COMPANION_TV_SCREEN_TRANSFORM);
    expect(projection.actual).toBe(projection.expected);
    await expect.poll(()=>picture.evaluate(node=>node.getAnimations({subtree:true}).filter(a=>a.playState==="running"&&a.effect?.getTiming().iterations===Infinity).length)).toBeGreaterThan(0);
  }
  await page.getByRole("button",{name:"설정",exact:true}).click();
  const settings=page.getByRole("dialog",{name:"설정",exact:true});
  await settings.getByRole("tablist",{name:"설정 묶음",exact:true}).getByRole("tab",{name:"움직임",exact:true}).click();
  await settings.getByRole("switch",{name:"생동감 있는 동작 켜기/끄기",exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion","1");
  await settings.getByRole("button",{name:"닫기",exact:true}).click();await expect(settings).toBeHidden();
  await expect(home.locator('.vc-tv-picture[data-channel="moon"]')).toBeVisible();
  expect(await home.locator(".vc-tv-picture").evaluate(node=>node.getAnimations({subtree:true}).filter(a=>a.playState==="running"&&a.effect?.getTiming().iterations===Infinity).length)).toBe(0);
  await invoke(".vc-home-tv");await expect(room).toHaveAttribute("data-tv","off");await expect(home.locator(".vc-tv-picture")).toHaveCount(0);
});
for(const personality of COMPANION_PERSONALITIES)test(`143 ${personality} actual indoor pet has a finite personal response`,async({page})=>{
  await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6&hour=12&weather=clear");await page.bringToFront();await settlePanelLayout(page);
  const home=await openCompanionHome(page);await home.locator('[data-act="companion-personality-open"]').click();
  const dialog=page.getByRole("dialog",{name:"빅타민 수첩",exact:true});await dialog.getByRole("radiogroup",{name:"빅타민 성격",exact:true}).getByRole("radio",{name:COMPANION_PERSONALITY_NAMES[personality],exact:true}).click();
  await dialog.getByRole("button",{name:"닫기",exact:true}).click();await placeCompanionOnHomeFloor(page);
  const actor=page.locator(".vc-companion"),button=actor.locator(".vc-actor");
  const inspectGlasses=async(label:string)=>{
    await expect(actor).toHaveAttribute("data-accessory","round-glasses");await expect(actor.locator(".vc-wearable-front")).toBeVisible();
    const observed=await actor.evaluate(node=>({pose:Number((node as HTMLElement).dataset.pose),width:Number.parseFloat((node.querySelector<HTMLElement>(".vc-wearable-front")!).style.width),image:getComputedStyle(node.querySelector(".vc-wearable-front")!).backgroundImage}));
    const placement=companionAccessoryPlacement(selectCompanionSprite(observed.pose),"round-glasses")!;
    expect(placement,label+" actual registered pose").not.toBeNull();
    expect(observed.width,label+" actual worn frame nominal scale").toBeCloseTo(placement.width*placement.art.width/placement.art.content.width/80*100,3);
    expect(observed.image).toContain(placement.art.src);
    await page.screenshot({path:resolve(output,`143-${personality}-glasses-${label}.png`)});
  };
  await inspectGlasses("standing");await startProbe(page);await button.focus();await button.press("Enter");
  await expect(actor).toHaveAttribute("data-state","petted");
  await expect.poll(()=>actor.evaluate((node,{poses,sources})=>{
    const pose=Number((node as HTMLElement).dataset.pose),texture=node.querySelector<HTMLImageElement>(".vc-texture");
    return poses.includes(pose)&&Boolean(texture?.complete&&texture.naturalWidth&&new URL(texture.currentSrc,location.href).pathname===sources[pose]);
  },{poses:companionSpriteMetadata.rows[9],sources:Object.fromEntries(companionSpriteMetadata.rows[9].map(pose=>[pose,selectCompanionSprite(pose).src]))}),{timeout:5000,intervals:[50]}).toBe(true);await inspectGlasses("happy");
  const responses={performer:"bow",curious:"sniff",affectionate:"lean-nuzzle",sleepy:"stretch",tidy:"groom",mischievous:"pounce",gourmet:"sniff",homebody:"groom",balanced:"bow"} as const;
  const response=responses[personality];
  await expect.poll(async()=>actor.evaluate((node,{response,rows,timing})=>{
    const pose=Number((node as HTMLElement).dataset.pose),state=(node as HTMLElement).dataset.state;
    const texture=node.querySelector<HTMLImageElement>(".vc-texture");if(!texture?.complete||!texture.naturalWidth)return false;
    if(response==="sniff")return state==="sniff"&&rows[1].includes(pose);
    if(response==="stretch")return state==="stretch"&&rows[16].includes(pose);
    return state==="play"&&(node as HTMLElement).dataset.play===response&&timing[response]?.beats.some(beat=>rows[beat.row].includes(pose));
  },{response,rows:companionSpriteMetadata.rows,timing:COMPANION_PLAY_TIMING}),{timeout:7000,intervals:[50]}).toBe(true);
  await inspectGlasses("response");
  await expect(actor).toHaveAttribute("data-platform",/^companion-home-floor/);
});
test.afterEach(async ({ page }, info) => {
  const capture = await page.evaluate(() => { const p=(window as ProbeWindow).living143;p?.stop();return {frames:p?.frames??[],overflow:p?.overflow??false}; }).catch(()=>({frames:[],overflow:true}));
  const frames=capture.frames;
  const diagnostics143=await readCompanion143Diagnostics(page).catch(()=>[]);
  mkdirSync(output,{recursive:true});const name=info.title.replace(/[^a-z0-9]+/gi,"-");
  writeFileSync(resolve(output,name+".json"),JSON.stringify({...errors.get(page),frames,diagnostics143,status:info.status,scope:"Actual production fixture, native pointer/keyboard/wheel and read-only rAF samples. Initial synthetic preferences/care and an owned round-glasses collection fixture only; no clock/geometry/RNG/brain override."},null,2));
  await page.screenshot({path:resolve(output,name+".png")}).catch(()=>{});
  const sofaWindow=sofaWindows.get(page),bound=sofaProofs.get(page);
  if(info.title===SOFA_SCROLL_143_TITLE&&sofaWindow&&bound){
    await Promise.all(bound.pending);
    const {pending,...binding}=bound;void pending;
    const observationWindow={began:sofaWindow.began,ended:sofaWindow.ended};
    const base={schemaVersion:1,kind:"companion-sofa-scroll-156",caseTitle:info.title,buildId:bound.build,...binding,
      status:info.status,errors:errors.get(page)!.errors,rejected:errors.get(page)!.rejected,observationWindow,dimensions:sofaWindow.dimensions,
      frames,probeStopped:true,probeOverflow:capture.overflow,totalCapturedFrames:frames.length,deviceScaleFactor:await page.evaluate(()=>devicePixelRatio),
      videoSize:{width:1920,height:850},renderThresholdCssPx:1};
    const measured=analyzeSofaScroll143(base);
    const file=resolve(output,name+"-actual-sofa-scroll-156.json");
    writeFileSync(file,JSON.stringify({...base,admissionStatus:info.status==="passed"&&measured.admissionPassed&&!base.errors.length&&!base.rejected.length?"passed":"failed",
      renderedStatus:measured.candidates.length?"needs_render_review":"no_candidate_observed",renderCandidates:measured.candidates,measurement:measured.summary,
      scope:"All original prepaint frame measurements plus actual scroll/post-rAF timer phases retained. Timers and DOM admission do not certify paint. Every >=1CSSpx front/size or body-relative-span candidate remains needs_render_review. Three fresh non-author, case/build/raw/source-bound assessments of the original 1:1 trace AND video are mandatory, including a run with no DOM candidate. The original one-pixel painted criterion and every missing/hidden/depth/support/stack/scroll denominator remain hard gates."},null,2),{flag:"wx"});
    await info.attach("actual-sofa-scroll-156",{path:file,contentType:"application/json"});
    expect(measured.issues,"resident visibility, ownership, capture and actual wheel admission").toEqual([]);
    expect(bound.chunks.length).toBeGreaterThan(0);expect(bound.chunks.every(chunk=>chunk.served===chunk.local)).toBe(true);
  }
  expect(errors.get(page)!.errors).toEqual([]);expect(errors.get(page)!.rejected).toEqual([]);
});
async function startProbe(page: Page, mixedPhases=false) {
  await page.evaluate(mixedPhases => {
    (window as ProbeWindow).living143?.stop();let raf=0,stopped=false,overflow=false;
    const timers=new Set<number>(),frames:unknown[]=[];const read=(phase:"scroll"|"frame"|"post-render")=>{
      if(stopped)return;
      const pet=document.querySelector<HTMLElement>(".vc-companion"),bed=document.querySelector(".vc-plush-bed"),front=document.querySelector<HTMLElement>(".vc-bed-foreground"),room=document.querySelector<HTMLElement>(".vc-home-room");
      const rect=(node:Element|null)=>{const r=node?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
      const painted=(node:HTMLElement|null)=>{if(!node||node.hidden)return false;const s=getComputedStyle(node);return s.display!=="none"&&s.visibility==="visible"&&Number(s.opacity)>0;};
      const texture=pet?.querySelector<HTMLImageElement>(".vc-texture");
      if(frames.length>=24000){overflow=true;return;}
      frames.push({phase,sequence:frames.length,nativeActor:pet?.hasAttribute("data-native-sofa")??false,nativeFront:front?.hasAttribute("data-native-sofa")??false,at:performance.now(),working:pet?.hasAttribute("data-working"),petZ:pet?Number(getComputedStyle(pet).zIndex):null,frontZ:front?Number(getComputedStyle(front).zIndex):null,scene:pet?.dataset.personalityScene??"",beat:pet?.dataset.personalityBeat??"",command:pet?.dataset.personalityCommand??"",decoded:Boolean(texture?.complete&&texture.naturalWidth),scrollY,homeScroll:room?.closest<HTMLElement>(".vc-home")?.scrollTop??null,home:rect(room?.closest(".vc-home")??null),cushion:rect(document.querySelector(".vc-home-cushion")),viewport:[innerWidth,innerHeight],pet:rect(pet),petHidden:pet?.hidden??true,petPainted:painted(pet),frontPainted:painted(front),bed:rect(bed),front:rect(front),room:rect(room),platform:pet?.dataset.platform,state:pet?.dataset.state,depth:pet?.dataset.sofaDepth,pose:pet?.dataset.pose,play:pet?.dataset.play,transform:pet?getComputedStyle(pet).transform:null,frontHidden:front?.hidden,frontTransform:front&&getComputedStyle(front).transform,localFrontVisibility:bed?.querySelector(".vc-bed-local-front")?.getAttribute("visibility"),lit:room?.hasAttribute("data-lamp-lit"),curtain:room?.querySelector("[data-curtain]")?.getAttribute("data-curtain"),tv:room?.dataset.tv});
    };
    const onScroll=()=>read("scroll");
    const sample=()=>{if(stopped)return;read("frame");if(mixedPhases){const timer=window.setTimeout(()=>{timers.delete(timer);if(!stopped)read("post-render");},0);timers.add(timer);}raf=requestAnimationFrame(sample);};
    if(mixedPhases)document.addEventListener("scroll",onScroll,true);
    (window as ProbeWindow).living143={frames,get overflow(){return overflow;},stop:()=>{stopped=true;cancelAnimationFrame(raf);timers.forEach(timer=>clearTimeout(timer));timers.clear();document.removeEventListener("scroll",onScroll,true);}};raf=requestAnimationFrame(sample);
  },mixedPhases);
}
test("143 studio sofa stays aligned beside the editor and independent controls",async({page},info)=>{
  const nativePaint=async(name:string,file:string)=>{
    const beforeAt=await page.evaluate(()=>performance.now());
    const bytes=await page.screenshot({path:resolve(output,file),type:"png",scale:"css",animations:"allow"});
    const afterAt=await page.evaluate(()=>performance.now());
    const sample={name,sha256:sha256(bytes),beforeAt,afterAt,pixelWidth:bytes.readUInt32BE(16),pixelHeight:bytes.readUInt32BE(20)};
    sofaProofs.get(page)!.paintSamples.push(sample);
    // Original bytes are attached to this test and embedded by Playwright's
    // trace recorder.800px screencasts are never called1:1 proof.
    await info.attach(name,{path:resolve(output,file),contentType:"image/png"});
  };
  await page.goto("/visual-fixture/studio?role=owner&y=2025&m=10&hour=21&weather=clear");await page.bringToFront();await settlePanelLayout(page);
  const expand=page.getByRole("button",{name:"패널 펼치기",exact:true});if(await expand.isVisible()){await expand.click();await settlePanelLayout(page);}
  await page.mouse.move(1000,500);await page.keyboard.down("Control");
  for(let i=0;i<8;i++){await page.mouse.wheel(0,-200);await page.waitForTimeout(90);}await page.keyboard.up("Control");await settlePanelLayout(page);
  const home=await openCompanionHome(page);await expect(page.locator(".vc-companion")).toBeVisible();await startProbe(page,true);
  // An awake resident may independently switch the lamp on. A real human
  // lamp click owns its existing15s lease, isolating curtain causality while
  // all later autonomous editor and1:1 resident-scroll phases remain intact.
  const lamp=home.locator(".vc-home-lamp"),room=home.locator(".vc-home-room");
  const wasLit=await lamp.getAttribute("aria-pressed")==="true";
  const manualLampAt=await page.evaluate(()=>performance.now());
  await lamp.click();
  const manualLampSamples:{at:number;pressed:string|null;lit:string|null;connected:boolean}[]=[];
  await expect.poll(async()=>{
    const current=await home.evaluate(node=>{
      const button=node.querySelector(".vc-home-lamp"),room=node.querySelector(".vc-home-room");
      return {at:performance.now(),pressed:button?.getAttribute("aria-pressed")??null,lit:room?.getAttribute("data-lamp-lit")??null,connected:Boolean(button?.isConnected&&room?.isConnected)};
    });
    manualLampSamples.push(current);const previous=manualLampSamples.at(-2);
    return Boolean(previous&&current.connected&&previous.connected&&["true","false"].includes(current.pressed??"")
      &&current.pressed===(current.lit==="true"?"true":"false")&&current.pressed===previous.pressed&&current.lit===previous.lit
      &&current.at-previous.at>=35&&current.at-previous.at<=180);
  },{timeout:3000,intervals:[40]}).toBe(true);
  const before=manualLampSamples.at(-1)!.lit;
  await home.locator(".vc-curtain-control").click();await page.waitForTimeout(500);
  expect(await room.getAttribute("data-lamp-lit")).toBe(before);
  await home.locator(".vc-curtain-control").click();await page.waitForTimeout(500);
  expect(await room.getAttribute("data-lamp-lit")).toBe(before);
  const controlsFinishedAt=await page.evaluate(()=>performance.now());
  expect(controlsFinishedAt-manualLampAt,"both real curtain checks must remain inside the manual-light lease").toBeLessThan(15000);
  await info.attach("143-independent-curtain-manual-lamp",{contentType:"application/json",body:Buffer.from(JSON.stringify({manualLampAt,controlsFinishedAt,wasLit,manualLampSamples,litDuringCurtainChecks:before,manualLeaseMs:15000}))});
  const actualFloorPlacement = await placeCompanionOnHomeFloor(page);
  await info.attach("143-atomic-floor-placement", { contentType: "application/json", body: Buffer.from(JSON.stringify(actualFloorPlacement)) });
  await home.locator(".vc-cushion-button").focus();await page.keyboard.press("Enter");
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform","companion-home",{timeout:20_000});
  await page.mouse.move(900,700);await page.mouse.wheel(0,1700);await page.waitForTimeout(500);await page.mouse.wheel(0,-1700);await page.waitForTimeout(700);
  await home.locator(".vc-cushion-button").focus();await page.keyboard.press("Enter");await page.waitForTimeout(800);
  await page.screenshot({path:resolve(output,"143-baseline-sofa-before-editor.png")});
  const day=page.locator(".studio-day[data-act='calendar-cell']").nth(10);
  const editorBegan=await page.evaluate(()=>performance.now());
  await day.focus();await page.keyboard.press("Enter");await expect(page.getByRole("textbox").first()).toBeVisible();await page.waitForTimeout(900);
  await page.screenshot({path:resolve(output,"143-baseline-sofa-editor.png")});
  await page.mouse.move(1000,700);await page.mouse.wheel(0,1800);await page.waitForTimeout(700);await page.mouse.wheel(0,-1800);await page.waitForTimeout(800);
  const alignment=await page.evaluate(began=>{
    type Row={at:number;working:boolean;platform:string;petPainted:boolean;frontPainted:boolean;petHidden:boolean;frontHidden:boolean;petZ:number;frontZ:number;front:{x:number;y:number;width:number;height:number}|null;bed:{x:number;y:number;width:number;height:number}|null;localFrontVisibility:string|null;depth:string};
    const frames=(window as ProbeWindow).living143?.frames as Row[]??[];
    const visible=frames.filter(f=>!f.petHidden&&!f.frontHidden&&f.front&&f.bed);
    const editor=frames.filter(f=>f.at>=began&&f.working&&f.platform==="companion-home"&&["seat","back"].includes(f.depth));
    return {editorSamples:editor.length,editorHidden:editor.filter(f=>f.petHidden||f.frontHidden||!f.petPainted||!f.frontPainted||!f.front||!f.bed).length,editorWrongStack:editor.filter(f=>f.frontZ<=f.petZ).length,wrongStack:visible.filter(f=>f.frontZ<=f.petZ).length,visible:visible.length,maxOffset:Math.max(0,...visible.map(f=>Math.hypot(f.front!.x-f.bed!.x,f.front!.y-f.bed!.y))),maxSize:Math.max(0,...visible.map(f=>Math.max(Math.abs(f.front!.width-f.bed!.width),Math.abs(f.front!.height-f.bed!.height)))),doubleFront:visible.filter(f=>f.localFrontVisibility!=="hidden").length,wrongDepth:visible.filter(f=>!["seat","back"].includes(f.depth)).length};
  },editorBegan);
  expect(alignment.editorSamples,"actual editor-open working resident is required").toBeGreaterThan(10);expect(alignment.editorHidden).toBe(0);expect(alignment.editorWrongStack).toBe(0);
  expect(alignment.visible,"actual resident masking must be sampled, not an empty trace").toBeGreaterThan(10);
  expect(alignment.maxOffset).toBeLessThan(1);expect(alignment.maxSize).toBeLessThan(1);
  expect(alignment.doubleFront).toBe(0);expect(alignment.wrongDepth).toBe(0);expect(alignment.wrongStack).toBe(0);

  // The rail/document wheel above can leave the fixed room stationary. This
  // is a separate real compact-room scroll, after closing the editor through
  // its native key. Never remove inert to manufacture a combined interaction.
  await page.keyboard.press("Escape");await expect(page.locator(".event-editor-panel")).toBeHidden();
  await page.getByRole("button",{name:"패널 접기",exact:true}).click();await settlePanelLayout(page);
  const compact=await openCompanionHome(page),pet=page.locator(".vc-companion");
  await expect(page.locator(".vc-compact-home .vc-home")).toBeVisible();
  // The preceding editor phase needs real autonomous work. This separate
  // stationary resident phase uses the user's actual roam switch so a valid
  // night-time lamp errand cannot masquerade as a broken seated scroll.
  await compact.locator('[data-act="companion-personality-open"]').click();
  const residentSettings=page.getByRole("dialog",{name:"빅타민 수첩",exact:true});
  await residentSettings.getByRole("tab",{name:"움직임",exact:true}).click();
  await residentSettings.locator('[data-act="companion-roam"]').setChecked(false);
  await residentSettings.getByRole("button",{name:"닫기",exact:true}).click();
  await expect(residentSettings).toBeHidden();
  await placeCompanionOnHomeFloor(page);await compact.locator(".vc-cushion-button").focus();await page.keyboard.press("Enter");
  await expect(pet).toHaveAttribute("data-platform","companion-home",{timeout:20_000});
  await page.setViewportSize({width:1920,height:420});await settlePanelLayout(page);
  await expect(compact).toBeVisible();await expect(pet).toHaveAttribute("data-platform","companion-home");
  await expect(pet).toHaveAttribute("data-native-sofa","");
  await expect(pet).not.toHaveAttribute("data-state",/jump|held/);
  await expect(pet).not.toHaveAttribute("data-home-life",/.+/);
  const dimensions=await compact.evaluate(node=>({client:node.clientHeight,full:node.scrollHeight,overflow:getComputedStyle(node).overflowY}));
  expect(dimensions.full-dimensions.client,"actual compact overflow is required").toBeGreaterThan(5);
  expect(["auto","scroll"]).toContain(dimensions.overflow);
  const box=(await compact.boundingBox())!;
  await page.mouse.move(box.x+box.width*.8,Math.min(418,box.y+box.height*.5));
  await page.mouse.wheel(0,-550);await expect.poll(()=>compact.evaluate(node=>node.scrollTop)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>{
    const bed=document.querySelector(".vc-plush-bed")?.getBoundingClientRect(),front=document.querySelector<HTMLElement>(".vc-bed-foreground");
    const actual=front?.getBoundingClientRect();return Boolean(bed&&actual&&!front?.hidden&&Math.hypot(bed.x-actual.x,bed.y-actual.y)<1);
  })).toBe(true);
  // Start after actual resized geometry has settled, so resize-only deltas
  // cannot serve as evidence for the native wheel or pollute this window.
  const scrollBegan=await page.evaluate(()=>performance.now());
  await nativePaint("sofa143-paint-before","143-sofa-actual-compact-scroll-before.png");
  await page.mouse.wheel(0,550);await expect.poll(()=>compact.evaluate(node=>node.scrollTop)).toBeGreaterThan(5);
  await page.waitForTimeout(500);const scrolled=await compact.evaluate(node=>node.scrollTop);
  await nativePaint("sofa143-paint-down","143-sofa-actual-compact-scroll-down.png");
  await page.mouse.wheel(0,-550);await expect.poll(()=>compact.evaluate(node=>node.scrollTop)).toBeLessThan(scrolled-5);
  await page.waitForTimeout(500);
  await nativePaint("sofa143-paint-up","143-sofa-actual-compact-scroll-up.png");
  const scrollProof=await page.evaluate(began=>{
    type Rect={x:number;y:number;width:number;height:number};
    type Row={at:number;homeScroll:number|null;viewport:[number,number];room:Rect|null;home:Rect|null;cushion:Rect|null;petHidden:boolean;frontHidden:boolean;petPainted:boolean;frontPainted:boolean;pet:Rect|null;front:Rect|null;bed:Rect|null;localFrontVisibility:string|null;depth:string;platform:string};
    const frames=((window as ProbeWindow).living143?.frames as Row[]??[]).filter(f=>f.at>=began);
    const positive=(r:Rect|null)=>Boolean(r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0);
    const hasSurface=(f:Row)=>positive(f.room)&&positive(f.home)&&positive(f.bed)&&positive(f.cushion)&&f.homeScroll!==null&&Number.isFinite(f.homeScroll)&&f.viewport?.length===2&&f.viewport.every(n=>Number.isFinite(n)&&n>0);
    const contains=(r:Rect,x:number,y:number)=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;
    // The expected resident's actual seat, not actor/front visibility, owns
    // eligibility. Hidden/missing actors or front masks cannot remove rows.
    const eligible=frames.filter(f=>{
      if(!hasSurface(f))return false;
      const x=f.cushion!.x+f.cushion!.width/2,y=f.cushion!.y+f.cushion!.height/2;
      return x>=0&&x<=f.viewport[0]&&y>=0&&y<=f.viewport[1]&&contains(f.room!,x,y)&&contains(f.home!,x,y);
    });
    const missingActor=eligible.filter(f=>!positive(f.pet)).length,hiddenActor=eligible.filter(f=>f.petHidden||!f.petPainted).length;
    const missingFront=eligible.filter(f=>!positive(f.front)).length,hiddenFront=eligible.filter(f=>f.frontHidden||!f.frontPainted).length;
    const visible=eligible.filter(f=>positive(f.pet)&&positive(f.front)&&!f.petHidden&&!f.frontHidden&&f.petPainted&&f.frontPainted);
    const span=(values:number[])=>values.length?Math.max(...values)-Math.min(...values):0;
    return {began,ended:performance.now(),totalFrames:frames.length,eligible:eligible.length,missingSurface:frames.filter(f=>!hasSurface(f)).length,missingActor,hiddenActor,missingFront,hiddenFront,samples:visible.length,scrollSpan:span(eligible.map(f=>f.homeScroll!)),bedSpan:span(eligible.map(f=>f.bed!.y)),footRelativeSpan:span(visible.map(f=>f.pet!.y+f.pet!.height-f.bed!.y)),maxOffset:Math.max(0,...visible.map(f=>Math.hypot(f.front!.x-f.bed!.x,f.front!.y-f.bed!.y))),maxSize:Math.max(0,...visible.map(f=>Math.max(Math.abs(f.front!.width-f.bed!.width),Math.abs(f.front!.height-f.bed!.height)))),doubleFront:visible.filter(f=>f.localFrontVisibility!=="hidden").length,wrongDepth:visible.filter(f=>!["seat","back"].includes(f.depth)).length,wrongSupport:eligible.filter(f=>f.platform!=="companion-home").length};
  },scrollBegan);
  writeFileSync(resolve(output,"143-sofa-actual-compact-scroll-proof.json"),JSON.stringify({dimensions,scrolled,...scrollProof,scope:"Actual compact-room wheel after native editor close; old14 measured44px, current layout must prove its own nonzero distance. Editor-open inert scroll remains excluded."},null,2),{flag:"wx"});
  sofaWindows.set(page,{began:scrollBegan,ended:scrollProof.ended,dimensions});
  expect(scrollProof.eligible,"real seat inside room/home/viewport owns the denominator").toBeGreaterThan(10);
  expect(scrollProof.missingSurface).toBe(0);expect(scrollProof.missingActor).toBe(0);expect(scrollProof.hiddenActor).toBe(0);expect(scrollProof.missingFront).toBe(0);expect(scrollProof.hiddenFront).toBe(0);
  expect(scrollProof.samples,"nonempty actual resident observations").toBeGreaterThan(10);
  expect(scrollProof.scrollSpan).toBeGreaterThan(5);expect(scrollProof.bedSpan).toBeGreaterThan(5);
  // Preserve all three original measurements and the1CSSpx criterion. DOM
  // phases only nominate candidates; afterEach attaches the complete capture
  // for three exact same-case original trace+video painted assessments. A
  // post-rAF timer is additional evidence, never a painted pass by itself.
  expect(scrollProof.doubleFront).toBe(0);expect(scrollProof.wrongDepth).toBe(0);expect(scrollProof.wrongSupport).toBe(0);

  // A real working performer must finish a small outside encouragement bout,
  // rather than loop poses forever behind the editor's blocked-trace exemption.
  await page.setViewportSize({width:1920,height:850});await settlePanelLayout(page);
  await compact.locator('[data-act="companion-personality-open"]').click();
  const settings=page.getByRole("dialog",{name:"빅타민 수첩",exact:true});
  await settings.getByRole("radiogroup",{name:"빅타민 성격",exact:true}).getByRole("radio",{name:COMPANION_PERSONALITY_NAMES.performer,exact:true}).click();
  await settings.getByRole("tab",{name:"움직임",exact:true}).click();await settings.locator('[data-act="companion-roam"]').setChecked(true);
  await settings.getByRole("button",{name:"닫기",exact:true}).click();
  const workBegan=await page.evaluate(()=>performance.now());
  await day.focus();await page.keyboard.press("Enter");
  const editor=page.locator(".event-editor-panel:visible"),content=editor.getByRole("textbox",{name:"내용",exact:true});
  await expect(editor).toBeVisible();await content.fill("공개 응원 회귀 초안");
  await expect.poll(()=>page.evaluate(began=>{
    type Row={at:number;scene:string;command:string;petHidden:boolean;decoded:boolean;platform:string};
    return ((window as ProbeWindow).living143?.frames as Row[]??[]).some(f=>f.at>=began&&f.scene==="working-performer"&&f.command==="pose"&&!f.petHidden&&f.decoded&&!f.platform.startsWith("companion-home"));
  },workBegan),{timeout:20_000,intervals:[80]}).toBe(true);
  await page.waitForTimeout(20_000);
  const workProof=await page.evaluate(began=>{
    type Row={at:number;scene:string;beat:string;command:string;working:boolean;petHidden:boolean;decoded:boolean;platform:string};
    const all=((window as ProbeWindow).living143?.frames as Row[]??[]).filter(f=>f.at>=began),poses=all.filter(f=>f.scene==="working-performer"&&f.command==="pose"&&!f.petHidden&&f.decoded);
    return {samples:all.length,poseBeats:[...new Set(poses.map(f=>f.beat))],indoorAudience:poses.filter(f=>f.platform.startsWith("companion-home")).length,quietTail:all.slice(-20).every(f=>!f.working&&!f.scene.startsWith("working-"))};
  },workBegan);
  expect(workProof.samples).toBeGreaterThan(100);expect(workProof.poseBeats.length).toBeGreaterThan(0);expect(workProof.poseBeats.length).toBeLessThanOrEqual(2);
  expect(workProof.indoorAudience).toBe(0);expect(workProof.quietTail).toBe(true);
  await content.pressSequentially(" · 계속 입력",{delay:60});await expect(content).toBeFocused();await expect(content).toHaveText("공개 응원 회귀 초안 · 계속 입력");
  writeFileSync(resolve(output,"143-finite-editor-encouragement.json"),JSON.stringify(workProof,null,2),{flag:"wx"});
  await page.keyboard.press("Escape");await expect(editor).toBeHidden();

});
