import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import assets from "../fixtures/companion-sbo-toys-159.json";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output=process.env.COMPANION159_OUTPUT ?? ".scratch-pw/companion159";
const fonts=new Set([...readFileSync(resolve("app/fonts.css"),"utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match=>match[1]));
const sha=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
test.use({viewport:{width:1920,height:1100},storageState:{cookies:[],origins:[]},serviceWorkers:"block"});
test.setTimeout(60000);

for(const surface of ["viewer","studio","preview"] as const)for(const dark of [false,true])test(`159 ${surface} ${dark?"dark":"light"} renders both SBO designs through native collection controls`,async({page,context,baseURL})=>{
 const origin=new URL(baseURL!).origin,errors:string[]=[],rejected:string[]=[],pending:Promise<void>[]=[],served:{src:string;sha256:string}[]=[],notes:unknown[]=[];
 const buildRoot=resolve(process.env.VISUAL_TEST_BUILD_DIR??".next"),build=readFileSync(resolve(buildRoot,"BUILD_ID"),"utf8").trim();
 const actions=JSON.parse(readFileSync(resolve(buildRoot,"server/server-reference-manifest.json"),"utf8")).node as Record<string,{exportedName?:string}>;
 const previews=new Set(Object.entries(actions).filter(([,value])=>value.exportedName==="getPublicPreviewAction").map(([id])=>id));
 page.on("pageerror",error=>errors.push(error.message));
 page.on("response",response=>{
  const url=new URL(response.url());if(url.origin!==origin||!assets.toys.some(item=>item.src===url.pathname))return;
  pending.push((async()=>{expect(response.status()).toBe(200);served.push({src:url.pathname,sha256:sha(await response.body())});})().catch(error=>{errors.push(String(error));}));
 });
 await context.route("**/*",route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==origin){if(req.resourceType()==="font")return fulfillReadOnlyFont(route,fonts,rejected);rejected.push(req.method()+" "+url.pathname);return route.abort();}
  if(!["GET","HEAD"].includes(req.method())){
   if(["/api/activity","/api/visit","/api/presence","/api/visit-session","/api/visit-ping"].includes(url.pathname))return route.fulfill({json:{ok:true,skipped:true}});
   if(url.pathname==="/visual-fixture/studio"&&previews.has(req.headers()["next-action"]))return route.fulfill({contentType:"text/x-component",body:`0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n`});
   rejected.push(req.method()+" "+url.pathname);return route.abort();
  }
  if(url.pathname.startsWith("/api/"))return route.fulfill({json:{live:false}});
  return route.continue();
 });
 // This is an explicit existing-collection visual fixture, never evidence of
 // random acquisition, play completion or independent behavior validation.
 await page.addInitScript(({preferences,epoch,key,dark,toys})=>{
  for(const [k,v] of Object.entries({[key]:epoch,"vic.viewerCompanion":JSON.stringify({version:1,...preferences,enabled:true,roam:false,sleep:false,sound:false,learnFromYou:false}),"vic.viewerCompanionTastes":JSON.stringify({version:1,toys,seen:toys,toyTastes:{},foodTastes:{}}),"vic.dark":dark?"on":"off","vic.sound":"off","vic.ambient":"off","vic.gfxPref":"off","vic.reduceMotion":"on","vic_avatar_side":"left"}))localStorage.setItem(k,v);
 },{preferences:DEFAULT_COMPANION_PREFERENCES,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY,dark,toys:assets.toys.map(item=>item.id)});
 try{
  await page.goto(surface==="viewer"?"/visual-fixture/poster?avatar=1":"/visual-fixture/studio?role=owner&y=2025&m=11");await page.bringToFront();await settlePanelLayout(page);
  if(surface==="preview"){await page.locator(".io-preview").click();await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();await settlePanelLayout(page);}
  let dialog;
  if(surface==="viewer"){const home=await openCompanionHome(page);const fold=home.locator('[data-home-action="fold"]');if(await fold.getAttribute("aria-expanded")==="false")await fold.click();await home.locator('[data-home-action="book"]').click();dialog=page.getByRole("dialog",{name:"빅타민 수첩",exact:true});}
  else{if(!await page.getByRole("button",{name:"설정",exact:true}).isVisible())await page.getByRole("button",{name:"패널 펼치기",exact:true}).click();await page.getByRole("button",{name:"설정",exact:true}).click();dialog=page.getByRole("dialog",{name:"설정",exact:true});await dialog.getByRole("tab",{name:"빅타민",exact:true}).click();}
  await waitForOverlayEntrance(dialog);const profile=dialog.locator(".rhh-companion-profile");
  await profile.getByRole("tablist",{name:"빅타민 프로필",exact:true}).getByRole("tab",{name:"도감",exact:true}).click();
  await profile.locator('[data-act="companion-collection-category"][data-act-opt="toy"]').click();
  const book=profile.locator(".rhh-companion-toy-discovery"),rail=book.getByRole("slider");await rail.focus();await rail.press("Home");
  const pageSize=await book.locator("ul button").count();
  for(const item of assets.toys){
   const targetPage=Math.floor(COMPANION_TOY_KINDS.indexOf(item.id as typeof COMPANION_TOY_KINDS[number])/pageSize)+1;
   await rail.focus();await rail.press("Home");for(let step=1;step<targetPage;step++)await rail.press("ArrowRight");await expect(rail).toHaveValue(String(targetPage));
   const name=item.id.endsWith("bat")?"SBO 토리님 배트":"SBO 토리님 글러브",tile=book.getByRole("button",{name:name+" · 만났어요",exact:true});
   await tile.click();const image=tile.locator("img");await expect(image).toHaveAttribute("src",item.src);await expect.poll(()=>image.evaluate(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth===192)).toBe(true);
   await expect(book.locator(".rhh-collection-detail-title strong")).toHaveText(name);await expect(book.locator(".rhh-collection-detail img")).toHaveAttribute("src",item.src);
   const rect=await image.boundingBox();expect(rect!.width).toBeGreaterThan(25);expect(rect!.height).toBeGreaterThan(25);notes.push({id:item.id,name,src:item.src,paint:rect});
   mkdirSync(output,{recursive:true});await dialog.screenshot({path:resolve(output,`${surface}-${dark?"dark":"light"}-${item.id}.png`)});
  }
  await Promise.all(pending);for(const item of assets.toys)expect(served.some(file=>file.src===item.src&&file.sha256===item.sha256)).toBe(true);
  expect(errors).toEqual([]);expect(rejected).toEqual([]);
 }finally{mkdirSync(output,{recursive:true});writeFileSync(resolve(output,`${surface}-${dark?"dark":"light"}.json`),JSON.stringify({build,notes,served,errors,rejected,scope:"Production fixture, two already-collected toy identities seeded. Native tab/page/tile selection and actual received/decoded new raster bytes. Random acquisition and play not sampled; app physics/ownership/odds unchanged."},null,2));}
});
