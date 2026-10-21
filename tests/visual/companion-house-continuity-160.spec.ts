import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output = process.env.COMPANION149_OBJECTS_OUTPUT ?? ".scratch-pw/companion-149/objects-native-observations";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type Toy = { id: string; kind: string; use: string; carried: boolean; held: boolean; falling: boolean; decoded: boolean; visible: boolean; x: number; y: number; rotation: number; transform: string; scale: string; effect: string };
type Frame = { at: number; state: string; play: string; aftertaste: string; homeLife: string; platform: string; scene: string; placing: boolean; actorDecoded: boolean; row: number; x: number; y: number; home: { light: boolean; tv: string; night: boolean; contact: boolean }; toys: Toy[]; foods: { id: string; kind: string; eating: boolean; discarding: boolean }[] };
type ObjectWindow = Window & { objects149?: { frames: Frame[]; meals: { at: number; kind: string }[]; discoveries: { at: number; toys: string[] }[]; stop(): void } };
type Proof = { errors: string[]; rejected: string[]; build: string; notes: unknown[]; html?: { path: string; sha256: string }; chunks: { path: string; sha256: string; matchesBuild: boolean }[]; pending: Promise<void>[] };
const proofs = new WeakMap<Page, Proof>();
test.use({ viewport: { width: 1920, height: 1100 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block", trace: "on", video: { mode: "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(110000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const buildRoot = process.env.VISUAL_TEST_BUILD_DIR ?? ".next", proof: Proof = { errors: [], rejected: [], build: readFileSync(resolve(buildRoot, "BUILD_ID"), "utf8").trim(), notes: [], chunks: [], pending: [] }; proofs.set(page, proof);
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(buildRoot, "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin !== origin || !url.pathname.startsWith("/_next/static/") || !/\.(js|css)$/.test(url.pathname)) return;
    proof.pending.push((async () => { const bytes = await response.body(), local = readFileSync(resolve(buildRoot, url.pathname.slice("/_next/".length))); proof.chunks.push({ path: url.pathname, sha256: hash(bytes), matchesBuild: bytes.equals(local) }); })().catch(error => { proof.errors.push("Chunk proof: " + String(error)); }));
  });
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, proof.rejected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previews.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.rejected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const observations = await page.evaluate(() => { const probe = (window as ObjectWindow).objects149; probe?.stop(); return probe ? { frames: probe.frames, meals: probe.meals, discoveries: probe.discoveries } : { frames: [], meals: [], discoveries: [] }; }).catch(() => ({ frames: [], meals: [], discoveries: [] }));
  const proof = proofs.get(page)!; await Promise.all(proof.pending); const { pending, ...summary } = proof; void pending;
  const name = info.title.replace(/[^a-z0-9]+/gi, "-"); mkdirSync(output, { recursive: true });
  const file = resolve(output, name + ".json"); writeFileSync(file, JSON.stringify({ schemaVersion: 1, ...summary, status: info.status, recordedAt: new Date().toISOString(), ...observations,
    scope: "Actual local native UI objects and real input. Initial synthetic saved preferences/care/collection/tastes and house-light choice only; no runtime, RNG, clock, geometry, brain or action replacement. Studio house time uses its existing hour fixture query; TV uses real clicks and the real fifteen-second priority wait. Read-only DOM and event observations. Actual sampled kinds are separate from all84-toy/five-aftertaste pure coverage; unsampled rare kinds remain unrun. No operating DB/login/writes or daily-factory exhaustive claim." }, null, 2));
  await info.attach("native-objects-149", { path: file, contentType: "application/json" }); await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.chunks.length).toBeGreaterThan(5); expect(proof.chunks.every(chunk => chunk.matchesBuild)).toBe(true);
});

type HouseScenario = { personality: CompanionPersonality; energy: number; sleep: boolean; hour: number; light: boolean };
async function setup(page: Page, surface: "viewer" | "studio" | "preview", feeding = false, house?: HouseScenario) {
  await page.addInitScript(({ preferences, memory, feeding, foods, epoch, key, house }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, personality: house?.personality ?? (feeding ? "gourmet" : "mischievous"), personalitySource: "manual", roam: false, feeding, sleep: false, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false, speed: "lively" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: house?.energy ?? .95, hunger: feeding ? .95 : .05 }));
    if (house) localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: house.light }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: feeding ? foods : [], behaviors: [], situations: [], gifts: { unlocked: [], equipped: null, pending: null } }));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys: [], seen: [], toyTastes: {}, foodTastes: {}, reasons: [] }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, feeding, foods: COMPANION_FOOD_KINDS, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, house });
  const response = await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : `/visual-fixture/studio?role=owner&y=2025&m=10&hour=${house?.hour ?? 12}&weather=clear`);
  const html = await response!.body(), proof = proofs.get(page)!; mkdirSync(output, { recursive: true });
  const path = resolve(output, `${test.info().title.replace(/[^a-z0-9]+/gi, "-")}-actual.html`); writeFileSync(path, html); proof.html = { path, sha256: hash(html) }; expect(html.toString("utf8")).toContain(proof.build);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await expect(page.locator(".vc-companion")).toBeVisible(); await openCompanionHome(page); await placeCompanionOnHomeFloor(page); await page.mouse.move(2, 2);
}
async function startRoaming(page: Page, enableAutomaticSleep = false) {
  const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "움직임", exact: true }).click();
  const roam = dialog.getByRole("switch", { name: "빅타민 돌아다니기 켜기/끄기", exact: true }); await expect(roam).toHaveAttribute("aria-checked", "false"); await roam.click(); await expect(roam).toHaveAttribute("aria-checked", "true");
  if (enableAutomaticSleep) { const sleep = dialog.getByRole("switch", { name: "빅타민 자동 잠자기 켜기/끄기", exact: true }); await expect(sleep).toHaveAttribute("aria-checked", "false"); await sleep.click(); await expect(sleep).toHaveAttribute("aria-checked", "true"); }
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
}
async function probe(page: Page) {
  await page.evaluate(() => {
    (window as ObjectWindow).objects149?.stop(); const frames: Frame[] = [], meals: { at: number; kind: string }[] = [], discoveries: { at: number; toys: string[] }[] = [];
    const began = performance.now(); let request = 0, stopped = false;
    const meal = (event: Event) => meals.push({ at: performance.now() - began, kind: String((event as CustomEvent<{ kind?: string }>).detail?.kind ?? "") });
    const discovery = (event: Event) => { const detail = (event as CustomEvent<{ toys?: string[] }>).detail; discoveries.push({ at: performance.now() - began, toys: detail?.toys ?? [] }); };
    window.addEventListener("vic:companion-consumed-food", meal); window.addEventListener("vic:companion-tastes", discovery);
    const sample = () => {
      if (stopped) return; const actor = document.querySelector<HTMLElement>(".vc-companion"), image = actor?.querySelector<HTMLImageElement>(".vc-texture"), transform = new DOMMatrixReadOnly(actor?.style.transform), size = parseFloat(actor?.style.getPropertyValue("--vc-size") ?? "92");
      const toys: Toy[] = [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(node => {
        const image = node.querySelector<HTMLImageElement>(".vc-toy-art"), rect = node.getBoundingClientRect(), css = getComputedStyle(node), matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        return { id: node.dataset.toyId ?? "", kind: node.dataset.kind ?? "", use: node.dataset.toyUse ?? "", carried: node.dataset.carried === "true", held: node.dataset.held === "true", falling: node.dataset.falling === "true", decoded: Boolean(image?.complete && image.naturalWidth), visible: Boolean(!node.hidden && !node.closest("[hidden],[inert]") && rect.width > 0 && rect.height > 0 && css.display !== "none" && css.visibility === "visible" && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight), x: matrix.m41, y: matrix.m42, rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, transform: node.style.transform, scale: node.style.getPropertyValue("--vc-toy-play-scale"), effect: node.dataset.playEffect ?? "" };
      });
      const room = document.querySelector<HTMLElement>(".vc-home-room"), tool = document.querySelector<HTMLElement>(".vc-home-touch-tool");
      frames.push({ at: performance.now() - began, state: actor?.dataset.state ?? "", play: actor?.dataset.play ?? "", aftertaste: actor?.dataset.foodAftertaste ?? "", homeLife: actor?.dataset.homeLife ?? "", platform: actor?.dataset.platform ?? "", scene: actor?.dataset.personalityScene ?? "", placing: Boolean(actor?.hasAttribute("data-placing")), actorDecoded: Boolean(image?.complete && image.naturalWidth), row: Math.round(parseFloat(actor?.style.getPropertyValue("--vc-row") ?? "0") * 40 / 100), x: transform.m41 + size / 2, y: transform.m42 + size, home: { light: Boolean(room?.hasAttribute("data-lamp-lit")), tv: room?.dataset.tv ?? "", night: Boolean(room?.hasAttribute("data-night")), contact: Boolean(tool && !tool.hidden && tool.getBoundingClientRect().width > 0 && getComputedStyle(tool).visibility === "visible") }, toys, foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => ({ id: node.dataset.food ?? "", kind: node.dataset.kind ?? "", eating: node.hasAttribute("data-eating"), discarding: node.hasAttribute("data-discarding") })) });
      request = requestAnimationFrame(sample);
    };
    request = requestAnimationFrame(sample); (window as ObjectWindow).objects149 = { frames, meals, discoveries, stop() { stopped = true; cancelAnimationFrame(request); window.removeEventListener("vic:companion-consumed-food", meal); window.removeEventListener("vic:companion-tastes", discovery); } };
  });
}
const read = (page: Page) => page.evaluate(() => { const probe = (window as ObjectWindow).objects149!; return { frames: probe.frames, meals: probe.meals, discoveries: probe.discoveries }; });


type MaterialSample160 = { at: number; lit: boolean; frontHidden: boolean; front: string[]; back: string[] };
type LampAttempt160 = { at: number; until: number; lit: boolean; changed: boolean; x: number; y: number };
type MaterialWindow160 = Window & { sofa160?: MaterialSample160[] };

async function expandedHome(page:Page){const home=await openCompanionHome(page),fold=home.locator('[data-home-action="fold"]');if(await fold.count()&&await fold.getAttribute('aria-expanded')==='false')await fold.click();return home;}
for(const surface of ['viewer','studio','preview'] as const)test('160 '+surface+' retains room controls resident and loose item identities across panel handoffs',async({page})=>{
 await setup(page,surface,true,{personality:'balanced',energy:.95,sleep:false,hour:0,light:true});
 let room=await expandedHome(page);const roomIdentity=await room.elementHandle(),bodyIdentity=await page.locator('.vc-companion').elementHandle();
 for(let i=0;i<2;i++){await room.locator('[data-home-action="toys"]').click();await page.waitForTimeout(400);}
 for(let i=0;i<2;i++){await room.locator('[data-home-action="feed"]').click();await page.waitForTimeout(400);}
 await expect(page.locator('.vc-toy')).toHaveCount(2);await expect(page.locator('.vc-food')).toHaveCount(2);
 await expect(page.locator('.vc-toy').first()).toHaveAttribute('data-falling','false');
 await room.locator('[data-home-action="tv"]').click();await expect(room.locator('.vc-home-room')).toHaveAttribute('data-tv','tori');
 const items=await page.locator('.vc-toy,.vc-food').evaluateAll(nodes=>nodes.map(n=>({id:(n as HTMLElement).dataset.toyId??(n as HTMLElement).dataset.food,kind:(n as HTMLElement).dataset.kind})).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
 for(let turn=0;turn<4;turn++){
  const panel=page.locator('.panel-place-ctl [data-act="panel-toggle"]:visible').first();await panel.click();await settlePanelLayout(page);room=await expandedHome(page);
  expect(await roomIdentity!.evaluate(node=>node.isConnected&&node===document.querySelector('.vc-home'))).toBe(true);
  expect(await bodyIdentity!.evaluate(node=>node.isConnected&&node===document.querySelector('.vc-companion'))).toBe(true);
  await expect(room.locator('.vc-home-room')).toHaveAttribute('data-tv','tori');
  await expect.poll(()=>page.locator('.vc-toy,.vc-food').evaluateAll(nodes=>nodes.map(n=>({id:(n as HTMLElement).dataset.toyId??(n as HTMLElement).dataset.food,kind:(n as HTMLElement).dataset.kind})).sort((a,b)=>String(a.id).localeCompare(String(b.id))))).toEqual(items);
 }
 proofs.get(page)!.notes.push({stage:'persistent-room-handoff',surface,items,turns:4,sameRoomAndResident:true});
 await page.reload();await expect(page.locator('.vc-toy,.vc-food')).toHaveCount(0);
});
test('160 occupied sofa material changes agree in every actual frame',async({page})=>{
 await setup(page,'viewer',false,{personality:'balanced',energy:.95,sleep:false,hour:0,light:true});
 const room=await expandedHome(page),seat=room.locator('.vc-home-cushion'),actor=page.getByRole('button',{name:'빅타민 · 쓰다듬고 옮기기',exact:true}),point=await seat.boundingBox();
 await actor.focus();await actor.press('p');await page.mouse.click(point!.x+point!.width/2,point!.y+point!.height/2);await page.mouse.move(2,2);await expect(page.locator('.vc-companion')).toHaveAttribute('data-platform','companion-home');
 await page.evaluate(()=>{const samples:MaterialSample160[]=[];const sample=()=>{const room=document.querySelector('.vc-home-room')!,front=document.querySelector<HTMLElement>('.vc-bed-foreground')!,back=room.querySelector('.vc-plush-bed')!;samples.push({at:performance.now(),lit:room.hasAttribute('data-lamp-lit'),frontHidden:front.hidden,front:['--vc-bed-cloth','--vc-bed-light','--vc-bed-shade'].map(k=>getComputedStyle(front).getPropertyValue(k)),back:['--vc-bed-cloth','--vc-bed-light','--vc-bed-shade'].map(k=>getComputedStyle(back).getPropertyValue(k))});if(samples.length<240)requestAnimationFrame(sample);};requestAnimationFrame(sample);(window as MaterialWindow160).sofa160=samples;});
 const lamp=room.locator('[data-home-action="light"]');for(let i=0;i<6;i++){await lamp.click();await page.waitForTimeout(250);}
 const samples=(await page.evaluate(()=>(window as MaterialWindow160).sofa160))!,mismatched=samples.filter((s:MaterialSample160)=>!s.frontHidden&&JSON.stringify(s.front)!==JSON.stringify(s.back));proofs.get(page)!.notes.push({stage:'sofa-material',samples,mismatched:mismatched.length});expect(samples.length).toBeGreaterThan(20);expect(mismatched).toEqual([]);
});
for(const personality of ['performer','curious','affectionate','sleepy','tidy','mischievous','gourmet','homebody','balanced'] as const)test('160 '+personality+' lamp interaction and continuous living45s',async({page})=>{
 await setup(page,'studio',false,{personality,energy:.95,sleep:false,hour:0,light:false});await expandedHome(page);await probe(page);await startRoaming(page);
 await page.waitForTimeout(45000);
 const observed=await read(page),frames=observed.frames,attempts:LampAttempt160[]=[];let current:LampAttempt160|undefined;
 for(const f of frames){const reaching=f.state==='play'&&f.play==='pounce'&&!!f.homeLife;if(reaching){if(!current)current={at:f.at,until:f.at,lit:f.home.light,changed:false,x:f.x,y:f.y};current.until=f.at;current.changed ||= f.home.light!==current.lit;}else if(current){attempts.push(current);current=undefined;}}
 const failures=attempts.filter(a=>!a.changed),repeated=failures.filter((a,i)=>failures.slice(Math.max(0,i-2),i+1).length===3&&a.at-failures[i-2].at<14000&&Math.abs(a.x-failures[i-2].x)<24);
 const meaningful=frames.filter(f=>f.actorDecoded&&['walk','jump'].includes(f.state));
 expect(repeated,'three unproductive lamp jumps cannot cycle at the same point').toEqual([]);expect(frames.some(f=>f.home.light),'night awake agent must actually reach and turn on the lamp').toBe(true);expect(meaningful.length).toBeGreaterThan(5);
 proofs.get(page)!.notes.push({stage:'actual-personality-continuity',personality,seconds:45,attempts,unproductiveRepeats:repeated.length,actualCalendarFrames:frames.filter(f=>!f.platform.startsWith('companion-home')&&f.actorDecoded).length});
});

test('161 actual meal admits first bite and a consumed food expression',async({page})=>{
 await setup(page,'studio',true,{personality:'gourmet',energy:.95,sleep:false,hour:12,light:true});const home=await expandedHome(page);await home.locator('[data-home-action="feed"]').click();await expect(page.locator('.vc-food')).toHaveCount(1);
 await page.evaluate(()=>{const entries:{id:string;at:number}[]=[],meals:unknown[]=[];const pet=document.querySelector('.vc-companion')!;const m=new MutationObserver(()=>{const id=pet.getAttribute('data-expression');if(id&&entries.at(-1)?.id!==id)entries.push({id,at:performance.now()});});m.observe(pet,{attributes:true,attributeFilter:['data-expression']});window.addEventListener('vic:companion-consumed-food',e=>meals.push((e as CustomEvent).detail));(window as Window&{meal161?:unknown}).meal161={entries,meals};});
 await probe(page);await startRoaming(page);await expect.poll(()=>page.evaluate(()=>((window as unknown as Window&{meal161:{meals:unknown[]}}).meal161.meals.length)),{timeout:45000}).toBeGreaterThan(0);await page.waitForTimeout(3400);
 const reaction=await page.evaluate(()=>(window as unknown as Window&{meal161:{entries:{id:string;at:number}[];meals:unknown[]}}).meal161),ids=reaction.entries.map(x=>x.id);proofs.get(page)!.notes.push({stage:'actual-meal-expressions',...reaction});expect(ids).toContain('first-bite');expect(ids.some(id=>['savor','hot','icy','spicy','sour'].includes(id))).toBe(true);expect(ids).not.toContain('melt');
});
