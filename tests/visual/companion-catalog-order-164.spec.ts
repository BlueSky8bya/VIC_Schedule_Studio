import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { COMPANION_TOY_NAMES, COMPANION_TOY_RARITY } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY } from "@/lib/ui/viewer-companion/snacks";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_BOOK_ORDER as COMPANION_FOOD_KINDS, COMPANION_TOY_BOOK_ORDER as COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output = process.env.COMPANION164_OUTPUT ?? ".scratch-pw/catalog164-observations";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
type Surface = "viewer" | "studio" | "preview";
type Proof = { rejected: string[]; errors: string[]; notes: unknown[] };
const proofs = new Map<Page, Proof>();
const save = (name: string, value: unknown) => { mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, name + ".json"), JSON.stringify(value, null, 2)); };
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
test.setTimeout(240000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof: Proof = { rejected: [], errors: [], notes: [] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const origin = new URL(baseURL!).origin;
  const manifest = JSON.parse(readFileSync(resolve(".next/server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(manifest).filter(([, v]) => v.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== origin) { if (req.resourceType() === "font") return fulfillReadOnlyFont(route, fonts, proof.rejected); proof.rejected.push(req.method() + " " + url.pathname); return route.abort(); }
    if (!["GET", "HEAD"].includes(req.method())) {
      if (["/api/activity", "/api/visit", "/api/presence", "/api/visit-session", "/api/visit-ping"].includes(url.pathname)) return route.fulfill({ json: { ok: true, skipped: true } });
      if (url.pathname === "/visual-fixture/studio" && previews.has(req.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
      proof.rejected.push(req.method() + " " + url.pathname); return route.abort();
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => {
  const proof = proofs.get(page)!; save(test.info().title.replace(/[^a-z0-9]+/gi, "-"), { ...proof, buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), scope: "Real production-build fixtures with synthetic care/collection and intercepted APIs; no DB/login or seeded clock/RNG/geometry." });
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); proofs.delete(page);
});
async function seed(page: Page, dark = false, foods = COMPANION_FOOD_KINDS, toys = COMPANION_TOY_KINDS, unread = false) {
  await page.addInitScript(({ prefs, memory, epoch, key, dark, foods, behaviors, toys, unread }) => {
    for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, v);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, personality: "balanced", personalitySource: "manual", roam: false, feeding: true, sleep: false, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .95, hunger: .05, life: { ...memory.life, seedFood: "turnip", favoriteFood: "turnip", tastedFoods: ["turnip"], foodScores: { ...memory.life.foodScores, turnip: .9 } } }));
    localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: false }));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys, seen: unread ? [] : toys, toyTastes: {}, foodTastes: {}, reasons: [{ domain: "food", kind: "turnip", reason: "mild-bite", age: 0 }] }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods, behaviors, situations: [], seen: { foods: unread ? [] : foods, behaviors, situations: [], accessories: [] }, gifts: { unlocked: [], equipped: null, pending: null } }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, dark, foods, behaviors: COMPANION_BEHAVIOR_IDS, toys, unread });
}
async function open(page: Page, surface: Surface, hour = 12) {
  const response = await page.goto(surface === "viewer" ? `/visual-fixture/poster?avatar=1&hour=${hour}` : `/visual-fixture/studio?role=owner&y=2025&m=10&hour=${hour}&weather=clear`);
  proofs.get(page)!.notes.push({ stage: "actual-html", sha256: createHash("sha256").update(await response!.body()).digest("hex"), hour, surface });
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  const house = await openCompanionHome(page), fold = house.locator('[data-home-action="fold"]');
  if (await fold.count() && await fold.getAttribute("aria-expanded") === "false") await fold.click();
  await placeCompanionOnHomeFloor(page); await page.mouse.move(2, 2); return house;
}


for(const [surface,dark,width,height] of [["viewer",false,1440,1000],["studio",true,1440,760],["preview",false,1440,1000],["viewer",true,1050,760]] as const) test(`164 ${surface} ${dark?"dark":"light"} ${width} complete display order and five seals`,async({page})=>{
  await seed(page,dark);await page.setViewportSize({width,height});const house=await open(page,surface);await house.locator('[data-home-action="book"]').click();
  const book=page.getByRole('dialog',{name:'빅타민 수첩',exact:true});await expect(book).toBeVisible();
  await book.getByRole('tablist',{name:'빅타민 프로필',exact:true}).getByRole('tab',{name:'도감',exact:true}).click();
  const notes:unknown[]=[];proofs.get(page)!.notes.push({stage:'display-order-native-paging',notes});
  for(const category of ['food','toy'] as const){
    await book.locator(`[data-act="companion-collection-category"][data-act-opt="${category}"]`).click();
    await settlePanelLayout(page);
    const kinds=category==='food'?COMPANION_FOOD_KINDS:COMPANION_TOY_KINDS;
    const rail=book.getByRole('slider');await rail.focus();await rail.press('Home');
    const visited:string[]=[],shapes=new Set<string>(),tiers=new Set<string>();
    const total=Number(await rail.getAttribute('max'));
    for(let p=0;p<total;p++){
      const tiles=book.locator('ul .rhh-collection-tile');
      const labels=await tiles.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')!));
      const offset=visited.length;
      const expected=kinds.slice(offset,offset+labels.length).map(id=>category==='food'?COMPANION_FOOD_NAMES[id as keyof typeof COMPANION_FOOD_NAMES]:COMPANION_TOY_NAMES[id as keyof typeof COMPANION_TOY_NAMES]);
      expect(labels.map(label=>label.split(' · ')[0])).toEqual(expected);visited.push(...expected);
      for(let i=0;i<labels.length;i++){
        const id=kinds[offset+i],rarity=category==='food'?COMPANION_FOOD_RARITY[id as keyof typeof COMPANION_FOOD_RARITY]:COMPANION_TOY_RARITY[id as keyof typeof COMPANION_TOY_RARITY];
        if(tiers.has(rarity))continue;tiers.add(rarity);await tiles.nth(i).click();await page.mouse.move(2,2);
        const detail=book.locator('.rhh-collection-gallery-detail'),seal=detail.locator('[data-seal-rarity]');
        await expect(seal).toHaveAttribute('data-seal-rarity',rarity);await expect(seal).toHaveAttribute('data-collection-art-id',id);
        shapes.add((await seal.getAttribute('data-seal-shape'))!);
        for(const backing of await seal.locator(':scope > svg > image').all())expect(await backing.evaluate(async node=>{const image=new Image();image.src=(node as SVGImageElement).href.baseVal;await image.decode();return image.naturalWidth>0;})).toBe(true);
        for(const img of await detail.locator('img').all())await expect.poll(()=>img.evaluate((n:HTMLImageElement)=>n.complete&&n.naturalWidth>0)).toBe(true);
        const geometry=await detail.evaluate(node=>{const stage=node.querySelector('.rhh-collection-art-stage')!.getBoundingClientRect();return [...node.querySelectorAll('.vc-collection-art,.vc-collection-seal-picture,.vc-toy-art')].map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height,margins:[r.left-stage.left,r.top-stage.top,stage.right-r.right,stage.bottom-r.bottom]};});});
        for(const g of geometry){expect(Math.min(...g.margins)).toBeGreaterThanOrEqual(-.5);expect(Math.min(g.w,g.h)).toBeGreaterThan(20);}
        mkdirSync(output,{recursive:true});await book.screenshot({path:resolve(output,`${surface}-${dark?'dark':'light'}-${width}-${category}-${rarity}.png`)});
        notes.push({category,id,rarity,geometry});
      }
      if(p+1<total)await book.locator('[data-page-direction="next"]').click();
    }
    expect(visited).toHaveLength(kinds.length);expect(new Set(visited).size).toBe(kinds.length);expect(tiers.size).toBe(5);expect(shapes.size).toBe(5);
    notes.push({category,visited});
    await rail.focus();await rail.press('Home');const columns=await book.locator('ul').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(/\s+/).length);const first=book.locator('[data-collection-index="0"]');await first.focus();await first.press('ArrowDown');
    await expect(book.locator(`[data-collection-index="${columns}"]`)).toHaveAttribute('aria-pressed','true');
    const before=await page.evaluate(()=>({collection:localStorage.getItem('vic.viewerCompanionCollection'),toys:localStorage.getItem('vic.viewerCompanionTastes')}));
    await rail.focus();await rail.press('End');await rail.press('Home');
    expect(await page.evaluate(()=>({collection:localStorage.getItem('vic.viewerCompanionCollection'),toys:localStorage.getItem('vic.viewerCompanionTastes')}))).toEqual(before);
  }
});

test("164 unknown silhouettes and reordered unread inspection preserve stable saved IDs", async ({ page }) => {
  const foods = [COMPANION_FOOD_KINDS[2], COMPANION_FOOD_KINDS[20], COMPANION_FOOD_KINDS[179]];
  await seed(page, false, foods, [], true);
  const house = await open(page, "viewer"); await house.locator('[data-home-action="book"]').click();
  const book = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await book.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "도감", exact: true }).click();
  const detail = book.locator(".rhh-collection-gallery-detail");
  await expect(detail.locator("strong")).toHaveText("???");
  await expect(detail.locator("[data-seal-rarity],.rhh-collection-rarity,.rhh-collection-chance")).toHaveCount(0);
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection")!) as { foods: string[]; seen: { foods: string[] } });
  expect((await state()).seen.foods).toEqual([]);
  await book.screenshot({ path: resolve(output, "viewer-unknown-silhouettes.png") });
  for (let index = 0; index < foods.length; index++) {
    await book.getByRole("button", { name: "다음 새 발견 보기", exact: true }).click();
    await expect(detail.locator("[data-collection-art-id]")).toHaveAttribute("data-collection-art-id", foods[index]);
    await expect.poll(async () => [...(await state()).seen.foods].sort()).toEqual(foods.slice(0, index + 1).sort());
    expect([...(await state()).foods].sort()).toEqual([...foods].sort());
  }
  await expect(book.locator('[data-page-direction][data-unread]')).toHaveCount(0);
});
