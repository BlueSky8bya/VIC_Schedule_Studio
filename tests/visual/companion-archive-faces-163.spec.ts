import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { COMPANION_TOY_RARITY } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_FOOD_RARITY } from "@/lib/ui/viewer-companion/snacks";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_BOOK_ORDER as COMPANION_FOOD_KINDS, COMPANION_TOY_BOOK_ORDER as COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output = process.env.COMPANION163_OUTPUT ?? ".scratch-pw/archive163-observations";
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
async function seed(page: Page, dark = false) {
  await page.addInitScript(({ prefs, memory, epoch, key, dark, foods, behaviors, toys }) => {
    for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, v);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, personality: "balanced", personalitySource: "manual", roam: false, feeding: true, sleep: false, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .95, hunger: .05, life: { ...memory.life, seedFood: "turnip", favoriteFood: "turnip", tastedFoods: ["turnip"], foodScores: { ...memory.life.foodScores, turnip: .9 } } }));
    localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: false }));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys, seen: toys, toyTastes: {}, foodTastes: {}, reasons: [{ domain: "food", kind: "turnip", reason: "mild-bite", age: 0 }] }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods, behaviors, situations: [], seen: { foods, behaviors, situations: [], accessories: [] }, gifts: { unlocked: [], equipped: null, pending: null } }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, dark, foods: COMPANION_FOOD_KINDS, behaviors: COMPANION_BEHAVIOR_IDS, toys: COMPANION_TOY_KINDS });
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

for (const surface of ["viewer", "studio", "preview"] as const) for (const dark of [false, true]) test(`163 ${surface} ${dark ? "short-dark" : "wide-light"} all84 toy previews and every page dot`, async ({page}) => {
  await seed(page, dark); await page.setViewportSize({width: 1440, height: dark ? 760 : 1000}); const house = await open(page,surface); await house.locator('[data-home-action="book"]').click();
  const book=page.getByRole('dialog',{name:'빅타민 수첩',exact:true});await expect(book).toBeVisible();
  await expect(book.locator('.rhh-taste-reason').first()).toContainText('생순무의 아삭함과 알싸한');
  await expect(book.locator('.rhh-taste-reason').first()).not.toContainText('담백');
  await book.getByRole('tablist',{name:'빅타민 프로필',exact:true}).getByRole('tab',{name:'도감',exact:true}).click();
  const observed: unknown[]=[];proofs.get(page)!.notes.push({stage:'all-specimens-native-selection',observed});
  for (const category of ['toy','food'] as const) {
    if(category==='food' && (surface!=='viewer'||dark)) continue;
    await book.locator(`[data-act="companion-collection-category"][data-act-opt="${category}"]`).click();
    const kinds=category==='toy'?COMPANION_TOY_KINDS:COMPANION_FOOD_KINDS, tiers=new Set<string>();
    for(let index=0;index<kinds.length;index++){
      const tile=book.locator(`[data-collection-index="${index}"]`);
      if(!await tile.count()) await book.locator('[data-page-direction="next"]').click();
      await tile.click();await page.mouse.move(2,2);
      const detail=book.locator('.rhh-collection-gallery-detail'), seal=detail.locator('[data-seal-rarity]');
      const rarity=category==='toy'?COMPANION_TOY_RARITY[kinds[index] as keyof typeof COMPANION_TOY_RARITY]:COMPANION_FOOD_RARITY[kinds[index] as keyof typeof COMPANION_FOOD_RARITY];
      await expect(seal).toHaveAttribute('data-seal-rarity',rarity);
      for(const img of await detail.locator('img').all())await expect.poll(()=>img.evaluate((n:HTMLImageElement)=>n.complete&&n.naturalWidth>0)).toBe(true);
      const metrics=await detail.evaluate(node=>{const stage=node.querySelector('.rhh-collection-art-stage')!,r=stage.getBoundingClientRect();return{stage:[r.width,r.height],art:[...stage.querySelectorAll('.vc-collection-art,.vc-toy-art,.vc-collection-seal-picture')].map(n=>{const a=n.getBoundingClientRect();return{width:a.width,height:a.height,margins:[a.left-r.left,a.top-r.top,r.right-a.right,r.bottom-a.bottom],fit:getComputedStyle(n).objectFit};})};});
      for(const art of metrics.art){expect(Math.min(...art.margins)).toBeGreaterThanOrEqual(-.5);expect(Math.min(art.width,art.height)).toBeGreaterThan(20);}
      const dots=await book.locator('.rhh-collection-page-dots > span').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{visible:getComputedStyle(n).display!=='none'&&r.width>=4.9&&r.height>=4.9,current:n.getAttribute('aria-current')};}));
      const number=await book.locator('.rhh-collection-page-number').innerText();expect(dots.length).toBe(Number(number.split('/')[1].trim()));expect(dots.every(d=>d.visible)).toBe(true);expect(dots.filter(d=>d.current==='page')).toHaveLength(1);
      observed.push({category,id:kinds[index],rarity,metrics,dots:dots.length});
      if(!tiers.has(rarity)){tiers.add(rarity);mkdirSync(output,{recursive:true});await book.screenshot({path:resolve(output,`${surface}-${dark?'short-dark':'wide-light'}-${category}-${rarity}.png`)});}
    }
    expect(tiers.size).toBe(5);
  }
});
