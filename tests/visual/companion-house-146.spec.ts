import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const out = process.env.COMPANION146_HOME_OUTPUT ?? ".scratch-pw/companion-146/house";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
type Frame = { phase: string; at: number; scroll: number; scrollMax: number; eventScroller: string; eligible: boolean; actor: boolean; front: boolean; editor: boolean; dx: number; dy: number; actorDy: number; bedY: number; frontY: number; roomX: number; roomY: number; support: string; nativeActor: boolean; nativeFront: boolean };
type ProbeWindow = Window & { house146?: { frames: Frame[]; stop(): void } };
const proof = new WeakMap<Page, { errors: string[]; unexpected: string[] }>();
const observations = new WeakMap<Page, Record<string, unknown>>();

function phaseSummary(frames: Frame[]) {
  const eligible = frames.filter(f => f.eligible), visible = eligible.filter(f => f.actor && f.front);
  const maximum = (field: "dx" | "dy" | "actorDy") => visible.length ? Math.max(...visible.map(f => Math.abs(f[field]))) : null;
  return { samples: frames.length, physicalSeatSamples: eligible.length, missingLayers: eligible.filter(f => !f.actor || !f.front), maxDx: maximum("dx"), maxDy: maximum("dy"), maxActorDy: maximum("actorDy"), candidatesOver2CssPx: visible.filter(f => Math.max(Math.abs(f.dx), Math.abs(f.dy), Math.abs(f.actorDy)) >= 2) };
}

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", video: { mode: "on", size: { width: 1920, height: 1100 } }, trace: "on" });
test.setTimeout(75000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const p = { errors: [] as string[], unexpected: [] as string[] }; proof.set(page, p);
  page.on("pageerror", error => p.errors.push(error.message));
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewIds = new Set(Object.entries(actions).filter(([, a]) => a.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, p.unexpected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previewIds.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { p.unexpected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).house146; p?.stop(); return p?.frames ?? []; }).catch(() => []);
  mkdirSync(out, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ ...proof.get(page), status: info.status, ...observations.get(page), phases: { rawScroll: phaseSummary(frames.filter(f => f.phase === "scroll")), rawAnimationFrame: phaseSummary(frames.filter(f => f.phase === "frame")), postRender: phaseSummary(frames.filter(f => f.phase === "post-render")) }, frames, viewport: page.viewportSize(), videoEncoding: { width: 1920, height: 1100, note: "Encoding canvas is independent of viewport; a 1920px-wide viewport maps 1 CSS px to 1 video pixel with unused lower letterbox." }, scope: "Saved settings, native placement/sofa recall/wheel/keyboard only. No geometry, engine, RNG or clock patch. Video retained for occupied/empty comparison. Raw event/rAF candidates stay in the receipt; the physical-seat visibility denominator and 2 CSS px screen-alignment verdict use post-render samples." }, null, 2));
  await page.screenshot({ path: `${out}/${name}-final.png` }).catch(() => {});
  expect(proof.get(page)!.errors).toEqual([]); expect(proof.get(page)!.unexpected).toEqual([]);
});

async function setup(page: Page, surface: "viewer" | "studio" | "preview", dark: boolean, compact = false) {
  await page.addInitScript(({ defaults, epoch, epochKey, dark }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", v: 3, at: Date.now() }), "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off", "vic.viewerCompanion": JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: false, sound: false }) })) localStorage.setItem(key, value);
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, dark });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&ambient=autumn" : "/visual-fixture/studio?role=owner&y=2026&m=10&hour=23&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  if (compact) {
    const fold = page.getByRole("button", { name: "패널 접기", exact: true });
    if (await fold.isVisible()) { await fold.click(); await settlePanelLayout(page); }
  }
  await page.evaluate(() => document.fonts.ready);
  const home = await openCompanionHome(page); await settlePanelLayout(page);
  await home.locator("img").evaluateAll(nodes => Promise.all(nodes.map(node => (node as HTMLImageElement).decode())));
  return home;
}

/** Native viewport changes may create overflow; no spacer, DOM size, scrollTop
 * assignment or engine mutation manufactures a scrolling surface. Calendar
 * zoom does not guarantee a scrollable house/sidebar on every shared surface. */
async function houseScrollSurface(page: Page, width: number, surface: "viewer" | "studio" | "preview") {
  const home = page.locator(".vc-home");
  if (surface === "studio") {
    // This rail is fixed beside the calendar. Native disclosures make the real
    // occupied seat visible while the neighbouring calendar scrolls; this must
    // never be reported as a scrolling house or manufactured with DOM sizes.
    for (const section of ["tag-filter", "season"]) {
      const fold = page.locator(`.avatar-rail [data-panel-section-toggle="${section}"][aria-expanded="true"]`);
      if (await fold.isVisible()) { await fold.focus(); await fold.press("Enter"); await settlePanelLayout(page); }
    }
  }
  for (const height of [780, 620, 500, 420, 360, 320, 280]) {
    await page.setViewportSize({ width, height }); await settlePanelLayout(page);
    const result = await home.evaluate((node, surface) => {
      const root = document.scrollingElement;
      const isScrollable = (element: Element) => {
        const css = getComputedStyle(element);
        return element.scrollHeight-element.clientHeight >= 80 && (element === root || /auto|scroll/.test(css.overflowY));
      };
      let owner: Element | null = node;
      while (owner && !isScrollable(owner)) owner=owner.parentElement;
      if (!owner && root && isScrollable(root)) owner=root;
      const fixedAncestor = (element: Element | null) => {
        for (let current=element;current;current=current.parentElement) if(getComputedStyle(current).position==="fixed") return true;
        return false;
      };
      let mode: "house-ancestor-scroll" | "fixed-house/calendar-scroll" | "fixed-house/root-scroll" | "compact-overlay/root-scroll" = owner===root && fixedAncestor(node) ? surface==="studio" ? "fixed-house/root-scroll" : "compact-overlay/root-scroll" : "house-ancestor-scroll";
      if (!owner && surface === "studio") {
        const calendar = document.querySelector(".studio-month-grid"), seat = node.querySelector(".vc-home-cushion")?.getBoundingClientRect();
        if (calendar && isScrollable(calendar) && seat && seat.top + seat.height/2 > 0 && seat.top + seat.height/2 < innerHeight) { owner = calendar; mode = "fixed-house/calendar-scroll"; }
      }
      if (!owner) return null;
      const name = (element: Element) => `${element.tagName.toLowerCase()}${element.id ? "#"+element.id : ""}${typeof element.className === "string" ? "."+element.className.trim().split(/\s+/).join(".") : ""}`;
      const nearest = (element: Element | null): Element | null => {
        for (let current=element;current;current=current.parentElement) if (current.scrollHeight-current.clientHeight>2 && (current===root || /auto|scroll/.test(getComputedStyle(current).overflowY))) return current;
        return root && root.scrollHeight-root.clientHeight>2 ? root : null;
      };
      const h=node.getBoundingClientRect(), r=owner.getBoundingClientRect();
      const pointSets=[h, owner===root ? {left:0,top:70,right:innerWidth,bottom:innerHeight} : r];
      for (const box of pointSets) {
        const left=Math.max(2,box.left),right=Math.min(innerWidth-2,box.right),top=Math.max(80,box.top),bottom=Math.min(innerHeight-3,box.bottom);
        if (right<=left || bottom<=top) continue;
        for (const fx of [.9,.1,.7,.3,.5]) for (const fy of [.7,.9,.3,.5,.1]) {
          const x=left+(right-left)*fx,y=top+(bottom-top)*fy,hit=document.elementFromPoint(x,y);
          // Fixed compact controls do not wheel-chain into the calendar.
          // Stress the real root over calendar content, never that overlay.
          if (hit && nearest(hit)===owner && !(owner===root && fixedAncestor(hit))) return { mode, owner:name(owner), range:owner.scrollHeight-owner.clientHeight, top:owner.scrollTop, x,y,hit:name(hit), height:innerHeight, compact:node.getAttribute("data-home-presentation")==="compact" };
        }
      }
      return null;
    }, surface);
    if (result) {
      const owner = await home.evaluateHandle((node, mode) => {
        if (mode === "fixed-house/calendar-scroll") return document.querySelector(".studio-month-grid");
        const root=document.scrollingElement;
        for (let current:Element|null=node;current;current=current.parentElement) if(current.scrollHeight-current.clientHeight>=80 && (current===root || /auto|scroll/.test(getComputedStyle(current).overflowY))) return current;
        return root;
      }, result.mode);
      return { ...result, handle:owner };
    }
  }
  throw new Error("No native house ancestor or explicitly fixed-house calendar with at least 80px overflow, physical-seat coverage and a real wheel target at any supported stress viewport");
}

for (const [surface, width] of [["viewer", 1920], ["viewer", 1100], ["studio", 1920], ["preview", 1920]] as const) for (const dark of [true, false]) test(`146 ${surface} ${width} ${dark ? "dark" : "light"} occupied sofa and clear window storage`, async ({ page }) => {
  await page.setViewportSize({ width, height: 780 });
  const home = await setup(page, surface, dark, width === 1100), name = `${surface}-${width}-${dark ? "dark" : "light"}`;
  await placeCompanionOnHomeFloor(page);
  const layout = await home.locator(".vc-home-room").evaluate(room => {
    const r = room.getBoundingClientRect(), css = getComputedStyle(room), scale = r.width / room.clientWidth;
    const bounds = (selector: string) => { const b = room.querySelector(selector)!.getBoundingClientRect(); return { x: (b.x-r.x)/scale, y: (b.y-r.y)/scale, right: (b.right-r.x)/scale, bottom: (b.bottom-r.y)/scale, width: b.width/scale, height: b.height/scale }; };
    return { width: room.clientWidth, height: room.clientHeight, floor: bounds(".vc-home-floor"), frame: bounds(".vc-home-window"), curtain: bounds(".vc-window-curtain-overlay"), bin: bounds(".vc-home-trash"), pad: bounds(".vc-home-wash-pad"), toy: bounds(".vc-toy-box"), left: css.getPropertyValue("--vc-window-left"), supportsNativeAnchor: CSS.supports("position-anchor", "--vc-sofa") };
  });
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${name}-layout.json`, JSON.stringify(layout, null, 2));
  expect(layout.curtain.x, "curtain and rod sit inside the illustrated 10px wall seam").toBeGreaterThanOrEqual(13);
  expect(layout.frame.width / layout.frame.height).toBeCloseTo(38/23, 1);
  expect(layout.floor.y-layout.frame.bottom, "sill leaves clear wall above the floor").toBeGreaterThan(16);
  expect(layout.width-layout.bin.right, "bin moves into the right corner").toBeGreaterThanOrEqual(4);
  expect(layout.height-layout.bin.bottom, "bin target remains above the lower room edge").toBeGreaterThanOrEqual(4);
  expect(layout.pad.y).toBeGreaterThan(layout.toy.y);
  await home.screenshot({ path: `${out}/${name}-empty.png` });
  const sofa = home.locator('[data-home-action="home"]');
  await sofa.focus(); await sofa.press("Enter"); await page.mouse.move(2, 2);
  const actor = page.locator(".vc-companion"), front = page.locator(".vc-bed-foreground");
  await expect(actor).toHaveAttribute("data-platform", "companion-home", { timeout: 25000 }); await expect(front).toBeVisible();
  const nativeEligible = await home.locator(".vc-home-cushion").evaluate(seat => Boolean(seat.compareDocumentPosition(document.querySelector(".vc-companion")!) & Node.DOCUMENT_POSITION_FOLLOWING));
  if (layout.supportsNativeAnchor && nativeEligible) { await expect(actor).toHaveAttribute("data-native-sofa", ""); await expect(front).toHaveAttribute("data-native-sofa", ""); }
  await home.screenshot({ path: `${out}/${name}-occupied.png` });
  const scrollSurface=await houseScrollSurface(page,width,surface), { handle:scrollOwner, ...scrollProof }=scrollSurface;
  observations.set(page, { scrollSurface: scrollProof, observationViewport: page.viewportSize() });
  writeFileSync(`${out}/${name}-native-scroll-target.json`,JSON.stringify(scrollProof,null,2));
  await page.mouse.move(scrollSurface.x,scrollSurface.y);
  await page.evaluate(({ owner }) => {
    if(!owner)throw new Error("Missing actual scroll owner");
    const frames: Frame[] = []; let id=0, timer=0, stopped=false, eventScroller="";
    const sample = (phase: string) => {
      const bed=document.querySelector(".vc-plush-bed"), front=document.querySelector<HTMLElement>(".vc-bed-foreground"), actor=document.querySelector<HTMLElement>(".vc-companion"), seat=document.querySelector(".vc-home-cushion");
      if (!bed || !front || !actor || !seat) return;
      const b=bed.getBoundingClientRect(), f=front.getBoundingClientRect(), a=actor.getBoundingClientRect(), s=seat.getBoundingClientRect(), room=bed.closest(".vc-home-room")!.getBoundingClientRect(), home=bed.closest(".vc-home")!.getBoundingClientRect();
      const sx=s.x+s.width/2, sy=s.y+s.height/2, inside=(r:DOMRect)=>sx>=r.left&&sx<=r.right&&sy>=r.top&&sy<=r.bottom;
      const eligible=actor.dataset.platform==="companion-home"&&!actor.hasAttribute("data-placing")&&sx>=0&&sx<=innerWidth&&sy>=0&&sy<=innerHeight&&inside(room)&&inside(home);
      frames.push({phase,at:performance.now(),scroll:owner.scrollTop,scrollMax:owner.scrollHeight-owner.clientHeight,eventScroller,eligible,actor:!actor.hidden&&a.width>0,front:!front.hidden&&f.width>0,editor:Boolean(document.querySelector(".event-editor-panel")?.getBoundingClientRect().height),dx:f.x-b.x,dy:f.y-b.y,actorDy:a.bottom-s.top,bedY:b.y,frontY:f.y,roomX:room.x,roomY:room.y,support:actor.dataset.platform??"",nativeActor:actor.hasAttribute("data-native-sofa"),nativeFront:front.hasAttribute("data-native-sofa")});
    };
    const scroll=(event:Event)=>{const target=event.target;eventScroller=target instanceof Element?`${target.tagName}.${typeof target.className==="string"?target.className:""}`:"document";sample("scroll");};
    // CSSWG applies an anchor's default scroll shift *after layout*, equivalent
    // to a transform: https://drafts.csswg.org/css-anchor-position-1/#scroll .
    // An early scroll/rAF getBCR can straddle that layout/compositor update.
    // Native 1920px viewport / 1920px video, 100 decoded frames: raw candidates
    // reached 40 CSS px while actual sofa front/back paint remained <=1px and
    // post-render offsets were zero. Keep every early candidate as evidence;
    // only the post-render physical-seat denominator judges the same 2px
    // painted-alignment requirement. No hiding/visibility denominator removal.
    const frame=()=>{if(!stopped){sample("frame");timer=window.setTimeout(()=>{if(!stopped)sample("post-render");},0);id=requestAnimationFrame(frame);}};
    window.addEventListener("scroll",scroll,{passive:true,capture:true});id=requestAnimationFrame(frame);
    (window as ProbeWindow).house146={frames,stop(){stopped=true;cancelAnimationFrame(id);clearTimeout(timer);window.removeEventListener("scroll",scroll,true);}};
  }, {owner:scrollOwner});
  await page.mouse.wheel(0,-scrollSurface.range-100); await expect.poll(()=>scrollOwner.evaluate(node=>node?.scrollTop)).toBe(0);
  const step=Math.max(12,Math.min(80,Math.floor(scrollSurface.range/5)));
  for (const delta of [step,step,step,-step,step*2,-step*2,-step]) { await page.mouse.wheel(0,delta); await page.waitForTimeout(70); }
  await page.mouse.wheel(0,scrollSurface.range+100); await page.waitForTimeout(160);
  await expect.poll(()=>home.locator(".vc-home-cushion").evaluate(seat=>{
    const s=seat.getBoundingClientRect(),h=seat.closest(".vc-home")!.getBoundingClientRect(),y=s.y+s.height/2;
    return y>=0&&y<=innerHeight&&y>=h.top&&y<=h.bottom;
  }),{message:"native wheel brings the physical seat into the actual viewport before editor/collection observations"}).toBe(true);
  if(width===1100){
    await expect(page.locator(".vc-compact-home .vc-home")).toBeVisible();
    expect(scrollSurface.compact).toBe(true);expect(scrollSurface.range).toBeGreaterThan(80);
    await page.screenshot({path:`${out}/${name}-compact-scrolled.png`});
  }
  if (surface === "studio") {
    const day = page.locator(".studio-day[data-act='calendar-cell']").nth(10);
    await day.focus(); await day.press("Enter"); await expect(page.locator(".event-editor-panel")).toBeVisible();
    const grid=(await page.locator(".studio-month-grid").boundingBox())!;
    await page.mouse.move(grid.x+grid.width*.7,Math.min(page.viewportSize()!.height-20,grid.y+grid.height*.7));
    for (const delta of [100,-100]) { await page.mouse.wheel(0,delta); await page.waitForTimeout(160); }
    await page.screenshot({ path: `${out}/${name}-editor-occupied.png` });
    await page.keyboard.press("Escape"); await expect(page.locator(".event-editor-panel")).toBeHidden();
  }
  await page.waitForTimeout(350);
  const frames = await page.evaluate(()=>{const probe=(window as ProbeWindow).house146!;probe.stop();return probe.frames;}), postRender=frames.filter(f=>f.phase==="post-render"), eligible=postRender.filter(f=>f.eligible), visible=eligible.filter(f=>f.front&&f.actor);
  observations.set(page,{...observations.get(page),verdictPhase:"post-render",physicalSeatSamples:eligible.length,rawCandidatesRetained:true});
  expect(new Set(frames.map(f=>Math.round(f.scroll))).size).toBeGreaterThan(2); expect(visible.length).toBeGreaterThan(3);
  expect(Math.max(...frames.map(f=>f.scroll))-Math.min(...frames.map(f=>f.scroll)),`actual measured ${scrollSurface.mode} owner traverses a meaningful distance`).toBeGreaterThan(40);
  expect(eligible.filter(f=>!f.actor||!f.front), "a visible physical seat owns the denominator; hiding either layer cannot erase failures").toEqual([]);
  if (surface === "studio") expect(visible.filter(f=>f.editor).length, "actual editor-open resident frames are required").toBeGreaterThan(3);
  expect(Math.max(...visible.map(f=>Math.abs(f.dx)))).toBeLessThan(2); expect(Math.max(...visible.map(f=>Math.abs(f.dy)))).toBeLessThan(2); expect(Math.max(...visible.map(f=>Math.abs(f.actorDy)))).toBeLessThan(2);
  if(scrollSurface.mode.startsWith("fixed-house/")) {
    expect(Math.max(...postRender.map(f=>f.roomX))-Math.min(...postRender.map(f=>f.roomX)),"fixed studio room stays fixed while its actual calendar owner scrolls").toBeLessThan(2);
    expect(Math.max(...postRender.map(f=>f.roomY))-Math.min(...postRender.map(f=>f.roomY))).toBeLessThan(2);
  }
  // Releasing the resident switches back to its unchanged viewport world
  // before keyboard placement; the native anchor must never trap a held pet.
  await page.setViewportSize({width,height:780}); await settlePanelLayout(page);
  await actor.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }).focus();
  await actor.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }).press("p");
  await expect(actor).not.toHaveAttribute("data-native-sofa");
  await page.mouse.click(width-70,650); await expect(actor).not.toHaveAttribute("data-placing");
  observations.set(page,{...observations.get(page),placementEscape:{nativeAnchorReleased:true,placementCompleted:true}});
});
