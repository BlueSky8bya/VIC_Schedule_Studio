import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
import anchors from "@/lib/ui/viewer-companion/curtain-contact-anchors.json";
import topAnchors from "@/lib/ui/viewer-companion/home-contact-anchors-157.json";
import bodyAnchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import { installCompanionPaintedSource157, type PaintedSource157Window } from "./helpers/companion-painted-source-157";

type Surface="viewer"|"studio"|"preview";
type Rect={x:number;y:number;width:number;height:number};
type Frame={at:number;x:number;y:number;state:string;command:string;reaching:string;support:string;phase:string;lit:boolean;touch:boolean;
  handle:Rect;room:Rect; physical?:{point:{x:number;y:number};anchor:"top"|"left"|"right";edgeDistance:number;source:string;pose:number;body:Rect};washing:boolean};
type ProbeWindow=Window&{curtainReach?:{frames:Frame[];stop():void}};
type Proof={errors:string[];rejected:string[];notes:unknown[]};
const proofs=new WeakMap<Page,Proof>();
const output=resolve(process.env.COMPANION_CURTAIN_REACH_OUTPUT??(process.env.COMPANION_QA_OUTPUT?`${process.env.COMPANION_QA_OUTPUT}/curtain-reach`:".scratch-pw/curtain-reach-observations"));
const fonts=new Set([...readFileSync("app/fonts.css","utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match=>match[1]));
const build=()=>process.env.VISUAL_TEST_BUILD_DIR??".next";
test.use({storageState:{cookies:[],origins:[]},serviceWorkers:"block"});
test.setTimeout(85000);

test.beforeEach(async({page,context,baseURL})=>{
  const proof:Proof={errors:[],rejected:[],notes:[]};proofs.set(page,proof);
  const origin=new URL(baseURL!).origin;
  expect(["127.0.0.1","localhost","[::1]"]).toContain(new URL(origin).hostname);
  page.on("pageerror",error=>proof.errors.push(error.message));
  const manifest=JSON.parse(readFileSync(resolve(build(),"server/server-reference-manifest.json"),"utf8")).node as Record<string,{exportedName?:string}>;
  const previews=new Set(Object.entries(manifest).filter(([,value])=>value.exportedName==="getPublicPreviewAction").map(([id])=>id));
  await context.route("**/*",route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){if(request.resourceType()==="font")return fulfillReadOnlyFont(route,fonts,proof.rejected);proof.rejected.push(request.method()+" "+url.pathname);return route.abort();}
    if(!["GET","HEAD"].includes(request.method())){
      if(url.pathname==="/visual-fixture/studio"&&previews.has(request.headers()["next-action"]))return route.fulfill({contentType:"text/x-component",body:`0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n`});
      proof.rejected.push(request.method()+" "+url.pathname);return route.abort();
    }
    if(url.pathname.startsWith("/api/"))return route.fulfill({status:404,body:"No live/private API reads in fixture"});
    return route.continue();
  });
});
test.afterEach(async({page},info)=>{
  const frames=await page.evaluate(()=>{const probe=(window as ProbeWindow).curtainReach;probe?.stop();return probe?.frames??[];}).catch(()=>[]);
  const proof=proofs.get(page)!,name=info.title.replace(/[^a-z0-9]+/gi,"-");mkdirSync(output,{recursive:true});
  const file=resolve(output,name+".json");
  writeFileSync(file,JSON.stringify({status:info.status,...proof,frames,buildId:readFileSync(resolve(build(),"BUILD_ID"),"utf8").trim(),
    scope:"Production-build credential-free fixture. Initial saved care/preferences only; native P/wash/settings and autonomous low-energy sleep, real time/RNG/physics; read-only DOM and current painted-source pixels. Three actual layouts per shared surface, not all possible ratios or real login."},null,2));
  await info.attach("curtain-reach-native-proof",{path:file,contentType:"application/json"});
  const screenshot=resolve(output,name+".png");await page.screenshot({path:screenshot}).catch(()=>{});
  await info.attach("curtain-reach-final",{path:screenshot,contentType:"image/png"});
  expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);
});
async function seed(page:Page){
  await page.addInitScript(({preferences,memory,epoch,key})=>{
    for(const [name,value]of Object.entries({[key]:epoch,"vic.gfxPref":"max","vic.gfx":JSON.stringify({mode:"full",at:Date.now(),v:3}),"vic.reduceMotion":"off","vic.dark":"off","vic.sound":"off","vic.ambient":"off","vic_avatar_side":"left","vic.premiereStage":"off"}))localStorage.setItem(name,value);
    localStorage.setItem("vic.viewerCompanion",JSON.stringify({version:1,...preferences,enabled:true,personality:"balanced",personalitySource:"manual",roam:false,feeding:true,sleep:true,petting:false,learnFromYou:false,heartPrank:false,cardPrank:false,ambientPrank:false,panelPrank:false,rarePrank:false}));
    localStorage.setItem("vic.viewerCompanionCare",JSON.stringify({version:3,...memory,energy:.25,hunger:.05}));
    localStorage.setItem("vic.companionHomeLight.v1",JSON.stringify({version:1,lit:true}));
  },{preferences:DEFAULT_COMPANION_PREFERENCES,memory:DEFAULT_COMPANION_MEMORY,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY});
}
async function open(page:Page,surface:Surface,compact:boolean){
  const response=await page.goto(surface==="viewer"?`/visual-fixture/poster?hour=0${compact?"&avatar=1":""}`:"/visual-fixture/studio?role=owner&y=2025&m=10&hour=0&weather=clear");
  proofs.get(page)!.notes.push({stage:"actual-html",sha256:createHash("sha256").update(await response!.body()).digest("hex"),surface});
  await page.bringToFront();await settlePanelLayout(page);
  if(surface==="preview"){await page.locator(".io-preview").click();await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();await settlePanelLayout(page);}
  let home=await openCompanionHome(page);
  if(compact&&await home.getAttribute("data-home-presentation")!=="compact"){
    const panel=page.locator('.panel-place-ctl [data-act="panel-toggle"]:visible,.poster-panel-ctl [data-act="panel-toggle"]:visible').first();
    await panel.click();await expect(panel).toHaveAttribute("aria-pressed","false");await settlePanelLayout(page);home=await openCompanionHome(page);
  }
  if(!compact&&await home.getAttribute("data-home-presentation")!=="panel"){
    await home.getByRole("button",{name:"빅타민 집 닫기",exact:true}).click();
    const panel=page.locator('.panel-place-ctl [data-act="panel-toggle"]:visible,.poster-panel-ctl [data-act="panel-toggle"]:visible').first();
    await panel.click();await expect(panel).toHaveAttribute("aria-pressed","true");await settlePanelLayout(page);home=await openCompanionHome(page);
  }
  const fold=home.locator('[data-home-action="fold"]');if(await fold.count()&&await fold.getAttribute("aria-expanded")==="false")await fold.click();
  await settlePanelLayout(page);return home;
}
async function observe(page:Page){
  await installCompanionPaintedSource157(page);
  await page.evaluate(({calibration,topCalibration,bodyCalibration})=>{
    const frames:Frame[]=[];let raf=0;const start=performance.now();
    const rect=(r:DOMRect):Rect=>({x:r.x,y:r.y,width:r.width,height:r.height});
    // This walks the actual DOM transform matrices. Runtime planned lift,
    // contact flags and its projection function cannot manufacture a point.
    const project=(actor:HTMLElement,sprite:HTMLElement,point:{x:number;y:number})=>{
      const width=parseFloat(getComputedStyle(sprite).width);let p=new DOMPoint(point.x/80*width,point.y/80*width);
      for(let node:HTMLElement|null=sprite;node&&node!==actor;node=node.parentElement){
        const css=getComputedStyle(node),origin=css.transformOrigin.split(" ").map(Number.parseFloat),matrix=new DOMMatrixReadOnly(css.transform);
        p=matrix.transformPoint(new DOMPoint(p.x-origin[0],p.y-origin[1]));p=new DOMPoint(p.x+origin[0]+node.offsetLeft,p.y+origin[1]+node.offsetTop);
      }
      const matrix=new DOMMatrixReadOnly(getComputedStyle(actor).transform),box=actor.getBoundingClientRect();
      const corners=[[0,0],[actor.offsetWidth,0],[0,actor.offsetHeight],[actor.offsetWidth,actor.offsetHeight]].map(([x,y])=>matrix.transformPoint(new DOMPoint(x,y)));
      p=matrix.transformPoint(p);return {x:box.left+p.x-Math.min(...corners.map(point=>point.x)),y:box.top+p.y-Math.min(...corners.map(point=>point.y))};
    };
    const tick=()=>{
      const actor=document.querySelector<HTMLElement>(".vc-companion"),body=actor?.getBoundingClientRect(),control=document.querySelector<HTMLElement>(".vc-curtain-control"),handle=control?.querySelector(".vc-curtain-handle")?.getBoundingClientRect(),room=document.querySelector(".vc-home-room")?.getBoundingClientRect();
      if(actor&&body&&control&&handle&&room&&frames.length<5000){
        const source=(window as PaintedSource157Window).companionPaintedSource157?.inspect(actor),frame=calibration.frames.find(item=>item.physicalIndex===Number(actor.dataset.pose)),sprite=actor.querySelector<HTMLElement>(".vc-sprite");
        const top=topCalibration.frames.find(item=>item.physicalIndex===Number(actor.dataset.pose));
        const bodyFrame=bodyCalibration.frames.find(item=>item.physicalIndex===Number(actor.dataset.pose));
        const points=frame&&top&&bodyFrame&&sprite&&source?.passed&&source.source===calibration.source.src&&source.source===topCalibration.source.src?
          [{anchor:"top" as const,point:project(actor,sprite,top)},{anchor:"left" as const,point:project(actor,sprite,frame.left)},{anchor:"right" as const,point:project(actor,sprite,frame.right)}]:[];
        const corners=bodyFrame&&sprite?[[bodyFrame.bodyBounds[0],bodyFrame.bodyBounds[1]],[bodyFrame.bodyBounds[2],bodyFrame.bodyBounds[1]],[bodyFrame.bodyBounds[0],bodyFrame.bodyBounds[3]],[bodyFrame.bodyBounds[2],bodyFrame.bodyBounds[3]]].map(([x,y])=>project(actor,sprite,{x,y})):[];
        const left=Math.min(...corners.map(point=>point.x)),topY=Math.min(...corners.map(point=>point.y)),right=Math.max(...corners.map(point=>point.x)),bottom=Math.max(...corners.map(point=>point.y));
        const physical=points.map(({anchor,point})=>({anchor,point,edgeDistance:Math.hypot(Math.max(handle.left-point.x,0,point.x-handle.right),Math.max(handle.top-point.y,0,point.y-handle.bottom)),source:source!.source,pose:source!.pose,
          body:{x:left,y:topY,width:right-left,height:bottom-topY}})).sort((a,b)=>a.edgeDistance-b.edgeDistance)[0];
        frames.push({at:performance.now()-start,x:body.left+body.width/2,y:body.bottom,state:actor.dataset.state??"",command:actor.dataset.personalityCommand??"",reaching:actor.dataset.homeReaching??"",support:actor.dataset.platform??"",phase:document.querySelector<HTMLElement>(".vc-home-window")?.dataset.curtain??"",lit:document.querySelector('[data-home-action="light"]')?.getAttribute("aria-pressed")==="true",touch:control.hasAttribute("data-companion-touch"),handle:rect(handle),room:rect(room),physical,washing:actor.hasAttribute("data-washing")});
      }
      raf=requestAnimationFrame(tick);
    };
    (window as ProbeWindow).curtainReach={frames,stop(){cancelAnimationFrame(raf);}};raf=requestAnimationFrame(tick);
  },{calibration:anchors,topCalibration:topAnchors,bodyCalibration:bodyAnchors});
}
for(const surface of ["viewer","studio","preview"] as const)for(const [width,compact,label]of [[1100,true,"narrow-compact"],[1494,false,"default-panel"],[2560,true,"wide-compact"]] as const){
  test(`curtain ${surface} ${label} physically reaches the painted handle before closing and continuing care`,async({page})=>{
    await page.setViewportSize({width,height:1100});await seed(page);const home=await open(page,surface,compact),actor=page.locator(".vc-companion");
    await expect(home.locator(".vc-home-window")).toHaveAttribute("data-curtain","open");await observe(page);
    await home.locator('[data-home-action="personality"]').click();const book=page.getByRole("dialog",{name:"빅타민 수첩",exact:true});
    await book.getByRole("tab",{name:"움직임",exact:true}).click();await book.locator('[data-act="companion-roam"]').setChecked(true);await book.getByRole("button",{name:"닫기",exact:true}).click();
    await placeCompanionOnHomeFloor(page);await page.mouse.move(2,2);
    proofs.get(page)!.notes.push({stage:"actual-layout",surface,label,room:await home.locator(".vc-home-room").boundingBox(),handle:await home.locator(".vc-curtain-handle").boundingBox()});
    await expect(home.locator(".vc-home-window")).toHaveAttribute("data-curtain","closed",{timeout:35000});
    await expect(actor).toHaveAttribute("data-state","sleep",{timeout:20000});
    // The runtime can publish sleep before the read-only RAF observer samples
    // that frame. Wait for the same physical return condition in the observer
    // before taking its immutable assertion snapshot.
    await expect.poll(async()=>{
      const observed=await page.evaluate(()=>(window as ProbeWindow).curtainReach!.frames),closed=observed.find(frame=>frame.phase==="closed");
      const contact=closed&&observed.find(frame=>frame.at<=closed.at&&frame.at>=closed.at-650&&frame.reaching==="curtain"&&frame.physical&&frame.physical.edgeDistance<=1.25);
      return Boolean(closed&&contact&&observed.some(frame=>frame.at>closed.at&&frame.state==="sleep"&&frame.y>contact.y+15));
    },{message:"the actual RAF observer records sleep after returning below the same physical handle contact"}).toBe(true);
    const frames=await page.evaluate(()=>(window as ProbeWindow).curtainReach!.frames),changed=frames.find(frame=>frame.phase==="closed");expect(changed).toBeTruthy();
    const reach=frames.filter(frame=>frame.at<=changed!.at&&frame.at>=changed!.at-650&&frame.reaching==="curtain"&&frame.physical&&frame.physical.edgeDistance<=1.25);
    expect(reach.length,"current decoded opaque body must actually reach handle height before curtain changes").toBeGreaterThanOrEqual(2);
    const first=frames.find(frame=>frame.reaching==="curtain");expect(first).toBeTruthy();
    expect(Math.max(...frames.filter(frame=>frame.reaching==="curtain").map(frame=>first!.y-frame.y)),"finite actual body rise, not only a labelled pounce").toBeGreaterThan(15);
    expect(frames.some(frame=>frame.at>changed!.at&&frame.state==="sleep"&&frame.y>reach[0].y+15)).toBe(true);
    for(const frame of frames.filter(frame=>frame.touch)){expect(frame.physical).toBeTruthy();expect(frame.physical!.edgeDistance).toBeLessThanOrEqual(1.25);}
    for(const frame of frames.filter(frame=>frame.reaching==="curtain"&&frame.physical)){
      const body=frame.physical!.body;
      expect(body.x,"actual opaque left edge stays inside the room during the hop").toBeGreaterThanOrEqual(frame.room.x-1.25);
      expect(body.x+body.width).toBeLessThanOrEqual(frame.room.x+frame.room.width+1.25);
      expect(body.y).toBeGreaterThanOrEqual(frame.room.y-1.25);
      expect(body.y+body.height).toBeLessThanOrEqual(frame.room.y+frame.room.height+1.25);
    }
    // A genuine following care request must wake/move, not leave this one
    // happy contact pose parked at the handle after a successful state write.
    await home.getByRole("button",{name:"샤워패드에서 씻기",exact:true}).click();await page.mouse.move(2,2);
    await expect(actor).toHaveAttribute("data-washing","",{timeout:25000});
    const next=await page.evaluate(()=>(window as ProbeWindow).curtainReach!.frames);
    expect(next.some(frame=>frame.at>changed!.at&&frame.washing&&frame.support==="companion-home-floor-400")).toBe(true);
    expect(next.some(frame=>frame.at>changed!.at&&["walk","jump"].includes(frame.state))).toBe(true);
  });
}
