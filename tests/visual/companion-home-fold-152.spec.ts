import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const out = process.env.COMPANION147_OUTPUT ?? ".scratch-pw/companion-147/items-scroll";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type ItemSample = { type: "food" | "toy"; id: string; platform: string; eligible: boolean; shown: boolean; dx: number; dy: number; native: boolean; x: number; y: number; floorX: number; floorY: number };
type Frame = { phase: "scroll" | "frame" | "post-render"; at: number; scroll: number; items: ItemSample[] };
type ProbeWindow = Window & { items147?: { frames: Frame[]; stop(): void } };
const proofs = new WeakMap<Page, { errors: string[]; unexpected: string[]; notes: unknown[] }>();
const summary = (frames: Frame[]) => {
  const items = frames.flatMap(frame => frame.items).filter(item => item.eligible);
  return { samples: items.length, missing: items.filter(item => !item.shown), maxDx: Math.max(0, ...items.filter(item => item.shown).map(item => Math.abs(item.dx))), maxDy: Math.max(0, ...items.filter(item => item.shown).map(item => Math.abs(item.dy))), candidatesOver2Px: items.filter(item => item.shown && Math.max(Math.abs(item.dx), Math.abs(item.dy)) >= 2) };
};

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", trace: "on", video: { mode: "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(75000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof = { errors: [] as string[], unexpected: [] as string[], notes: [] as unknown[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, proof.unexpected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previews.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.unexpected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).items147; probe?.stop(); return probe?.frames ?? []; }).catch(() => []);
  mkdirSync(out, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const buildId = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const observedClock = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, performanceNow: performance.now(), wallTimeMs: Date.now() })).catch(() => null);
  // DOM geometry can precede CSS anchor scroll compensation even in a zero-delay
  // post-rAF timer. Every phase remains a candidate, never a painted pass.
  const renderCandidates = frames.flatMap(frame => frame.items.filter(item => item.eligible && (!item.shown || Math.max(Math.abs(item.dx), Math.abs(item.dy)) >= 2)).map(item => ({ phase: frame.phase, at: frame.at, type: item.type, id: item.id, shown: item.shown, dx: item.dx, dy: item.dy })));
  const proof = proofs.get(page)!;
  const receipt = { schemaVersion: 1, kind: "companion-items-scroll-147", caseTitle: info.title, build: buildId, buildId, recordedAt: new Date().toISOString(), observedClock, status: info.status, admissionStatus: info.status === "passed" && !proof.errors.length && !proof.unexpected.length ? "passed" : "failed", renderedStatus: renderCandidates.length ? "needs_render_review" : "no_candidate_observed", renderThresholdCssPx: 2, renderCandidates, ...proof, phases: { rawScroll: summary(frames.filter(frame => frame.phase === "scroll")), rawFrame: summary(frames.filter(frame => frame.phase === "frame")), postRender: summary(frames.filter(frame => frame.phase === "post-render")) }, viewport: page.viewportSize(), frames, scope: "Admission asserts physical floor contact, native support, real scroll movement, per-item visibility, absence of missing post-timer objects and real grip/free flight. Every eligible >=2CSSpx error in scroll/rAF/post-timer DOM geometry remains needs_render_review. Only three fresh independent, case/build/raw-SHA-bound assessments of the original 1:1 trace/video can classify prepaint_observation; DOM admission alone does not prove painted alignment. No geometry/style/clock/RNG/engine injection." };
  const receiptPath = resolve(out, `${name}.json`);
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  await info.attach("actual-items-scroll-147", { path: receiptPath, contentType: "application/json" });
  await page.screenshot({ path: `${out}/${name}-final.png` }).catch(() => {});
  expect(proofs.get(page)!.errors).toEqual([]); expect(proofs.get(page)!.unexpected).toEqual([]);
});

async function setup(page: Page, surface: "viewer" | "studio" | "preview", width: number, mode: "full" | "soft" | "off") {
  await page.setViewportSize({ width, height: 780 });
  await page.addInitScript(({ defaults, memory, epoch, epochKey, mode }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": mode === "full" ? "max" : mode === "soft" ? "auto" : "off", "vic.gfx": JSON.stringify({ mode, v: 3, at: Date.now() }), "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off", "vic.viewerCompanion": JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: false, sound: false, feeding: true, learnFromYou: false, ambientPrank: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }) })) localStorage.setItem(key, value);
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, mode });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&ambient=autumn" : "/visual-fixture/studio?role=owner&y=2026&m=6&hour=23&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  if (width === 1100) { const fold = page.getByRole("button", { name: "패널 접기", exact: true }); if (await fold.isVisible()) { await fold.click(); await settlePanelLayout(page); } }
  await page.evaluate(() => document.fonts.ready);
  const home = await openCompanionHome(page); await settlePanelLayout(page);
  return home;
}


async function snapshot152(page:Page){return page.evaluate(()=>{const floor=document.querySelector('.vc-home-floor')!.getBoundingClientRect();return [...document.querySelectorAll<HTMLElement>('.vc-food,.vc-toy')].map(node=>{const r=node.getBoundingClientRect();return{id:node.dataset.food??node.dataset.toyId,kind:node.dataset.kind,platform:node.dataset.platform,hidden:node.hidden,display:getComputedStyle(node).display,x:r.left+r.width/2-floor.left,y:r.bottom-floor.bottom};});});}
for(const [surface,mode] of [['viewer','full'],['studio','full'],['preview','full'],['viewer','soft'],['viewer','off']] as const)test('152 '+surface+' '+mode+' home fold retains inside objects and leaves calendar objects outside',async({page})=>{
 const home=await setup(page,surface,1920,mode),fold=home.locator('[data-home-action="fold"]');
 for(let i=0;i<2;i++){
  await home.locator('[data-home-action="feed"]').click();await expect(page.locator('.vc-food')).toHaveCount(i+1);await expect(page.locator('.vc-food').last()).not.toHaveAttribute('data-falling',{timeout:8000});
  await home.locator('[data-home-action="toys"]').click();await expect(page.locator('.vc-toy')).toHaveCount(i+1);await expect(page.locator('.vc-toy').last()).toHaveAttribute('data-falling','false',{timeout:8000});
 }
 for(const [selector,x,y] of [['.vc-food',1250,270],['.vc-toy',1460,210]] as const){
  const node=page.locator(selector).last(),r=(await node.boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(x,y,{steps:16});await page.mouse.up();
  if(selector==='.vc-food')await expect(node).not.toHaveAttribute('data-falling',{timeout:8000});else await expect(node).toHaveAttribute('data-falling','false',{timeout:8000});
  await expect(node).not.toHaveAttribute('data-platform',/^companion-home/);
 }
 const before=await snapshot152(page);proofs.get(page)!.notes.push({stage:'before-home-fold',items:before});
 const inside=before.filter(n=>n.platform?.startsWith('companion-home')),outside=before.filter(n=>!n.platform?.startsWith('companion-home'));
 expect(inside).toHaveLength(2);expect(outside).toHaveLength(2);
 for(let cycle=0;cycle<3;cycle++){
  await page.evaluate(()=>{const win=window as Window&{fold152?:unknown[]};win.fold152=[];const check=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.id!=='companion-home'||detail.expanded!==false)return;window.removeEventListener('vic:panel-section',check);win.fold152=[...document.querySelectorAll<HTMLElement>('.vc-food,.vc-toy')].filter(node=>node.dataset.platform?.startsWith('companion-home')).map(node=>({id:node.dataset.food??node.dataset.toyId,hidden:node.hidden,display:getComputedStyle(node).display}));};window.addEventListener('vic:panel-section',check);});
  if(cycle===1){await fold.focus();await fold.press('Enter');}else await fold.click();
  await expect(fold).toHaveAttribute('aria-expanded','false');
  const sameCommit=await page.evaluate(()=>(window as Window&{fold152?:{hidden:boolean;display:string}[]}).fold152);proofs.get(page)!.notes.push({stage:'same-disclosure-commit',cycle,items:sameCommit});expect(sameCommit).toHaveLength(2);expect(sameCommit!.every(item=>item.hidden&&item.display==='none')).toBe(true);
  await page.waitForTimeout(300);const collapsed=await snapshot152(page);proofs.get(page)!.notes.push({stage:'collapsed',cycle,items:collapsed});
  for(const item of inside){const node=page.locator('[data-food="'+item.id+'"],[data-toy-id="'+item.id+'"]');await expect(node,'inside object is actually hidden, not merely marked hidden').toBeHidden();}
  for(const item of outside)await expect(page.locator('[data-food="'+item.id+'"],[data-toy-id="'+item.id+'"]')).toBeVisible();
  await expect(page.locator('.vc-food')).toHaveCount(2);await expect(page.locator('.vc-toy')).toHaveCount(2);
  await fold.click();await expect(fold).toHaveAttribute('aria-expanded','true');await settlePanelLayout(page);
  const expanded=await snapshot152(page);proofs.get(page)!.notes.push({stage:'expanded',cycle,items:expanded});
  for(const item of inside){const actual=expanded.find(n=>n.id===item.id)!;expect(actual.kind).toBe(item.kind);expect(actual.platform).toBe(item.platform);expect(Math.abs(actual.x-item.x)).toBeLessThan(1);expect(Math.abs(actual.y-item.y)).toBeLessThan(1);await expect(page.locator('[data-food="'+item.id+'"],[data-toy-id="'+item.id+'"]')).toBeVisible();}
 }
 await fold.click();await expect(fold).toHaveAttribute('aria-expanded','false');await page.reload();await page.evaluate(()=>document.fonts.ready);await settlePanelLayout(page);
 await expect(page.locator('.vc-food')).toHaveCount(0);await expect(page.locator('.vc-toy')).toHaveCount(0);
 const reopened=await openCompanionHome(page),savedFold=reopened.locator('[data-home-action="fold"]');await expect(savedFold).toHaveAttribute('aria-expanded','false');await savedFold.click();await expect(reopened.locator('.vc-home-room')).toBeVisible();await expect(page.locator('.vc-food,.vc-toy')).toHaveCount(0);
 proofs.get(page)!.notes.push({stage:'reload-reset',food:0,toys:0,scope:'Native source spawn, physical outside drag, repeated pointer/keyboard folds and native reload. No item-state/clock/RNG/geometry injection.'});
});
test('152 viewer full folding during a toy emission keeps the new object inside',async({page})=>{
 const home=await setup(page,'viewer',1920,'full'),fold=home.locator('[data-home-action="fold"]');
 await home.locator('[data-home-action="feed"]').click();await expect(page.locator('.vc-food')).toHaveCount(1);
 const r=(await fold.boundingBox())!;await home.locator('[data-home-action="toys"]').click();await expect(page.locator('.vc-toy')).toHaveAttribute('data-falling','true');
 await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await expect(fold).toHaveAttribute('aria-expanded','false');await page.waitForTimeout(1000);
 proofs.get(page)!.notes.push({stage:'folded-during-emission',items:await snapshot152(page)});
 await expect(page.locator('.vc-toy')).toHaveAttribute('data-platform',/^companion-home/);await expect(page.locator('.vc-toy')).toBeHidden();await expect(page.locator('.vc-food')).toBeHidden();
 await fold.click();await settlePanelLayout(page);await expect(page.locator('.vc-food')).toBeVisible();await expect(page.locator('.vc-toy')).toBeVisible();
 await expect(page.locator('.vc-toy')).toHaveAttribute('data-platform',/^companion-home/);
});
