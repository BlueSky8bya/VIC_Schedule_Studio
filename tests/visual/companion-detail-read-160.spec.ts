import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_BOOK_ORDER as COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_BEHAVIOR_IDS, COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output=process.env.COMPANION160_BOOK_OUTPUT??".scratch-pw/companion160-book";
const fonts=new Set([...readFileSync(resolve("app/fonts.css"),"utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match=>match[1]));
const toys=["practice-baseball-bat","practice-baseball-glove"];
const seenToy=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!).seen as string[]);
const seenFood=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).seen?.foods??[],COMPANION_COLLECTION_KEY);
async function boundedTiles(book:Locator){
 const tiles=await book.locator('ul .rhh-collection-tile').evaluateAll(nodes=>nodes.map(node=>{
  const r=node.getBoundingClientRect(),art=node.querySelector('.vc-toy-art,.vc-collection-art,.rhh-memory-silhouette,.rhh-collection-unknown'),a=art?.getBoundingClientRect();
  return {name:node.getAttribute('aria-label'),width:r.width,height:r.height,art:a?{width:a.width,height:a.height,left:a.left-r.left,top:a.top-r.top,right:r.right-a.right,bottom:r.bottom-a.bottom}:null};
 }));
 for(const tile of tiles){expect(tile.height).toBeGreaterThanOrEqual(43.5);if(tile.art){expect(Math.min(tile.art.width,tile.art.height)).toBeGreaterThanOrEqual(20);expect(Math.min(tile.art.left,tile.art.top,tile.art.right,tile.art.bottom)).toBeGreaterThanOrEqual(-.5);expect(Math.abs(tile.art.width-tile.art.height)).toBeLessThan(1);}}
 return tiles;
}
test.use({storageState:{cookies:[],origins:[]},serviceWorkers:"block"});test.setTimeout(70000);
for(const surface of ["viewer","studio","preview"] as const)for(const short of [false,true])test(`160 ${surface} ${short?"short-dark":"wide-light"} visible detail read and bounded long names`,async({page,context,baseURL})=>{
 const rejected:string[]=[],errors:string[]=[],notes:unknown[]=[],origin=new URL(baseURL!).origin;
 await page.setViewportSize(short?{width:1440,height:760}:{width:1920,height:1100});page.on("pageerror",error=>errors.push(error.message));
 const root=process.env.VISUAL_TEST_BUILD_DIR??".next",manifest=JSON.parse(readFileSync(resolve(root,"server/server-reference-manifest.json"),"utf8")).node as Record<string,{exportedName?:string}>;
 const previews=new Set(Object.entries(manifest).filter(([,value])=>value.exportedName==="getPublicPreviewAction").map(([id])=>id));
 await context.route("**/*",route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==origin){if(req.resourceType()==="font")return fulfillReadOnlyFont(route,fonts,rejected);rejected.push(req.method()+" "+url.pathname);return route.abort();}
  if(!["GET","HEAD"].includes(req.method())){
   if(["/api/activity","/api/visit","/api/presence","/api/visit-session","/api/visit-ping"].includes(url.pathname))return route.fulfill({json:{ok:true,skipped:true}});
   if(url.pathname==="/visual-fixture/studio"&&previews.has(req.headers()["next-action"]))return route.fulfill({contentType:"text/x-component",body:`0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n`});
   rejected.push(req.method()+" "+url.pathname);return route.abort();
  }
  if(url.pathname.startsWith("/api/"))return route.fulfill({json:{live:false}});return route.continue();
 });
 await page.addInitScript(({prefs,epoch,key,dark,foods,behaviors,toys,collectionKey})=>{
  for(const [k,v] of Object.entries({[key]:epoch,"vic.viewerCompanion":JSON.stringify({version:1,...prefs,enabled:true,roam:false,sleep:false,learnFromYou:false}),"vic.dark":dark?"on":"off","vic.sound":"off","vic.ambient":"off","vic.reduceMotion":"on","vic.gfxPref":"off","vic_avatar_side":"left"}))localStorage.setItem(k,v);
  localStorage.setItem("vic.viewerCompanionTastes",JSON.stringify({version:1,toys,seen:[],toyTastes:{},foodTastes:{}}));
  localStorage.setItem(collectionKey,JSON.stringify({version:1,foods,behaviors,situations:[],seen:{foods:[],behaviors:[],situations:[],accessories:[]},gifts:{unlocked:[],equipped:null,pending:null}}));
 },{prefs:DEFAULT_COMPANION_PREFERENCES,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY,dark:short,foods:COMPANION_FOOD_KINDS,behaviors:COMPANION_BEHAVIOR_IDS,toys,collectionKey:COMPANION_COLLECTION_KEY});
 try{
  await page.goto(surface==="viewer"?"/visual-fixture/poster?avatar=1":"/visual-fixture/studio?role=owner&y=2025&m=10");await page.bringToFront();await settlePanelLayout(page);
  if(surface==="preview"){await page.locator(".io-preview").click();await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();await settlePanelLayout(page);}
  let dialog:Locator;
  if(surface==="viewer"){const home=await openCompanionHome(page),fold=home.locator('[data-home-action="fold"]');if(await fold.count()&&await fold.getAttribute("aria-expanded")==="false")await fold.click();await home.locator('[data-home-action="book"]').click();dialog=page.getByRole("dialog",{name:"빅타민 수첩",exact:true});}
  else{if(!await page.getByRole("button",{name:"설정",exact:true}).isVisible())await page.getByRole("button",{name:"패널 펼치기",exact:true}).click();await page.getByRole("button",{name:"설정",exact:true}).click();dialog=page.getByRole("dialog",{name:"설정",exact:true});await dialog.getByRole("tab",{name:"빅타민",exact:true}).click();}
  await waitForOverlayEntrance(dialog);const profile=dialog.locator(".rhh-companion-profile"),nav=profile.getByRole("tablist",{name:"빅타민 프로필",exact:true});await nav.getByRole("tab",{name:"도감",exact:true}).click();
  await expect.poll(()=>seenFood(page)).toEqual([COMPANION_FOOD_KINDS[0]]);expect((await seenFood(page)).includes(COMPANION_FOOD_KINDS[1])).toBe(false);
  const foodLayout=await profile.locator('.rhh-food-grid').evaluate(node=>({gap:parseFloat(getComputedStyle(node).gap),columns:getComputedStyle(node).gridTemplateColumns.split(/\s+/).length,tiles:[...node.querySelectorAll('.rhh-collection-tile')].map(tile=>{const name=tile.querySelector(':scope > span:not(.vc-collection-art):not(.rhh-collection-rarity):not([aria-hidden])')!,tag=tile.querySelector('.rhh-collection-rarity'),art=tile.querySelector('.vc-collection-art'),r=tile.getBoundingClientRect(),n=name.getBoundingClientRect(),t=tag?.getBoundingClientRect(),a=art?.getBoundingClientRect();return{font:parseFloat(getComputedStyle(name).fontSize),tagFont:tag?parseFloat(getComputedStyle(tag).fontSize):null,width:r.width,height:r.height,artToName:a?n.top-a.bottom:null,nameToTag:t?t.top-n.bottom:null,tagBottom:t?r.bottom-t.bottom:null};})}));
  expect(foodLayout.columns).toBeLessThanOrEqual(5);expect(foodLayout.gap).toBeGreaterThanOrEqual(11.9);
  for(const tile of foodLayout.tiles){expect(tile.font).toBeGreaterThanOrEqual(14.9);expect(tile.width).toBeGreaterThanOrEqual(100);if(tile.tagFont!==null){expect(tile.tagFont).toBeGreaterThanOrEqual(12.9);expect(tile.nameToTag).toBeGreaterThanOrEqual(7);expect(tile.tagBottom).toBeGreaterThanOrEqual(10);}if(tile.artToName!==null)expect(tile.artToName).toBeGreaterThanOrEqual(7);}
  notes.push({stage:'161-readable-food-cards',...foodLayout});mkdirSync(output,{recursive:true});await dialog.screenshot({path:resolve(output,`${surface}-${short?'short-dark':'wide-light'}-foods.png`)});
  await profile.locator('[data-act="companion-collection-category"][data-act-opt="toy"]').click();await page.waitForTimeout(250);await nav.getByRole("tab",{name:"함께 지내기",exact:true}).click();await page.waitForTimeout(1400);expect(await seenToy(page)).toEqual([]);
  await nav.getByRole("tab",{name:"도감",exact:true}).click();
  const other=await context.newPage();await other.goto("about:blank");await other.bringToFront();
  const exposedBlur=await page.evaluate(()=>!document.hasFocus());
  if(exposedBlur){await page.waitForTimeout(1400);expect(await seenToy(page)).toEqual([]);}
  notes.push({stage:"browser-focus",exposedBlur,limitation:exposedBlur?null:"This headless browser keeps both pages focused; OS-window blur is unverified. Inactive profile cancellation above remains native evidence."});
  await other.close();await page.bringToFront();
  await expect.poll(()=>seenToy(page)).toEqual([toys[0]]);expect(await seenToy(page)).not.toContain(toys[1]);
  const book=profile.locator(".rhh-companion-toy-discovery");notes.push({category:"toy",tiles:await boundedTiles(book)});
  const rail=book.getByRole("slider");await rail.focus();await rail.press("End");notes.push({category:"last-toy-page",tiles:await boundedTiles(book)});
  await profile.locator('[data-act="companion-collection-category"][data-act-opt="food"]').click();const foodBook=profile.locator('.rhh-companion-discovery');await foodBook.getByRole('slider').focus();await foodBook.getByRole('slider').press('End');notes.push({category:'last-food-page',tiles:await boundedTiles(foodBook)});
  await profile.locator('[data-act="companion-collection-category"][data-act-opt="behavior"]').click();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).seen?.behaviors??[],COMPANION_COLLECTION_KEY)).toEqual([COMPANION_BEHAVIOR_IDS[0]]);
  notes.push({category:'memory',tiles:await boundedTiles(profile.locator('.rhh-companion-discovery'))});
  mkdirSync(output,{recursive:true});await dialog.screenshot({path:resolve(output,`${surface}-${short?'short-dark':'wide-light'}.png`)});expect(errors).toEqual([]);expect(rejected).toEqual([]);
 }finally{mkdirSync(output,{recursive:true});writeFileSync(resolve(output,`${surface}-${short?'short-dark':'wide-light'}.json`),JSON.stringify({notes,errors,rejected,build:readFileSync(resolve(root,'BUILD_ID'),'utf8').trim(),scope:'Seeded existing local collection only; native category/tab/range controls, real focused1.2s dwell and a recorded second-page focus attempt (OS blur is unverified where Chromium keeps both pages focused). Selected detail only, no synthetic clicks or random acquisition claim.'},null,2));}
});
