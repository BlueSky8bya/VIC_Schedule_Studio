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

const out=process.env.COMPANION153_OUTPUT??'.scratch-pw/companion-153';
const fonts=new Set([...readFileSync(resolve('app/fonts.css'),'utf8').matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match=>match[1]));
const proofs=new WeakMap<Page,{errors:string[];unexpected:string[];notes:unknown[]}>();
test.use({storageState:{cookies:[],origins:[]},serviceWorkers:'block',trace:'on',video:'on'});
test.setTimeout(45000);
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

test.afterEach(async({page},info)=>{const proof=proofs.get(page)!;mkdirSync(out,{recursive:true});const name=info.title.replace(/[^a-z0-9]+/gi,'-');writeFileSync(resolve(out,name+'.json'),JSON.stringify({case:info.title,status:info.status,buildId:readFileSync(resolve('.next/BUILD_ID'),'utf8').trim(),...proof},null,2));await page.screenshot({path:resolve(out,name+'.png')}).catch(()=>{});expect(proof.errors).toEqual([]);expect(proof.unexpected).toEqual([]);});
async function setup(page: Page, surface: "viewer" | "studio" | "preview", width: number, mode: "full" | "soft" | "off", dark = false) {
  await page.setViewportSize({ width, height: 780 });
  await page.addInitScript(({ defaults, memory, epoch, epochKey, mode, dark }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": mode === "full" ? "max" : mode === "soft" ? "auto" : "off", "vic.gfx": JSON.stringify({ mode, v: 3, at: Date.now() }), "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off", "vic.viewerCompanion": JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: false, sound: false, feeding: true, learnFromYou: false, ambientPrank: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }) })) localStorage.setItem(key, value);
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, mode, dark });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&ambient=autumn" : "/visual-fixture/studio?role=owner&y=2026&m=6&hour=23&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  if (width === 1100) { const fold = page.getByRole("button", { name: "패널 접기", exact: true }); if (await fold.isVisible()) { await fold.click(); await settlePanelLayout(page); } }
  await page.evaluate(() => document.fonts.ready);
  const home = await openCompanionHome(page); await settlePanelLayout(page);
  return home;
}


async function cordSample153(page:Page){return page.locator('.vc-home:visible').evaluate(home=>{const box=(selector:string)=>{const r=home.querySelector(selector)!.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const body=box('.vc-home-lamp-paint>img'),cord=box('.vc-home-lamp-cord'),knob=box('.vc-home-lamp-cord circle'),room=box('.vc-home-room');const x=(knob.left+knob.right)/2,y=(knob.top+knob.bottom)/2;return{body,cord,knob,room,clearance:cord.top-body.bottom,knobTarget:document.elementFromPoint(x,y)?.closest('button')?.getAttribute('data-home-action'),scale:body.width/parseFloat(getComputedStyle(home.querySelector('.vc-home-lamp-paint>img')!).width),lit:home.querySelector('[data-home-action=light]')!.getAttribute('aria-pressed')};});}
for(const [surface,mode,compact,dark] of [['viewer','full',false,false],['viewer','full',false,true],['studio','full',false,true],['preview','full',false,true],['viewer','full',true,false],['viewer','full',true,true],['viewer','soft',false,true],['viewer','off',false,false]] as const)test('153 '+surface+' '+mode+' '+(compact?'compact':'panel')+' '+(dark?'dark':'light')+' entire cord clears lamp',async({page})=>{
let home=await setup(page,surface,1920,mode,dark);
if(compact){const panel=page.locator('.poster-panel-ctl [data-act=panel-toggle]').first();await panel.click();await expect(panel).toHaveAttribute('aria-pressed','false');await settlePanelLayout(page);home=await openCompanionHome(page);await expect(home).toHaveAttribute('data-home-presentation','compact');await settlePanelLayout(page);}
const fold=home.locator('[data-home-action=fold]');if(await fold.count() && await fold.getAttribute('aria-expanded')==='false')await fold.click();
const lamp=home.locator('[data-home-action=light]'),curtain=home.locator('[data-home-action=curtain]');
for(const lit of [false,true]){if(await lamp.getAttribute('aria-pressed')!==String(lit))await lamp.click();await expect(lamp).toHaveAttribute('aria-pressed',String(lit));const roomBox=(await home.locator('.vc-home-room').boundingBox())!;await page.mouse.click(roomBox.x+roomBox.width-3,roomBox.y+12);await page.mouse.move(1,1);const before=await cordSample153(page);proofs.get(page)!.notes.push({stage:'entire-cord',...before});expect(before.clearance).toBeGreaterThanOrEqual(before.scale-.05);expect(before.cord.width).toBeLessThan(before.body.width/3);expect(before.knob.left).toBeGreaterThan(before.body.left+before.body.width/2);expect(before.knob.bottom).toBeLessThan(before.room.bottom);expect(before.knobTarget).toBe('light');await home.screenshot({path:resolve(out,[surface,mode,compact?'compact':'panel',dark?'dark':'light',lit?'on':'off'].join('-')+'.png')});
const k=before.knob;await page.mouse.move((k.left+k.right)/2,(k.top+k.bottom)/2);await page.mouse.down();const pressed=await cordSample153(page);proofs.get(page)!.notes.push({stage:'pressed',...pressed});expect(pressed.clearance).toBeGreaterThanOrEqual(pressed.scale-.05);await page.mouse.up();await expect(lamp).toHaveAttribute('aria-pressed',String(!lit));await lamp.focus();await lamp.press('Enter');await expect(lamp).toHaveAttribute('aria-pressed',String(lit));}
const saved=(await lamp.getAttribute('aria-pressed'))!;await curtain.click();await expect(lamp).toHaveAttribute('aria-pressed',saved);const radio=home.locator('[data-home-action=radio]');const radioTarget=await radio.evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')?.getAttribute('data-home-action');});expect(radioTarget).toBe('radio');await radio.click();await expect(radio).toHaveAttribute('aria-pressed','false');proofs.get(page)!.notes.push({stage:'nearby-muted-radio',radioTarget,playing:false,reason:'Fixture deliberately disables both global and companion sound; playback must remain muted.'});await expect(lamp).toHaveAttribute('aria-pressed',saved);
});
