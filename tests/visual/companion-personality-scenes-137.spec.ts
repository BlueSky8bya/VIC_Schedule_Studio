import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_NAMES, COMPANION_PREFERENCES_EVENT, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { companionPlayDuration, COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import type { CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { completedNativeTravel, type NativeTravelFrame, type NativeSupportSurface } from "./helpers/companion-native-travel";
import { enableCompanion143Diagnostics, readCompanion143Diagnostics } from "./helpers/companion-qa";

import { activityProgressTimes, stationaryActivityRepetitions, type ActivityObservation } from "../../scripts/companion-qa/activity-criteria.mjs";
import { curiousTextureCellMatches, type CuriousTextureCellMeasurement } from "./helpers/companion-curious-completion-144";
import { beforeBedRestPreparation157 } from "./helpers/companion-before-bed-rest-157";
import { completedTidyReturnGoal157 } from "./helpers/companion-tidy-primary-157";
import { installCompanionPaintedSource157, type PaintedSource157Proof, type PaintedSource157Window } from "./helpers/companion-painted-source-157";
import type { NativeHomeControlFrame } from "./helpers/companion-home-contact-156";

const output = process.env.COMPANION137_OUTPUT ?? ".scratch-pw/companion-137/native";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Surface = "viewer" | "studio" | "preview";
type Frame = NativeTravelFrame & {
  at: number; state: string; signature: string; scene: string; serial: string; beat: string; command: string; play: string; pose: number;
  x: number; y: number; platform: string; visible: boolean; decoded: boolean; tv: string; lit: boolean; curtain: string; curiosity: string;
  toys: { id: string; carried: boolean; held: boolean; x: number; y: number }[]; foods: string[];
  activity: ActivityObservation; cell: CuriousTextureCellMeasurement | null; sourcePaint: boolean; tvPaint: boolean;
  paintedSource?: PaintedSource157Proof;
  homeLife?: { phase: string; scene: string; serial: string; beat: string; reaching: string; lampTouch: boolean };
  homeSofa?: { left: number; right: number; top: number; visible: boolean };
  restControl?: NativeHomeControlFrame["control"];
  washing: boolean; brush: { x: number; y: number; visible: boolean } | null;
};
type ProbeWindow = Window & { personality137?: { samples: Frame[]; stop: () => void } };
type Proof = { errors: string[]; rejected: string[]; previewReads: number; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();

test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(110_000);

test.beforeEach(async ({ page, context, baseURL }) => {
  await enableCompanion143Diagnostics(page);
  const proof: Proof = { errors: [], rejected: [], previewReads: 0, notes: [] }; proofs.set(page, proof);
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewIds = new Set(Object.entries(actions).filter(([, entry]) => entry.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.resourceType() === "font" && url.origin !== origin) return fulfillReadOnlyFont(route, fonts, proof.rejected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previewIds.has(request.headers()["next-action"])) {
      proof.previewReads++;
      // Fulfill this one known public read from a synthetic public DTO. No
      // server action executes and no private/live source is contacted.
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live APIs in native fixture" });
    return route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  const frames = authenticateFrames(await page.evaluate(() => { const probe = (window as ProbeWindow).personality137; probe?.stop(); return probe?.samples ?? []; }).catch(() => []));
  const diagnostics143=await readCompanion143Diagnostics(page).catch(()=>[]);
  mkdirSync(output, { recursive: true }); const filename = info.title.replace(/[^a-z0-9]+/gi, "-");
  const path = resolve(output, filename + ".json");
  writeFileSync(path, JSON.stringify({ ...proofs.get(page), frames, diagnostics143, status: info.status, capturedAt: new Date().toISOString(), scope: "Production-build native fixture interactions and read-only rAF observations. Initial local saved preferences/care only. No RNG/clock/brain/geometry/style injection. Not a144 native-scene, OBS, real-login or RLS claim." }, null, 2));
  await info.attach("personality137-native", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, filename + ".png") }).catch(() => {});
  expect(proofs.get(page)!.errors).toEqual([]); expect(proofs.get(page)!.rejected).toEqual([]);
});

async function fixture(page: Page, surface: Surface, options: { personality?: CompanionPersonality; animalMode?: CompanionPreferences["animalMode"]; summer?: boolean; roam?: boolean; reduced?: boolean; gfxOff?: boolean; hunger?: number; sound?: boolean; energy?: number; sleep?: boolean; learnFromYou?: boolean } = {}) {
  await page.addInitScript(({ preferences, memory, epoch, epochKey, options }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": options.gfxOff ? "off" : "max", "vic.gfx": JSON.stringify({ mode: options.gfxOff ? "off" : "full", at: Date.now(), v: 3 }), "vic.sound": options.sound ? "on" : "off", "vic.soundVol": "45", "vic.ambient": "off", "vic.reduceMotion": options.reduced ? "on" : "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, personality: options.personality ?? "balanced", animalMode: options.animalMode ?? preferences.animalMode, roam: options.personality ? false : options.roam ?? true, sleep: options.sleep ?? false, feeding: true, sound: options.sound ?? false, learnFromYou: options.learnFromYou ?? false, heartPrank: false, cardPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: options.energy ?? .9, hunger: options.hunger ?? .05 }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, options });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : `/visual-fixture/studio?role=owner&y=2025&m=${options.summer ? 7 : 10}&hour=${options.summer ? 12 : 21}&weather=clear`);
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await expect(page.locator(".vc-companion")).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  //138 randomizes the first document personality. Deterministic scenario
  // preconditions use the real settings radio rather than seeded personality.
  if (options.personality) await selectNative(page, options.personality, options.roam ?? true);
  return openCompanionHome(page);
}

async function selectNative(page: Page, personality: CompanionPersonality, roam?: boolean, sleep?: boolean) {
  const home = await openCompanionHome(page);
  const book = home.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
  await expect(book).toBeVisible(); await book.click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  const group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true });
  await expect(group.getByRole("radio")).toHaveCount(9);
  const option = group.getByRole("radio", { name: COMPANION_PERSONALITY_NAMES[personality], exact: true });
  if (await option.getAttribute("aria-checked") === "true") await group.locator('[role="radio"][aria-checked="false"]').first().click();
  await option.click(); await expect(option).toHaveAttribute("aria-checked", "true");
  if (roam !== undefined || sleep !== undefined) {
    await dialog.getByRole("tab", { name: "움직임", exact: true }).click();
    if (roam !== undefined) await dialog.locator('[data-act="companion-roam"]').setChecked(roam);
    if (sleep !== undefined) await dialog.locator('[data-act="companion-sleep"]').setChecked(sleep);
  }
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden();
  await page.mouse.move(2, 2); await startProbe(page);
  return page.locator(".vc-companion");
}

async function startProbe(page: Page) {
  await installCompanionPaintedSource157(page);
  await page.evaluate(({ preferenceEvent, floorInset, metadata, playRows }) => {
    (window as ProbeWindow).personality137?.stop();
    let request = 0, last = -Infinity, stopped = false, epoch = 0, lastTrusted = -Infinity;
    let runId = 0, motionKind = "", resting = 0, source: HTMLElement | null = null, viewportSource = false;
    let preferences = { enabled:false,roam:false,jump:false };
    try { const saved = JSON.parse(localStorage.getItem("vic.viewerCompanion") ?? "{}"); preferences = { enabled:saved.enabled === true,roam:saved.roam === true,jump:saved.jump === true }; } catch { /* Unavailable preferences cannot prove autonomous travel. */ }
    const preference = (event: Event) => { const value = (event as CustomEvent<CompanionPreferences>).detail; preferences = {enabled:value.enabled === true,roam:value.roam === true,jump:value.jump === true}; };
    const changed = () => { epoch++; };
    const input = (event: Event) => { if (event.isTrusted) { epoch++; lastTrusted = performance.now(); } };
    window.addEventListener("scroll",changed,true); window.addEventListener("resize",changed);
    document.addEventListener("keydown",input,true); document.addEventListener("pointerdown",input,true); document.addEventListener("pointermove",input,true); window.addEventListener(preferenceEvent,preference);
    const began = performance.now(), samples: Frame[] = [];
    const edgeNodes = (x: number,y: number) => {
      const nodes = document.elementsFromPoint(x,Math.min(innerHeight-1,y+4)).flatMap(element => {
        if (element.closest(".vc-companion,.vc-toy,.vc-food")) return [];
        const node = element.closest<HTMLElement>(".public-event,.agenda-event,.agenda-item,[data-companion-event='ordinary'],.public-day,.agenda-day,.studio-day,.support-bar,.weekday-row,.public-calendar-header,.studio-weekdays");
        return node ? [node] : [];
      });
      // A day-floor foot is bottom-3: the old y+4 hit crosses into the next day.
      // Only add a real painted, unclipped public DAY border from the upper hit.
      const upper = document.elementsFromPoint(x,Math.max(0,Math.min(innerHeight-1,y+2))).find(element => !element.closest(".vc-companion,.vc-toy,.vc-food"));
      const day = upper?.closest<HTMLElement>(".public-day,.agenda-day,.studio-day");
      if(day && !upper?.closest(".vc-home,button,input,select,textarea,[role='button'],[role='switch']") && !day.closest(".dimmed,[hidden],[inert],[aria-hidden='true']") && day.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && /^\d{4}-\d{2}-\d{2}$/.test(day.getAttribute("data-date") ?? day.getAttribute("data-isodate") ?? "")){
        const rect=day.getBoundingClientRect(),style=getComputedStyle(day),width=Number.parseFloat(style.borderBottomWidth);
        const color=/^rgba?\(([^)]+)\)$/.exec(style.borderBottomColor.trim().toLowerCase()),parts=color?.[1].split("/") ?? [];
        const values=parts[0]?.trim().split(/[\s,]+/).filter(Boolean) ?? [],alpha=parts[1]?.trim() ?? (values.length===4 ? values.pop()! : "1");
        const validColor=parts.length<=2 && values.length===3 && values.every(value=>/^\d*\.?\d+%?$/.test(value) && Number.parseFloat(value)<= (value.endsWith("%") ? 100 : 255)) && /^\d*\.?\d+%?$/.test(alpha) && Number.parseFloat(alpha)>0 && Number.parseFloat(alpha)<= (alpha.endsWith("%") ? 100 : 1);
        if(rect.width>0 && rect.height>0 && rect.bottom>0 && rect.bottom<=innerHeight && x>=rect.left && x<=rect.right && Math.abs(y-(rect.bottom-3))<=3 && Number(style.opacity)>0.05 && /^\d*\.?\d+px$/.test(style.borderBottomWidth) && Number.isFinite(width) && width>0 && style.borderBottomStyle==="solid" && validColor){
          // Exact first painted border hit rejects a clipped edge, house or control cover.
          const border=document.elementsFromPoint(x,rect.bottom-.01).find(element=>!element.closest(".vc-companion,.vc-toy,.vc-food"));
          if(border===day) nodes.unshift(day);
        }
      }
      return [...new Set(nodes)];
    };
    const supportAt = (x:number,y:number,platform:string): {support:NativeSupportSurface|null;inkRects:NativeSupportSurface["rect"][]} => {
      const surfaces:NativeSupportSurface[]=[],inkRects:NativeSupportSurface["rect"][]=[];
      const add=(kind:NativeSupportSurface["kind"],rect:DOMRect|undefined,footY:number,node?:Element|null,registered=false)=>{
        if(!rect || !node?.isConnected || !node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) || !rect.width || !rect.height) return;
        surfaces.push({kind,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},footY,visible:true,...(kind === "ink" ? {registered} : {})});
      };
      if(/^companion-home-floor(?:-\d+)?$/.test(platform)){
        const node=platform === "companion-home-floor-400" ? document.querySelector<HTMLElement>(".vc-home-wash-stance") ?? document.querySelector<HTMLElement>(".vc-home-wash-pad") : document.querySelector<HTMLElement>(".vc-home-floor"),rect=node?.getBoundingClientRect();
        add("home",rect,rect ? platform === "companion-home-floor-400" ? rect.top+rect.height*.72 : rect.bottom-floorInset : NaN,node);
      }else if(platform === "companion-home"){
        const node=document.querySelector<HTMLElement>(".vc-home-cushion"),rect=node?.getBoundingClientRect();add("home",rect,rect?.top ?? NaN,node);
      }else if(/^viewport-floor(?:-\d+)?$/.test(platform)) surfaces.push({kind:"viewport",rect:{x:0,y:innerHeight-18,width:innerWidth,height:18},footY:innerHeight-18,visible:true});
      else {
        const hits=document.elementsFromPoint(x,Math.min(innerHeight-1,y+4)),inks=new Set<HTMLElement>(),days=new Set<HTMLElement>();
        const dateInk=".day-strip > strong,.agenda-when > strong,.studio-day-head > strong";
        const publicInk=".public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li,[data-companion-event='ordinary'] .pill-main strong,[data-companion-event='ordinary'] .pill-subs li,[data-companion-event='ordinary'] .pill-sub-last .pill-sub-text,[data-companion-event='ordinary'] .agenda-title-text,[data-companion-event='ordinary'] .agenda-subs li";
        for(const element of hits){
          if(element.closest(".vc-companion,.vc-toy,.vc-food")) continue;
          const ink=element.closest<HTMLElement>("strong,p,li,.agenda-title-text,.agenda-title,.pill-sub-text"),day=element.closest<HTMLElement>(".public-day,.agenda-day,.studio-day");
          if(ink && day && ink.matches(dateInk+","+publicInk)) inks.add(ink);if(day) days.add(day);
        }
        // Match the actual public ink scopes in geometry.ts. No textContent,
        // event identity, private-card selector or geometry callback is read.
        for(const day of [...days].slice(0,4)) for(const node of [...day.querySelectorAll<HTMLElement>(dateInk+","+publicInk)].slice(0,64)) inks.add(node);
        for(const ink of [...inks].slice(0,64)){
          if(surfaces.length>=128) break;
          const owner=ink.closest<HTMLElement>(ink.matches(dateInk) ? ".public-day,.agenda-day,.studio-day" : ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]");
          if(!owner || ![...days].some(day=>day.contains(owner))) continue;
          if(!ink.isConnected || !ink.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) continue;
          const range=document.createRange();range.selectNodeContents(ink);const rects=[...range.getClientRects()].slice(0,16);range.detach();
          for(const rect of rects){if(surfaces.length>=128) break;add("ink",rect,rect.top-3,ink,true);if(rect.width>0 && rect.height>0 && inkRects.length<128) inkRects.push({x:rect.x,y:rect.y,width:rect.width,height:rect.height});}
        }
        for(const node of edgeNodes(x,y)){
          const rect=node.getBoundingClientRect(),bottom=node.matches(".public-day,.agenda-day,.studio-day,.weekday-row,.public-calendar-header,.studio-weekdays");
          add("edge",rect,(bottom ? rect.bottom : rect.top)-3,node);
        }
      }
      const support=surfaces.find(surface=>[surface.footY,...Object.values(surface.rect)].every(Number.isFinite) && x>=surface.rect.x-1 && x<=surface.rect.x+surface.rect.width+1 && Math.abs(y-surface.footY)<=3) ?? null;
      return {support,inkRects};
    };
    const restPaint = (node: Element | null | undefined): NativeHomeControlFrame["control"]["tool"] => {
      if (!node) return { visible:false,rect:null };
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},visible:Boolean(!document.hidden && !node.closest("[hidden],[inert]")
        && rect.width>0 && rect.height>0 && rect.right>0 && rect.bottom>0 && rect.left<innerWidth && rect.top<innerHeight
        && css.visibility==="visible" && css.display!=="none" && Number(css.opacity)>.05 && node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) };
    };
    const sample = (now: number) => {
      if (stopped) return;
      if (now - last >= 40) {
        last = now; const actor = document.querySelector<HTMLElement>(".vc-companion"), texture = actor?.querySelector<HTMLImageElement>(".vc-texture"), r = actor?.getBoundingClientRect(), room = document.querySelector<HTMLElement>(".vc-home-room"), brush = document.querySelector<HTMLElement>(".vc-wash-tool"), brushRect = brush?.getBoundingClientRect();
        const state=actor?.dataset.state ?? "",platform=actor?.dataset.platform ?? "",x=r ? r.left+r.width/2 : NaN,y=r?.bottom ?? NaN,moving=state === "walk" || state === "jump";
        if (moving) {
          if (motionKind !== state) {
            runId++;const prior=samples.at(-1),from=prior ?? {x,y,platform};
            source=/^companion-home(?:-|$)/.test(from.platform) ? room : edgeNodes(from.x,from.y)[0] ?? null;
            viewportSource=/^viewport-floor(?:-\d+)?$/.test(from.platform);
          }
          motionKind=state;resting=0;
        } else if (motionKind && ++resting>2) motionKind="";
        const supported=!moving && Boolean(motionKind) && resting<=2 ? supportAt(x,y,platform) : {support:null,inkRects:[]};
        const anchor=viewportSource ? {x:0,y:0,width:innerWidth,height:innerHeight} : source?.isConnected ? source.getBoundingClientRect() : null;
        const sprite=actor?.querySelector<HTMLElement>(".vc-sprite"),pose=Number(actor?.dataset.pose??-1),packet=metadata.frames[pose];
        const paintedSource=(window as PaintedSource157Window).companionPaintedSource157?.inspect(actor);
        let cell:CuriousTextureCellMeasurement|null=null;
        if(texture&&sprite)try{
          const tc=getComputedStyle(texture),sc=getComputedStyle(sprite),url=new URL(texture.currentSrc,location.href);
          const px=(v:string)=>/^-?\d*\.?\d+px$/.test(v)?Number.parseFloat(v):NaN;
          const matrix=(v:string)=>{const m=new DOMMatrixReadOnly(v);return [m.m11,m.m12,m.m13,m.m14,m.m21,m.m22,m.m23,m.m24,m.m31,m.m32,m.m33,m.m34,m.m41,m.m42,m.m43,m.m44];};
          cell={currentPath:url.origin===location.origin&&!url.search&&!url.hash?url.pathname:null,connectedToSprite:texture.isConnected&&sprite.isConnected&&texture.parentElement===sprite&&Boolean(actor?.contains(sprite)),naturalWidth:texture.naturalWidth,naturalHeight:texture.naturalHeight,textureWidth:px(tc.width),textureHeight:px(tc.height),spriteWidth:px(sc.width),spriteHeight:px(sc.height),textureLeft:px(tc.left),textureTop:px(tc.top),textureMatrix:matrix(tc.transform),spriteMatrix:matrix(sc.transform),spriteClipPath:sc.clipPath,textureClipPath:tc.clipPath};
        }catch{/* Unmeasured pixels earn no activity. */}
        const play=actor?.dataset.play??"",rows=state==="play"?playRows[play]:({sniff:[1],stretch:[16],shake:[17],walk:[2,20],jump:[3,4,5,6,7]} as Record<string,number[]>)[state];
        const action=rows?.some(row=>metadata.rows[row]?.includes(pose))?state==="play"?`play:${play}`:state:"";
        const root=document.documentElement.getBoundingClientRect(),picture=room?.querySelector<HTMLImageElement>(".vc-tv-picture img"),channel=room?.dataset.tv;
        const expectedPicture=channel==="tori"?"/companion/home/143/tv-screen-tori.webp":`/companion/home/135/tv-screen-${channel}.webp`;
        const tvPaint=Boolean(picture?.complete&&picture.naturalWidth&&picture.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&new URL(picture.currentSrc,location.href).pathname===expectedPicture);
        // Raw cell is authenticated after extraction, outside this observer.
        const activity:ActivityObservation={source:false,manual:now-lastTrusted<1000||state==="held"||Boolean(actor?.hasAttribute("data-placing")),epoch,jumpAllowed:preferences.jump,width:r?.width??0,height:r?.height??0,anchor:{x:root.x,y:root.y,width:root.width,height:root.height},action:packet?action:"",context:""};
        const cushion = room?.querySelector<HTMLElement>(".vc-home-cushion"), cushionRect = cushion?.getBoundingClientRect();
        const homeSofa = cushion && cushionRect ? { left: cushionRect.left, right: cushionRect.right, top: cushionRect.top,
          visible: cushion.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && cushionRect.width > 0 && cushionRect.height > 0 } : undefined;
        const homeLife = actor?.dataset.homeLife ? { phase: actor.dataset.homeLife, scene: actor.dataset.homeLifeScene ?? "", serial: actor.dataset.homeLifeSerial ?? "", beat: actor.dataset.homeLifeBeat ?? "",
          reaching: actor.dataset.homeReaching ?? "", lampTouch: Boolean(room?.querySelector(".vc-home-lamp[data-companion-touch]")) } : undefined;
        let restControl: NativeHomeControlFrame["control"] | undefined;
        if (actor?.dataset.personalityScene === "S03" || homeLife?.scene === "S03") {
          const lamp = room?.querySelector<HTMLElement>(".vc-home-lamp"), lp = lamp?.querySelector<HTMLElement>(".vc-home-lamp-paint"), handle = lamp?.querySelector<HTMLElement>(".vc-home-lamp-handle"), television = room?.querySelector<HTMLElement>(".vc-home-tv-paint"), tvBody = television?.querySelector<HTMLImageElement>(".vc-home-tv-body");
          const lampState = room?.hasAttribute("data-lamp-lit") ? "on" : "off", art = lamp?.querySelector<HTMLElement>(`.vc-home-lamp-art[data-lamp-state="${lampState}"]`), feedback = lamp?.querySelector<HTMLElement>(`.vc-home-lamp-cord-feedback[data-lamp-state="${lampState}"]`);
          restControl = { actor:{...restPaint(actor),decoded:Boolean(texture?.complete&&texture.naturalWidth),pose,src:texture?.currentSrc??"",platform,reach:actor?.dataset.homeReaching??""},
            tool:restPaint(document.querySelector(".vc-home-touch-tool")),
            lamp:{button:restPaint(lamp),paint:restPaint(lp),handle:restPaint(handle),touch:Boolean(lamp?.hasAttribute("data-companion-touch")),state:lampState,
              requestedPull:parseFloat(lamp?getComputedStyle(lamp).getPropertyValue("--vc-lamp-pull"):"NaN"),cssWidth:parseFloat(lp?getComputedStyle(lp).width:"NaN"),
              art:{...restPaint(art),source:art?getComputedStyle(art).borderImageSource:""},feedback:{...restPaint(feedback),source:feedback?getComputedStyle(feedback).borderImageSource:"",opacity:Number(feedback?getComputedStyle(feedback).opacity:0),clip:feedback?getComputedStyle(feedback).clipPath:""}},
            tv:{...restPaint(television),decoded:Boolean(tvBody?.complete&&tvBody.naturalWidth),src:tvBody?.currentSrc??""} };
        }
        samples.push({ at: now - began, homeLife, homeSofa, restControl, state, signature: actor?.dataset.personalityActivity ?? "", scene: actor?.dataset.personalityScene ?? "", serial: actor?.dataset.personalitySerial ?? "", beat: actor?.dataset.personalityBeat ?? "", command: actor?.dataset.personalityCommand ?? "", play: actor?.dataset.play ?? "", pose: Number(actor?.dataset.pose ?? -1), x,y,platform, visible: Boolean(actor && !document.hidden && !actor.hidden && r!.width && r!.height && r!.bottom > 0 && r!.top < innerHeight && r!.right > 0 && r!.left < innerWidth && actor.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})), decoded: Boolean(texture?.complete && texture.naturalWidth), tv: room?.dataset.tv ?? "off", lit: room?.hasAttribute("data-lamp-lit") ?? false, curtain: room?.querySelector<HTMLElement>(".vc-home-window")?.dataset.curtain ?? "", curiosity: actor?.dataset.foodCuriosity ?? "",
          activity,cell,tvPaint,paintedSource,sourcePaint:paintedSource?.passed===true,
          travel:{id:runId,epoch,...preferences,manual:state === "held" || Boolean(actor?.hasAttribute("data-placing")) || now-lastTrusted < 1000,actorWidth:r?.width ?? 0,actorHeight:r?.height ?? 0,anchor:anchor ? {x:anchor.x,y:anchor.y,width:anchor.width,height:anchor.height} : null,supported:Boolean(supported.support),...supported},
          toys: [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(node => { const box = node.getBoundingClientRect(); return { id: node.dataset.toyId!, carried: node.dataset.carried === "true", held: node.dataset.held === "true", x: box.left + box.width / 2, y: box.bottom }; }), foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => node.dataset.food!), washing: actor?.hasAttribute("data-washing") ?? false, brush: brush && brushRect ? { x: brushRect.left + brushRect.width / 2, y: brushRect.top + brushRect.height / 2, visible: !brush.hidden && getComputedStyle(brush).visibility !== "hidden" && brushRect.width > 0 } : null });
      }
      if (now - began < 130_000) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).personality137 = { samples, stop() { stopped = true; cancelAnimationFrame(request);
      window.removeEventListener("scroll",changed,true);window.removeEventListener("resize",changed);document.removeEventListener("keydown",input,true);document.removeEventListener("pointerdown",input,true);document.removeEventListener("pointermove",input,true);window.removeEventListener(preferenceEvent,preference);
    } }; request = requestAnimationFrame(sample);
  },{preferenceEvent:COMPANION_PREFERENCES_EVENT,floorInset:COMPANION_HOME_FLOOR_INSET,metadata:companionSpriteMetadata,playRows:Object.fromEntries(Object.entries(COMPANION_PLAY_TIMING).map(([key,value])=>[key,value.beats.map(beat=>beat.row)]))});
}
const authenticateFrames=(observed:readonly Frame[])=>observed.map(frame=>({...frame,enabled:frame.travel.enabled,roam:frame.travel.roam,activity:{...frame.activity,source:frame.sourcePaint&&curiousTextureCellMatches(frame.pose,frame.cell),context:JSON.stringify([frame.foods,frame.toys.map(t=>[t.id,t.carried]),frame.tv,frame.lit,frame.curtain])}}));
const frames = async (page: Page) => authenticateFrames(await page.evaluate(() => (window as ProbeWindow).personality137?.samples ?? []));
const duration = async (page: Page, ms: number) => expect.poll(async () => (await frames(page)).at(-1)?.at ?? 0, { timeout: ms + 8000, intervals: [250] }).toBeGreaterThanOrEqual(ms);
function signature(frame: Frame, personality: CompanionPersonality) {
  if(!frame.activity.source)return false;
  //143 replaces private-room audience performances with actual personal
  // preparation. Witness the decoded declared action row, never its label.
  const preparation = ["performer", "balanced", "sleepy"].includes(personality) ? { state: "stretch", row: 16 }
    : ["curious", "gourmet"].includes(personality) ? { state: "sniff", row: 1 } : undefined;
  if (preparation && frame.scene === `entry-${personality}` && frame.visible && frame.decoded && frame.signature === personality
    && frame.state === preparation.state && companionSpriteMetadata.rows[preparation.row].includes(frame.pose)) return true;
  const timing = COMPANION_PLAY_TIMING[frame.play as keyof typeof COMPANION_PLAY_TIMING];
  return frame.visible && frame.decoded && frame.signature === personality && frame.state === "play" && Boolean(timing?.beats.some(beat => companionSpriteMetadata.rows[beat.row].includes(frame.pose)));
}
function meaningful(trace: readonly Frame[], index: number, activity: ReadonlySet<number>) {
  const frame=trace[index];if(!frame.visible||!frame.decoded||!frame.travel.enabled||!frame.activity.source||frame.activity.manual)return false;
  if(activity.has(frame.at))return true;
  const prior=trace[index-1];
  if(prior && (frame.foods.join("|")!==prior.foods.join("|") || JSON.stringify(frame.toys.map(t=>[t.id,t.carried]))!==JSON.stringify(prior.toys.map(t=>[t.id,t.carried]))))return true;
  // Rest is an explicit exception, not a fictitious activity/landing receipt.
  return frame.state==="sleep"&&[10,11,12,35,36,40].some(row=>companionSpriteMetadata.rows[row]?.includes(frame.pose));
}

/**143 weighted sampling no longer guarantees a24-item bag. Acquisition is
 * bounded to320 real draws; the subsequent115s living proof is unchanged.
 * Choose through the actual weighted catalogue and physically return unwanted
 * draws. No item kind, recipe, clock or actor state is supplied to the app. */
async function drawNativeToy(page: Page, kind: CompanionToyKind) {
  const home = await openCompanionHome(page);
  for (let draw = 0; draw < 320; draw++) {
    await home.locator('[data-home-action="toys"]').click();
    const toy = page.locator(".vc-toy"); await expect(toy).toHaveCount(1);
    await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 });
    if (await toy.getAttribute("data-kind") === kind) return (await toy.getAttribute("data-toy-id"))!;
    const rect = (await toy.boundingBox())!, box = (await home.locator(".vc-toy-box-opening").boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height - 6); await page.mouse.down();
    await expect(toy).toHaveAttribute("data-held", "true");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await expect(home.locator('[data-home-action="toys"]')).toHaveAttribute("data-toy-over", "");
    await page.mouse.up(); await expect(toy).toHaveCount(0);
  }
  throw new Error(`actual bounded weighted draws did not produce ${kind}; no rarity or random state was overridden`);
}

function finishedRecipes(trace: readonly Frame[], opening: { x: number; y: number }) {
  return COMPANION_PERSONALITY_SCENES.filter(recipe => {
    // Keep attempts separate: an abbreviated first run cannot borrow a
    // missing pose or real effect from a later execution of the same scene.
    const attempts: { start: number; end: number }[] = [];
    let start = -1, lastBeat = -1, attemptSerial = "";
    const ownedPreparations = beforeBedRestPreparation157(trace, recipe.id, opening).indices;
    const actualGeneric = (frame: Frame | undefined) => {
      if (!frame || frame.scene || !frame.visible || !frame.decoded || !frame.activity.source || frame.state === "idle") return false;
      if (frame.state === "play") return Boolean(COMPANION_PLAY_TIMING[frame.play as keyof typeof COMPANION_PLAY_TIMING]?.beats
        .some(beat => companionSpriteMetadata.rows[beat.row].includes(frame.pose)));
      const rows: Record<string, number[]> = { look: [1, 26], sniff: [1], stretch: [16], shake: [17], walk: [2, 20], jump: [3, 4, 5, 6], eat: [1, 9], sleep: [10, 11, 12, 35, 36, 40] };
      return Boolean(rows[frame.state]?.some(row => companionSpriteMetadata.rows[row].includes(frame.pose)));
    };
    for (let i = 0; i < trace.length; i++) {
      const frame = trace[i];
      if (frame.scene === recipe.id) {
        const beat = Number(frame.beat);
        if (start >= 0 && (beat < lastBeat || frame.serial && frame.serial !== attemptSerial)) { attempts.push({ start, end: i }); start = i; }
        if (start < 0) start = i;
        attemptSerial = frame.serial;
        lastBeat = beat;
      } else if (start >= 0) {
        // A157 pre-bed lamp prerequisite retains the exact S03 go-sofa goal.
        // Same physical return, actual155 cord ACK, real movement, current
        // owner/cell and subsequent sofa preparation must all be witnessed.
        // Its time provides no credit for the required cozy/sleep stages.
        if (ownedPreparations.has(i)) continue;
        const next = trace[i + 1];
        const previous = trace.slice(start, i).reverse().find(value => value.scene === recipe.id && value.visible && value.decoded);
        const realGenericBoundary = actualGeneric(frame) && actualGeneric(next) && next.state === frame.state && next.play === frame.play
          && next.at > frame.at && next.at - frame.at <= 160 && Boolean(previous
            && (frame.state !== previous.state || frame.play !== previous.play || frame.pose !== previous.pose));
        // Completing a source scene need not start another source script.
        // A genuine newly painted ordinary action also closes this attempt;
        // empty/idle labels alone still cannot prove completion.
        if (frame.scene || realGenericBoundary) { attempts.push({ start, end: i }); start = -1; lastBeat = -1; attemptSerial = ""; }
      }
    }
    return attempts.some(attempt => {
      const run = trace.slice(attempt.start, attempt.end), following = trace[attempt.end];
      const stageFor = (beat: number) => run.filter(frame => frame.visible && frame.decoded && frame.sourcePaint && frame.activity.source && frame.scene === recipe.id && Number(frame.beat) === beat);
      const playedFor = (stage: readonly Frame[], state: string, ms: number, play?: string) => {
        const timing = play ? COMPANION_PLAY_TIMING[play as keyof typeof COMPANION_PLAY_TIMING] : undefined;
        const rows = state === "sleep" ? [10, 11, 12, 40, ...COMPANION_PLAY_TIMING["cozy-nest"].beats.map(beat => beat.row)]
          : state === "look" || state === "sniff" ? [1] : state === "stretch" ? [16] : state === "shake" ? [17] : undefined;
        const painted = stage.filter(frame => frame.state === state && (!play || frame.play === play
          && timing?.beats.some(beat => companionSpriteMetadata.rows[beat.row].includes(frame.pose)))
          && (!rows || rows.some(row => companionSpriteMetadata.rows[row].includes(frame.pose))));
        return painted.length > 1 && painted.at(-1)!.at - painted[0].at >= ms * .8 - 80;
      };
      const returned = (stage: readonly Frame[]) => stage.some(frame => frame.toys.some(toy => toy.carried
        && Math.hypot(toy.x - opening.x, toy.y - opening.y) < 20
        && trace.slice(attempt.start).some(later => later.at > frame.at && !later.toys.some(item => item.id === toy.id))));
      // Every required visible performance must really play in this one run.
      // Elapsed stretch never substitutes for sleep, and a terminal bow never
      // proves a preceding pose that the progress policy legitimately omitted.
      for (let beat = 0; beat < recipe.steps.length; beat++) {
        const command = recipe.steps[beat]; if (command.optional) continue;
        const stage = stageFor(beat);
        if (command.kind === "pose" && !( ["look", "sniff", "stretch", "shake"].includes(command.pose)
          ? playedFor(stage, command.pose, Math.min(2500, command.ms ?? 900))
          : playedFor(stage, "play", companionPlayDuration(command.pose as keyof typeof COMPANION_PLAY_TIMING), command.pose))) return false;
        if (command.kind === "watch") {
          const tvWatch=recipe.steps.slice(0,beat).some(step=>step.kind==="tv");
          if(!playedFor(stage.filter(frame=>frame.activity.source&&(!tvWatch||frame.tv!=="off"&&frame.tvPaint)),"look",Math.min(3500,Math.max(650,command.ms))))return false;
        }
        if (command.kind === "sleep" && (!playedFor(stage, "sleep", Math.min(7000, Math.max(2000, command.ms)))
          || stage.filter(frame => frame.state === "sleep" && [11, 40].some(row => companionSpriteMetadata.rows[row].includes(frame.pose))).length < 2)) return false;
        if (command.kind === "wash") {
          const contact = stage.filter(frame => frame.washing && frame.brush?.visible);
          if (!(contact.length > 1 && contact.at(-1)!.at - contact[0].at >= 500)) return false;
        }
        if (command.kind === "toy" && command.mode === "return" && !returned(stage)) return false;
      }
      const beat = recipe.steps.reduce((last, step, i) => step.optional ? last : i, -1), command = recipe.steps[beat], stage = stageFor(beat);
      if (["pose", "watch", "sleep", "wash"].includes(command.kind)) return true;
      if (command.kind === "toy" && command.mode === "return") return returned(stage);
      if (command.kind === "go") {
        const reached = command.target === "sofa" ? following.platform === "companion-home"
          : ["floor", "box", "dispenser", "window", "pad"].includes(command.target) ? /^companion-home-floor/.test(following.platform) : Boolean(following.platform);
        return reached && stage.some(frame => ["walk", "jump"].includes(frame.state))
          && Math.hypot(following.x - stage[0].x, following.y - stage[0].y) > 8;
      }
      // Other terminal effects require a dedicated physical assertion.
      return false;
    });
  });
}

const toys140: Partial<Record<CompanionPersonality, CompanionToyKind>> = {
  performer: "maraca", curious: "kaleidoscope", affectionate: "duck", sleepy: "feather",
  tidy: "ball", mischievous: "ball", homebody: "train", balanced: "ball",
};
test("140 sleepy responds to an actual calm recording and stops its music sequence when native radio volume reaches zero", async ({ page }) => {
  const home = await fixture(page, "studio", { personality: "sleepy", sound: true }); await placeCompanionOnHomeFloor(page);
  const openRadio = async () => {
    await home.locator('[data-home-action="book"]').click();
    const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
    await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
    await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "소리", exact: true }).click();
    return { dialog, radio: dialog.locator(".rhh-companion-radio") };
  };
  let { dialog, radio } = await openRadio();
  const track = COMPANION_RADIO_TRACKS.find(track => track.mood === "calm")!;
  await radio.getByText("곡 고르기", { exact: false }).click();
  await radio.getByRole("button", { name: `${track.title} 재생`, exact: true }).click();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await page.mouse.move(2, 2); await startProbe(page);
  await expect(home.locator('[data-home-action="radio"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await frames(page)).some(frame => frame.scene === "X-S-music"), { timeout: 25000, intervals: [100] }).toBe(true);
  ({ dialog, radio } = await openRadio());
  const volume = radio.getByRole("slider", { name: "라디오 음량", exact: true }); await volume.focus(); await volume.press("Home");
  await expect(volume).toHaveValue("0");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await page.mouse.move(2, 2); await startProbe(page);
  await duration(page, 4500);
  expect((await frames(page)).some(frame => frame.scene === "X-S-music" && frame.state !== "idle")).toBe(false);
  proofs.get(page)!.notes.push({ actualUserStartedRecording: track.id, actualCalmSequence: true, nativeVolumeZeroCancelsSequence: true });
});

for (const outside of [false, true]) test(outside
  ? "142 floating home tidy returns from a real calendar perch to all four toys"
  : "142 floating home tidy preserves all four returns with learned care on", async ({ page }) => {
  test.setTimeout(165_000);
  // Preserve the measured160..330px real-card gap after143's room proportions.
  // Only this outside-return fixture needs the taller native viewport. No
  // support coordinates, physics limits or runtime state are substituted.
  await page.setViewportSize({ width: 1440, height: outside ? 1100 : 1050 });
  await fixture(page, "viewer", { personality: "tidy", roam: false, hunger: .60, energy: .76, sleep: true, learnFromYou: true });
  const fold = page.getByRole("button", { name: "패널 접기", exact: true });
  if (await fold.isVisible()) await fold.click();
  await settlePanelLayout(page);
  const home = await openCompanionHome(page);
  await settlePanelLayout(page);
  const room = (await home.locator(".vc-home-room").boundingBox())!;
  expect(room.width, "the real launcher opens the wide floating room").toBeGreaterThan(400);
  await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  const pet = page.locator(".vc-companion"), identity = (await pet.elementHandle())!;
  const ids: string[] = [];
  for (let index = 0; index < 4; index++) {
    await home.locator('[data-home-action="toys"]').click();
    await expect(page.locator(".vc-toy")).toHaveCount(index + 1);
    const toy = page.locator(".vc-toy").last();
    await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 });
    ids.push((await toy.getAttribute("data-toy-id"))!);
  }
  const floor = (await home.locator(".vc-home-floor").boundingBox())!;
  const floorFoot = floor.y + floor.height - COMPANION_HOME_FLOOR_INSET;
  const rim = (await home.locator(".vc-toy-box-opening").boundingBox())!;
  const opening = { x: rim.x + rim.width / 2, y: rim.y + rim.height };
  let perch: { x: number; y: number; width: number; eventId: string } | undefined;
  let actualPerch: { x: number; y: number; platform: string | undefined } | undefined;
  if (outside) {
    // Choose a real visible event below this measured room. No test platform,
    // calendar geometry, clock, RNG or engine state is supplied.
    const perches = await page.locator(".public-event[data-eventid]").evaluateAll((nodes, bounds) => nodes.flatMap(node => {
      const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y - 3;
      return node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && rect.width > 90
        && x >= bounds.x + 48 && x <= bounds.x + bounds.width - 48
        && y > bounds.foot + 160 && y < bounds.foot + 330 && rect.bottom < innerHeight - 30
        ? [{ x, y, width: rect.width, eventId: node.getAttribute("data-eventid")! }] : [];
    }), { x: floor.x, width: floor.width, foot: floorFoot });
    proofs.get(page)!.notes.push({ measuredFloatingRoom: room, measuredFloor: floor, eligibleRealPerches: perches });
    perch = perches[0];
    expect(perch, "a real event more than the ordinary jump rise below the floating floor exists").toBeTruthy();
    await actor.focus(); await actor.press("p");
    await expect(pet).toHaveAttribute("data-placing", "");
    await page.mouse.click(perch!.x, perch!.y); await page.mouse.move(2, 2);
    await expect(pet).not.toHaveAttribute("data-placing");
    await expect(pet).not.toHaveAttribute("data-state", "jump");
    await expect(pet).toHaveAttribute("data-platform", /^card-/);
    actualPerch = await pet.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.bottom, platform: (node as HTMLElement).dataset.platform };
    });
    expect(actualPerch.y - floorFoot, "actual planted feet retain the measured height gap").toBeGreaterThan(160);
    expect(actualPerch.y - floorFoot).toBeLessThan(330);
    expect(Math.abs(actualPerch.x - perch!.x)).toBeLessThan(2);
    expect(Math.abs(actualPerch.y - perch!.y)).toBeLessThan(3);
  }
  const initialPlatform = await pet.getAttribute("data-platform");
  const initialCare = await home.locator("meter").evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute("aria-label"), value: (node as HTMLMeterElement).value })));
  const observedPreferences = await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("vic.viewerCompanion") ?? "{}");
    return { sleep: value.sleep, learnFromYou: value.learnFromYou };
  });
  expect(observedPreferences).toEqual({ sleep: true, learnFromYou: true });
  expect(initialCare.find(value => value.label === "빅타민 포만감")!.value).toBeLessThanOrEqual(.41);
  expect(initialCare.find(value => value.label === "빅타민 포만감")!.value).toBeGreaterThan(.3);
  expect(initialCare.find(value => value.label === "빅타민 기력")!.value).toBeGreaterThan(.6);
  await selectNative(page, "tidy", true, true);
  await expect.poll(async () => (await frames(page)).some(frame => frame.visible && frame.decoded), { timeout: 5000, intervals: [50] }).toBe(true);
  const initialObserved = (await frames(page)).find(frame => frame.visible && frame.decoded)!;
  let actualPerchSupport: { x: number; y: number; width: number; height: number; footY: number; visible: boolean } | null = null;
  if (outside) {
    actualPerchSupport = await page.locator(".public-event[data-eventid]").evaluateAll((nodes, eventId) => {
      const node = nodes.find(value => value.getAttribute("data-eventid") === eventId);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, footY: rect.y - 3, visible: node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) };
    }, perch!.eventId);
    expect(actualPerchSupport?.visible).toBe(true);
    expect(initialObserved.platform).toBe(initialPlatform);
    expect(initialObserved.y - floorFoot).toBeGreaterThan(160);
    expect(initialObserved.y - floorFoot).toBeLessThan(330);
    expect(Math.abs(initialObserved.y - actualPerchSupport!.footY)).toBeLessThan(3);
    expect(initialObserved.x).toBeGreaterThanOrEqual(actualPerchSupport!.x);
    expect(initialObserved.x).toBeLessThanOrEqual(actualPerchSupport!.x + actualPerchSupport!.width);
  }
  proofs.get(page)!.notes.push({ floatingCleanupPreconditions: { room, floor, floorFoot, perch, actualPerch, actualPerchSupport, initialPlatform, initialCare, observedPreferences, initialObserved: { at: initialObserved.at, x: initialObserved.x, y: initialObserved.y, platform: initialObserved.platform, state: initialObserved.state, visible: initialObserved.visible, decoded: initialObserved.decoded }, ids, opening } });
  await expect(page.locator(".vc-toy")).toHaveCount(0, { timeout: 115_000 });
  await expect.poll(async () => {
    const trace = await frames(page);
    return ids.every(id => {
      const last = trace.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)).at(-1);
      return last && trace.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id));
    });
  }, { timeout: 1000, intervals: [50] }).toBe(true);
  const trace = await frames(page);
  for (const id of ids) {
    const carried = trace.filter(frame => frame.visible && frame.decoded && frame.toys.some(toy => toy.id === id && toy.carried));
    expect(carried.length, `${id} must be visibly carried before its removal`).toBeGreaterThanOrEqual(2);
    const last = carried.at(-1)!, item = last.toys.find(toy => toy.id === id)!;
    expect(Math.hypot(item.x - opening.x, item.y - opening.y), `${id} reaches the actual painted opening`).toBeLessThan(20);
    expect(trace.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id))).toBe(true);
  }
  const firstPickup = trace.find(frame => frame.toys.some(toy => toy.carried))!;
  const observedEntry: { id: number; from: string; to: string; startY: number; endY: number }[] = [];
  if (outside) {
    const entry = completedNativeTravel(trace.filter(frame => frame.at <= firstPickup.at));
    let support = initialPlatform;
    for (const trip of entry) {
      const start = trace.find(frame => frame.at === trip.startedAt);
      const end = trace.find(frame => frame.at === trip.endedAt);
      if (!start || !end || start.platform !== support) continue;
      observedEntry.push({ id: trip.id, from: start.platform, to: end.platform, startY: start.y, endY: end.y });
      support = end.platform;
      if (/^companion-home-floor(?:-\d+)?$/.test(support)) break;
    }
    expect(observedEntry.length, "actual decoded supported travel starts at the planted calendar support").toBeGreaterThan(0);
    expect(observedEntry[0].from).toBe(initialPlatform);
    expect(observedEntry.at(-1)!.to, "a contiguous supported route reaches the room before pickup").toMatch(/^companion-home-floor(?:-\d+)?$/);
    expect(firstPickup.y).toBeCloseTo(floorFoot, 0);
  }
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  expect(trace.every(frame => frame.toys.length <= 4 && frame.foods.length <= 8)).toBe(true);
  proofs.get(page)!.notes.push({ floatingRoom: room, floorFoot, perch, actualPerch, actualPerchSupport, observedEntry, initialPlatform, initialCare, observedPreferences, nativeIds: ids, opening, sameActor: true, sameIdPhysicalReturns: true, savedFixtureCare: { hunger: .60, energy: .76, sleep: true, learnFromYou: true }, scope: "Native floating-house regression using initial saved fixture care and actual controls. Not an unseeded production replay or complete platform-graph capture." });
});

for (const personality of COMPANION_PERSONALITIES) test(`140 ${personality} native primary and secondary sequences finish with real object or room effects`, async ({ page }) => {
  test.setTimeout(950000);
  const home = await fixture(page, "studio", { personality, roam: false, hunger: personality === "gourmet" ? .6 : .5 });
  await placeCompanionOnHomeFloor(page);
  const kind = toys140[personality], id = kind ? await drawNativeToy(page, kind) : undefined;
  // One physical toy can finish literal T01 or a complete alternate return
  // chore with its real floor travel and full final grooming. The latter is
  // recorded separately; it never certifies T01 or changes catalog-major.
  // The separate137/142/146 same-four-ID cleanup proofs remain independent.
  const opening = (await home.locator(".vc-toy-box-opening").boundingBox())!, boxPoint = { x: opening.x + opening.width / 2, y: opening.y + opening.height };
  await selectNative(page, personality, true);
  if (personality === "affectionate") {
    // A genuine blank area, away from TV/sofa/calendar controls: hovering a
    // button deliberately releases the app's autonomous pointer interest.
    await page.mouse.move(20, 800);
    expect(await page.evaluate(() => Boolean(document.elementFromPoint(20, 800)?.closest("button,a,input,select,textarea,[role='button']")))).toBe(false);
  }
  const proofStarted = Date.now();
  if (personality === "sleepy") {
    // Sleep OFF cannot paint S09/S11's required sleep rows. Finish the real
    // feather scene first, then create the authored S10 falling-toy event
    // through one actual box click, keeping the original total115s budget.
    await expect.poll(async () => finishedRecipes(await frames(page), boxPoint).some(recipe => recipe.id === "S05")
      && await page.locator(`.vc-toy[data-toy-id="${id}"]`).count() === 0, { timeout: 115000, intervals: [250] }).toBe(true);
    // A real farther approach gives this falling-toy response a positive
    // physical context, rather than borrowing a finished scene's tiny12px
    // shuffle at the box. This public placement remains inside the total115s.
    await placeCompanionOnHomeFloor(page);
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home-floor");
    await home.locator('[data-home-action="toys"]').click();
    await expect(page.locator(".vc-toy")).toHaveCount(1);
    await expect(page.locator(".vc-toy")).toHaveAttribute("data-falling", "false", { timeout: 6000 });
    const resident = (await page.locator(".vc-companion").boundingBox())!, dropped = (await page.locator(".vc-toy").boundingBox())!;
    expect(Math.abs(dropped.x+dropped.width/2-resident.x-resident.width/2), "S10 has a real approach of at least48px").toBeGreaterThanOrEqual(48);
  }
  await expect.poll(async () => {
    const observed=await frames(page),done = finishedRecipes(observed, boxPoint).filter(recipe => recipe.personality === personality);
    const alternate=personality==="tidy"&&done.some(recipe=>recipe.id==="X-T-return-time")
      &&completedTidyReturnGoal157(observed,id,boxPoint).length>0;
    return { primary: done.some(recipe => recipe.major)||alternate, secondary: done.some(recipe => !recipe.major && !recipe.id.startsWith("X-")), returned: !id || await page.locator(`.vc-toy[data-toy-id="${id}"]`).count() === 0 };
  }, { timeout: Math.max(1, 115000 - (Date.now() - proofStarted)), intervals: [250] }).toEqual({ primary: true, secondary: true, returned: true });
  expect(Date.now() - proofStarted, "primary and original secondary complete within the original total115s observation budget").toBeLessThanOrEqual(115000);
  const trace = await frames(page), done = finishedRecipes(trace, boxPoint).filter(recipe => recipe.personality === personality);
  if (personality === "sleepy") {
    const approach = trace.filter(frame => frame.scene === "S10" && frame.beat === "1" && ["walk", "jump"].includes(frame.state));
    expect(approach.length).toBeGreaterThan(1);
    expect(Math.max(...approach.map(frame => Math.hypot(frame.x-approach[0].x,frame.y-approach[0].y))), "the new S10 context actually moved, rather than merely promising a route").toBeGreaterThanOrEqual(48);
  }
  if (id) {
    await expect(page.locator(`.vc-toy[data-toy-id="${id}"]`)).toHaveCount(0, { timeout: 25000 });
    const actual = await frames(page), carried = actual.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried));
    expect(carried.length, "the selected physical object was actually carried").toBeGreaterThanOrEqual(2);
    const final = carried.at(-1)!.toys.find(toy => toy.id === id)!;
    expect(Math.hypot(final.x - boxPoint.x, final.y - boxPoint.y), "same object reached the actual box before removal").toBeLessThan(20);
    if (personality === "tidy") expect(actual.some(frame => frame.play === "ask-petting")).toBe(false);
    if (personality === "mischievous") expect(actual.some(frame => frame.toys.some(toy => toy.id === id && !toy.carried) && frame.state === "play" && ["pounce", "celebrate"].includes(frame.play))).toBe(true);
  } else {
    expect(trace.some(frame => frame.state === "eat" && frame.foods.length > 0)).toBe(true);
    expect(trace.some(frame => frame.tv === "cooking" && frame.platform === "companion-home")).toBe(true);
  }
  expect(trace.some(frame => frame.state === "sleep"), "sleep OFF remains authoritative for every personality").toBe(false);
  proofs.get(page)!.notes.push({ personality, nativeShuffleKind: kind, samePhysicalId: id,
    equivalentPhysicalPrimary:personality==="tidy"?completedTidyReturnGoal157(trace,id,boxPoint):[],
    reachedFinalBeatAndSubsequentSequence: done.map(recipe => ({ id: recipe.id, major: recipe.major })), scope: "Actual native primary+secondary samples and physical effects; a separately named complete alternate tidy chore is not literal T01 or catalog-major; not144 native recipe executions" });
});

test("142 sleepy low-energy same-ID return completes its required rest, while sleep OFF samples stay separate", async ({ page }) => {
  test.setTimeout(950000);
  // Keep preparation from spending the very rest need this positive case
  // measures. Turn sleep ON through the actual control, then use the public
  // keyboard hold while drawing the shuffle bag; no care value is rewritten.
  const home = await fixture(page, "studio", { personality: "sleepy", roam: false, hunger: .05, energy: .05, sleep: false, summer: true });
  await selectNative(page, "sleepy", false, true);
  await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await actor.focus(); await actor.press("Space"); await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "held");
  const id = await drawNativeToy(page, "plush-fish"), opening = (await home.locator(".vc-toy-box-opening").boundingBox())!;
  const boxPoint = { x: opening.x + opening.width / 2, y: opening.y + opening.height };
  await selectNative(page, "sleepy", true);
  await expect(page.locator(".vc-companion"), "native dialog/selection releases the preparation hold before autonomous observation").not.toHaveAttribute("data-state", "held");
  await expect.poll(async () => finishedRecipes(await frames(page), boxPoint).some(recipe => recipe.id === "S03"),
    { timeout: 115000, intervals: [250] }).toBe(true);
  await expect(page.locator(`.vc-toy[data-toy-id="${id}"]`)).toHaveCount(0);
  const trace = await frames(page), carried = trace.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried));
  expect(carried.length).toBeGreaterThanOrEqual(2);
  expect(carried.some(frame => frame.toys.some(toy => toy.id === id && Math.hypot(toy.x-boxPoint.x,toy.y-boxPoint.y)<20))).toBe(true);
  const sleep = trace.filter(frame => frame.scene === "S03" && frame.state === "sleep" && frame.visible && frame.decoded);
  expect(sleep.length).toBeGreaterThan(2);expect(sleep.at(-1)!.at-sleep[0].at).toBeGreaterThanOrEqual(5500*.8-80);
  proofs.get(page)!.notes.push({ actualRestEnabledThroughControl: true, nativeKeyboardHoldDuringShuffle: true, lowInitialEnergy: .05, samePhysicalId: id, fullOriginalRecipe: "S03", separatedFromNineSleepOffSamples: true });
});

for (const surface of ["viewer", "studio", "preview"] as const) for (const personality of COMPANION_PERSONALITIES)
  test(`137 ${surface} native ${personality} selection expresses immediately and remains purposeful`, async ({ page }) => {
    await fixture(page, surface, { personality: personality === "balanced" ? "curious" : "balanced" });
    await selectNative(page, personality);
    await expect.poll(async () => (await frames(page)).some(frame => signature(frame, personality)), { timeout: 3500, intervals: [40] }).toBe(true);
    await duration(page, 20_000); const observed=await frames(page);
    const cutoff=observed.at(-1)!.at,first=observed.find(frame=>signature(frame,personality))!;
    const gapsFor=(points:number[])=>[points[0],...points.slice(1).map((point,index)=>point-points[index]),cutoff-points.at(-1)!];
    // Activity is judged inside the original20s, including a live walk/jump.
    // Precise landing proof remains only in dedicated destination checks.
    const trace=observed.filter(frame=>frame.at<=cutoff);
    expect(first.at).toBeLessThanOrEqual(3000);
    expect(first.scene).toBe(`entry-${personality}`);
    const travel=completedNativeTravel(observed),activity=activityProgressTimes(trace);
    const points = trace.flatMap((frame, index) => meaningful(trace, index, activity) ? [frame.at] : []);
    expect(stationaryActivityRepetitions(trace), "Repeated stationary action is checked separately from actual movement and ten-second activity").toEqual([]);
    expect(points.length).toBeGreaterThan(2);
    const gaps = gapsFor(points);
    expect(Math.max(...gaps), "actual varied activity must recur before10s; no precise landing or decorative TV bow is required").toBeLessThanOrEqual(10_000);
    expect(new Set(trace.filter(frame => frame.scene).map(frame => `${frame.scene}:${frame.beat}`)).size, "an entry label alone is not a full living sequence").toBeGreaterThan(1);
    expect(trace.every(frame => frame.foods.length <= 8 && frame.toys.length <= 4)).toBe(true);
    proofs.get(page)!.notes.push({ firstDecodedSignatureAt: first.at, largestMeaningfulGap: Math.max(...gaps), distinctStages: [...new Set(trace.map(frame => `${frame.scene}:${frame.beat}`))], selectionWasNativeRadio: true, completedActualTravel:travel, originalObservationEnd:cutoff, activityCriteria:145,activityFrames:activity.size,observedUntil:observed.at(-1)!.at });
  });

for (const surface of ["viewer", "studio"] as const) test(`137 ${surface} tidy carries all four native toys to the actual box before removing their IDs`, async ({ page }) => {
  test.setTimeout(140_000);
  const home = await fixture(page, surface, { personality: "tidy" }); await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion");
  await actor.focus(); await actor.press("Space"); await expect(pet).toHaveAttribute("data-state", "held");
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    await home.locator('[data-home-action="toys"]').click(); await expect(page.locator(".vc-toy")).toHaveCount(i + 1);
    const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 }); ids.push((await toy.getAttribute("data-toy-id"))!);
  }
  const box = (await home.locator(".vc-toy-box-opening").boundingBox())!, opening = { x: box.x + box.width / 2, y: box.y + box.height };
  await startProbe(page); await actor.focus(); await actor.press("Space"); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-toy")).toHaveCount(0, { timeout: 75_000 });
  await expect.poll(async () => {
    const painted = await frames(page);
    return ids.every(id => { const last = painted.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)).at(-1); return last && painted.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id)); });
  }, { timeout: 1000, intervals: [50] }).toBe(true);
  const trace = await frames(page);
  for (const id of ids) {
    const carried = trace.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)); expect(carried.length, id).toBeGreaterThanOrEqual(2);
    const last = carried.at(-1)!, toy = last.toys.find(toy => toy.id === id)!;
    expect(Math.hypot(toy.x - opening.x, toy.y - opening.y), `${id} real painted return contact`).toBeLessThan(20);
    expect(trace.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id))).toBe(true);
  }
  expect(trace.every(frame => frame.toys.length <= 4 && frame.foods.length <= 8)).toBe(true);
  proofs.get(page)!.notes.push({ nativeIds: ids, actualBoxOpening: opening, sameIdCarryBeforeRemoval: true });
  const actualMat = home.locator(".vc-home-wash-stance"), pad = (await (await actualMat.count() ? actualMat : home.locator(".vc-home-wash-pad")).boundingBox())!, stance = { x: pad.x + pad.width / 2, y: pad.y + pad.height * .72 };
  await expect.poll(async () => (await frames(page)).some(frame => frame.washing && frame.brush?.visible && frame.platform === "companion-home-floor-400"), { timeout: 35_000, intervals: [100] }).toBe(true);
  await expect.poll(async () => {
    const contact = (await frames(page)).filter(frame => frame.washing && frame.brush?.visible && frame.platform === "companion-home-floor-400");
    return contact.length > 1 ? contact.at(-1)!.at - contact[0].at : 0;
  }, { timeout: 5000, intervals: [100] }).toBeGreaterThanOrEqual(500);
  const washed = (await frames(page)).filter(frame => frame.washing && frame.brush?.visible);
  expect(washed.every(frame => frame.toys.length === 0 && Math.abs(frame.x - stance.x) < 2 && Math.abs(frame.y - stance.y) < 2)).toBe(true);
  expect(washed.every(frame => frame.brush && Math.hypot(frame.brush.x - frame.x, frame.brush.y - (frame.y - 35)) < 65)).toBe(true);
  const lastWash = washed.at(-1)!;
  await expect.poll(async () => (await frames(page)).some(frame => frame.at > lastWash.at && frame.scene === lastWash.scene && Number(frame.beat) > Number(lastWash.beat)), { timeout: 12_000, intervals: [100] }).toBe(true);
  proofs.get(page)!.notes.push({ actualPadStance: stance, paintedBrushContactMs: lastWash.at - washed[0].at, finiteWashBeatAdvanced: true });
});

async function outsideTidy(page: Page, hunger: number, eventPerch = false) {
  test.setTimeout(150000); await page.setViewportSize({ width: 1920, height: 720 });
  const home = await fixture(page, "viewer", { personality: "tidy", roam: false, hunger });
  await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion"), ids: string[] = [];
  const room = (await home.boundingBox())!;
  for (let i = 0; i < 4; i++) {
    await home.locator('[data-home-action="toys"]').click(); await expect(page.locator(".vc-toy")).toHaveCount(i + 1);
    const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 });
    ids.push((await toy.getAttribute("data-toy-id"))!); const box = (await toy.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 6); await page.mouse.down();
    await expect(toy).toHaveAttribute("data-held", "true");
    // Release above the measured lower controls/floor, so gravity gets its
    // first real contact instead of invoking below-viewport recovery.
    await page.mouse.move([480, 760, 1180, 1500][i], 620, { steps: 10 }); await page.waitForTimeout(160); await page.mouse.up(); await page.mouse.move(2, 2);
    await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 });
  }
  const card = eventPerch ? await page.locator(".public-event[data-eventid]").evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y - 3, width: r.width }; }).find(r => r.width > 90 && r.x > 450 && r.x < 1500 && r.y > 160 && r.y < 590)) : undefined;
  if (eventPerch) expect(card, "a real visible public event provides the starting perch").toBeTruthy();
  await actor.focus(); await actor.press("p"); await expect(pet).toHaveAttribute("data-placing", "");
  await page.mouse.click(card?.x ?? 860, card?.y ?? Math.min(630, room.y + room.height + 20)); await page.mouse.move(2, 2);
  await expect(pet).not.toHaveAttribute("data-placing"); await expect(pet).not.toHaveAttribute("data-state", "jump");
  await expect(pet).not.toHaveAttribute("data-platform", /^companion-home/, { timeout: 5000 });
  if (eventPerch) await expect(pet).toHaveAttribute("data-platform", /^card-\d+-top/);
  const initialPlatform = await pet.getAttribute("data-platform");
  const initial = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { id: (node as HTMLElement).dataset.toyId, x: r.x + r.width / 2, y: r.bottom }; }));
  expect(Math.min(...initial.slice(1).map((item, i) => Math.abs(item.x - initial[i].x))), "actual native drops remain distinct").toBeGreaterThan(40);
  const openingRect = (await home.locator(".vc-toy-box-opening").boundingBox())!, opening = { x: openingRect.x + openingRect.width / 2, y: openingRect.y + openingRect.height };
  await selectNative(page, "tidy", true);
  if (process.env.COMPANION140_BASELINE === "1") {
    await duration(page, 20000); const trace = await frames(page);
    proofs.get(page)!.notes.push({ baselineOnly: true, hunger, ids, initial, room, platform: trace[0]?.platform, carried: trace.filter(f => f.toys.some(t => t.carried)).length, scenes: [...new Set(trace.map(f => `${f.scene}:${f.command}:${f.state}:${f.play}`))], remaining: await page.locator(".vc-toy").count() });
    return;
  }
  await expect.poll(async () => (await frames(page)).some(frame => frame.toys.some(toy => toy.carried) || frame.scene === "T01" && ["walk", "jump"].includes(frame.state)), { timeout: 10000, intervals: [100] }).toBe(true);
  //141 common needs may perform a real meal/wash between finite returns.
  // Preserve the110s cleanup budget separately from that visible care; a
  // ready loop, hidden frame or an ordinary pose cannot earn extra time.
  await expect(page.locator(".vc-toy")).toHaveCount(0, { timeout: 150000 });
  // Keep the same1s receipt gate without serializing the complete long trace
  // on every poll. The full authenticated raw is still checked below/saved.
  await expect.poll(async () => page.evaluate(wantedIds => {
    const painted = (window as ProbeWindow).personality137?.samples ?? [];
    return wantedIds.every(id => { const last = painted.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)).at(-1); return last && painted.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id)); });
  }, ids), { timeout: 1000, intervals: [50] }).toBe(true);
  const trace = await frames(page);
  const empty = trace.findIndex(frame => ids.every(id => !frame.toys.some(toy => toy.id === id)));
  expect(empty).toBeGreaterThan(0);
  let actualCareMs = 0;
  for (let index = 1; index <= empty; index++) {
    const before = trace[index - 1], after = trace[index];
    if (before.visible && before.decoded && /^routine-(meal|wash)$/.test(before.scene) && !["idle", "held"].includes(before.state)) actualCareMs += Math.min(100, Math.max(0, after.at - before.at));
  }
  expect(actualCareMs).toBeLessThanOrEqual(40000);
  expect(trace[empty].at - trace[0].at - actualCareMs, "unchanged110s cleanup budget excludes only bounded actually painted care").toBeLessThanOrEqual(110000);
  for (const id of ids) {
    const carry = trace.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)); expect(carry.length, id).toBeGreaterThanOrEqual(2);
    const last = carry.at(-1)!, item = last.toys.find(toy => toy.id === id)!;
    expect(Math.hypot(item.x - opening.x, item.y - opening.y), `${id} actual return contact`).toBeLessThan(20);
    expect(trace.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id))).toBe(true);
  }
  proofs.get(page)!.notes.push({ hunger, ids, initial, initialPlatform, eventPerch, opening, sameIdActualPickupReturn: true, actualCareMs, cleanupBudgetMs: 110000 });
}
for (const hunger of [.05, .5]) test(`140 outside-home tidy actually retrieves four toys from a calendar perch at hunger${hunger}`, async ({ page }) => outsideTidy(page, hunger));
test("140 actual public event perch to four separated outside toys and same-ID box returns at middle hunger", async ({ page }) => outsideTidy(page, .5, true));

test("137 native take-outs retain the shared food8 and toy4 caps", async ({ page }) => {
  const home = await fixture(page, "studio", { personality: "balanced", roam: false });
  for (let i = 0; i < 12; i++) { await home.locator('[data-home-action="feed"]').click(); expect(await page.locator(".vc-food").count()).toBeLessThanOrEqual(8); }
  for (let i = 0; i < 6; i++) { await home.locator('[data-home-action="toys"]').click(); expect(await page.locator(".vc-toy").count()).toBeLessThanOrEqual(4); }
  expect(await page.locator(".vc-food").count()).toBe(8); expect(await page.locator(".vc-toy").count()).toBe(4);
});

test("137 summer homebody respects native manual15s choices then connects the real sofa TV curtain and persistent light", async ({ page }) => {
  const home = await fixture(page, "studio", { personality: "tidy", summer: true }); await placeCompanionOnHomeFloor(page);
  const lamp = home.locator(".vc-home-lamp"), tv = home.locator(".vc-home-tv"), room = home.locator(".vc-home-room");
  // Deliberately establish manual ON and OFF, even if these equal defaults.
  if (await lamp.getAttribute("aria-pressed") === "true") await lamp.click(); await lamp.click(); await expect(lamp).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 6; i++) await tv.click(); await expect(room).toHaveAttribute("data-tv", "off");
  const lastManual = await page.evaluate(() => performance.now());
  await selectNative(page, "homebody"); const postSelection = await page.evaluate(() => performance.now());
  await duration(page, Math.max(1000, 15_000 - (postSelection - lastManual))); const protectedFrames = await frames(page);
  const protectedThrough = 15_000 - (postSelection - lastManual) - 250;
  expect(protectedFrames.filter(frame => frame.at < protectedThrough).every(frame => frame.tv === "off" && frame.lit)).toBe(true);
  await expect.poll(async () => (await frames(page)).some(frame => frame.platform === "companion-home" && frame.tv !== "off" && frame.curtain === "closed" && !frame.lit && frame.state !== "sleep"), { timeout: 60_000, intervals: [200] }).toBe(true);
  const trace = await frames(page); expect(trace.some(frame => frame.state === "sleep")).toBe(false);
  proofs.get(page)!.notes.push({ manualPriorityMs: 15_000, protectedThrough, actualSummerRoom: await room.getAttribute("data-season"), noSleepPermissionBypass: true });
});

test("137 actual public editor input keeps its focus and text while the performer cheers beside the panel", async ({ page }) => {
  await fixture(page, "studio", { personality: "performer" });
  await page.locator('[data-act="calendar-cell"]').nth(10).dblclick({ position: { x: 14, y: 20 } });
  const editor = page.locator(".event-editor-panel:visible"), content = editor.getByRole("textbox", { name: "내용", exact: true });
  await expect(editor).toBeVisible(); await content.fill("응원 검수용 공개 초안"); await content.press("End");
  await startProbe(page);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-working", "");
  await expect.poll(async () => (await frames(page)).some(frame => frame.scene === "working-performer" && signature(frame, "performer")), { timeout: 10_000, intervals: [100] }).toBe(true);
  await content.pressSequentially(" · 입력 계속", { delay: 80 });
  await expect(content).toBeFocused(); await expect(content).toHaveText("응원 검수용 공개 초안 · 입력 계속");
  expect(await page.locator(".vc-actor").evaluate(node => getComputedStyle(node).pointerEvents)).toBe("none");
  const panel = (await editor.boundingBox())!, trace = (await frames(page)).filter(frame => frame.scene === "working-performer" && signature(frame, "performer"));
  expect(trace.length).toBeGreaterThan(2);
  expect(trace.every(frame => frame.x + 38 <= panel.x || frame.x - 38 >= panel.x + panel.width || frame.y <= panel.y || frame.y - 70 >= panel.y + panel.height), "the actual cheering body stays beside the input panel").toBe(true);
  const closedAfter = (await frames(page)).at(-1)!.at;
  await content.press("Escape"); await expect(editor).toBeHidden();
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-working", "");
  await expect.poll(async () => (await frames(page)).some(frame => frame.at > closedAfter && !frame.scene.startsWith("working-") && signature(frame,"performer")), { timeout: 7000, intervals:[100] }).toBe(true);
  proofs.get(page)!.notes.push({ nativePublicInputFocusPreserved: true, meaningfulWorkingFrames: trace.length, editorOutsideBody: true, resumesNormalPersonalityAfterClose:true });
});

test("137 hungry gourmet uses the actual dispenser once and eats that same spawned food without scattering it", async ({ page }) => {
  await fixture(page, "studio", { personality: "gourmet", hunger: .6 }); await startProbe(page);
  await expect(page.locator(".vc-food").first()).toBeVisible({ timeout: 35_000 });
  const food = page.locator(".vc-food").first(), id = (await food.getAttribute("data-food"))!;
  expect(id).toBeTruthy();
  await expect(food).toHaveAttribute("data-eating", "", { timeout: 30_000 });
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "eat");
  const mealFrames = await frames(page);
  expect(mealFrames.some(frame => frame.foods.includes(id))).toBe(true);
  await expect(page.locator(`.vc-food[data-food="${id}"]`)).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => {
    const painted = await frames(page), lastMeal = painted.filter(frame => frame.state === "eat" && frame.foods.includes(id)).at(-1);
    return Boolean(lastMeal && painted.some(frame => frame.at > lastMeal.at && !frame.foods.includes(id)));
  }, { timeout: 1000, intervals: [50] }).toBe(true);
  const trace = await frames(page), lastMeal = trace.filter(frame => frame.state === "eat" && frame.foods.includes(id)).at(-1)!;
  const removed = trace.find(frame => frame.at > lastMeal.at && !frame.foods.includes(id))!;
  const seenIds = new Set(trace.filter(frame => frame.at < removed.at).flatMap(frame => frame.foods));
  expect(trace.some(frame => frame.state === "eat" && frame.foods.includes(id))).toBe(true);
  expect(seenIds.size, "stop at the first completed native meal, before a later hunger cycle").toBe(1);
  proofs.get(page)!.notes.push({ initialFixtureHunger: .6, nativeSpawnedFoodId: id, firstActualRemovalAt: removed.at, sameIdObservedEatingBeforeRemoval: true, nativeFeedButtonClicks: 0 });
});

test("140 middle-hunger real basic meal visibly inspects unknown food before eventually eating the same ID", async ({ page }) => {
  test.setTimeout(180000);
  const trials: { kind: string | null; inspected: boolean }[] = [];
  // Each trial starts a fresh document with initial saved care/preferences.
  // Real food draws and willingness stay random; no RNG/clock/direct state
  // injection occurs after mount. Cat willingness gives natural opportunities.
  for (let attempt = 0; attempt < 6; attempt++) {
    const home = await fixture(page, "studio", { personality: "tidy", animalMode: "cat", roam: false, hunger: .5 });
    await placeCompanionOnHomeFloor(page); const body = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
    await body.focus(); await body.press("Space"); await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "held");
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    const food = page.locator(".vc-food").first(); await expect(food).toBeVisible(); await expect(food).not.toHaveAttribute("data-falling");
    const id = (await food.getAttribute("data-food"))!, kind = await food.getAttribute("data-kind");
    await selectNative(page, "tidy", true);
    if (await page.locator(".vc-companion").getAttribute("data-state") === "held") { await body.focus(); await body.press("Space"); }
    await page.mouse.move(2, 2);
    await expect.poll(async () => (await frames(page)).some(frame => frame.curiosity && frame.foods.includes(id)) || await page.locator(`.vc-food[data-food="${id}"]`).count() === 0,
      { timeout: 23000, intervals: [50] }).toBe(true);
    const observed = (await frames(page)).filter(frame => frame.curiosity && ["sniff", "play", "look"].includes(frame.state) && frame.foods.includes(id) && frame.visible && frame.decoded);
    trials.push({ kind, inspected: observed.length > 0 });
    if (!observed.length) continue;
    await expect.poll(async () => (await frames(page)).filter(frame => frame.curiosity && ["sniff", "play", "look"].includes(frame.state) && frame.foods.includes(id) && frame.visible && frame.decoded).length,
      { timeout: 1500, intervals: [50] }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await frames(page)).some(frame => frame.state === "eat" && frame.foods.includes(id)), { timeout: 23000, intervals: [50] }).toBe(true);
    await expect(page.locator(`.vc-food[data-food="${id}"]`)).toHaveCount(0, { timeout: 12000 });
    proofs.get(page)!.notes.push({ initialHunger: .5, animalMode: "cat", nativePersonality: "tidy", trials, realInspectedFood: { id, kind }, sameIdInspectedThenEaten: true });
    return;
  }
  expect(trials.some(trial => trial.inspected), "a natural unknown-food observation must actually be painted, not merely calculated").toBe(true);
});

type WorkSignalProof = { kind: string; keys: string[] };
type WorkProbeWindow = Window & { workSignals137?: WorkSignalProof[] };
async function observeWorkSignals(page: Page) {
  await page.evaluate(() => {
    const samples: WorkSignalProof[] = []; (window as WorkProbeWindow).workSignals137 = samples;
    window.addEventListener("vic:companion-public-work", event => {
      const detail = (event as CustomEvent).detail, kind = ["opened", "closed", "saved", "undo", "redo"].includes(detail?.kind) ? detail.kind as string : "invalid";
      samples.push({ kind, keys: detail && typeof detail === "object" ? Object.keys(detail) : [] });
    });
  });
}
const workSignals = (page: Page) => page.evaluate(() => (window as WorkProbeWindow).workSignals137 ?? []);

for (const accepted of [true, false]) test(`137 native public save ${accepted ? "success" : "failure"} emits a completion only after the fixture server ACK`, async ({ page }) => {
  let release: (() => void) | undefined, requested = 0;
  const gate = new Promise<void>(done => { release = done; });
  await page.route("**/api/studio-write", async route => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    const command = request.postDataJSON() as { op: string; payload: { visibilityScope?: string; teaser?: boolean } };
    expect(command.op).toBe("save"); expect(command.payload.visibilityScope).toBe("public"); expect(Boolean(command.payload.teaser)).toBe(false);
    requested++; await gate;
    return route.fulfill({ status: accepted ? 200 : 403, contentType: "application/json", body: JSON.stringify(accepted ? { ok: true, id: "synthetic-137-save" } : { ok: false, error: "검수용 저장 거절" }) });
  });
  await fixture(page, "studio", { personality: "performer" }); await observeWorkSignals(page);
  await page.locator('[data-act="calendar-cell"]').nth(10).dblclick({ position: { x: 14, y: 20 } });
  const content = page.locator(".event-editor-panel:visible").getByRole("textbox", { name: "내용", exact: true });
  await content.fill("고정 완료 신호 검수"); await content.press("Control+Enter");
  await expect.poll(() => requested, { timeout: 6000 }).toBe(1);
  expect((await workSignals(page)).filter(event => event.kind === "saved")).toEqual([]);
  release!();
  if (accepted) await expect.poll(async () => (await workSignals(page)).filter(event => event.kind === "saved").length, { timeout: 7000 }).toBe(1);
  else { await expect(page.getByText("저장 실패").first()).toBeVisible(); expect((await workSignals(page)).filter(event => event.kind === "saved")).toEqual([]); }
  const signals = await workSignals(page);
  expect(signals.some(event => event.kind === "opened")).toBe(true);
  expect(signals.every(event => event.keys.length === 1 && event.keys[0] === "kind")).toBe(true);
  proofs.get(page)!.notes.push({ nativeSaveServerAckAccepted: accepted, serverRequestsFulfilledLocally: requested, signals });
});

for (const limit of ["roam-off", "reduced", "gfx-off"] as const) test(`137 public editor respects ${limit} instead of resuming autonomous work`, async ({ page }) => {
  await fixture(page, "studio", { personality: "performer", roam: limit !== "roam-off", reduced: limit === "reduced", gfxOff: limit === "gfx-off" });
  await page.locator('[data-act="calendar-cell"]').nth(10).dblclick({ position: { x: 14, y: 20 } });
  const content = page.locator(".event-editor-panel:visible").getByRole("textbox", { name: "내용", exact: true });
  await expect(content).toBeVisible(); await content.fill("정지 설정을 지키는 공개 초안"); await startProbe(page);
  await duration(page, 4000);
  expect((await frames(page)).some(frame => frame.scene.startsWith("working-"))).toBe(false);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-working", "");
  await expect(content).toHaveText("정지 설정을 지키는 공개 초안");
});
