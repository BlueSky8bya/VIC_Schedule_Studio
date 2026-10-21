import { assertCompanionSilhouettes } from "./helpers/companion-silhouette";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY, COMPANION_BEHAVIOR_IDS, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

type BookKind = "food" | "toy" | "memory" | "wardrobe";
type Click = { target: string; direction: string | null; label: string | null };
type Activity = { kind: string; target?: string | null; meta?: unknown; durMs?: number | null };
const output = process.env.COMPANION134_GALLERY_OUTPUT ?? ".scratch-pw/companion-134/gallery";
const activityBase = process.env.VIC_ACTIVITY_BASE_URL ?? "http://127.0.0.2:3100";
const receipts = new WeakMap<Page, { name: string; pending: Promise<void>[]; recordDots: (sample: unknown) => void; read: () => unknown }>();
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const scoped = (target: string) => /^(companion-collection-(page|inspect|category)|companion-accessory-select)(#|$)/.test(target);
const counts = (targets: string[]) => Object.fromEntries([...new Set(targets)].sort().map(target => [target, targets.filter(item => item === target).length]));
const identities: Record<BookKind, readonly string[]> = { food: COMPANION_FOOD_KINDS, toy: COMPANION_TOY_KINDS, memory: [...COMPANION_BEHAVIOR_IDS.map(id => `behavior:${id}`), ...COMPANION_SITUATION_IDS.map(id => `moment:${id}`)], wardrobe: COMPANION_WEARABLE_IDS };
// Deliberately supplied prior local collections, not discoveries earned by
// this session. No engine, geometry, RNG, clock or action callback is altered.
const prior: CompanionCollection = {
  version: 1, foods: [0, 1, 2, 24, 179].map(index => COMPANION_FOOD_KINDS[index]), behaviors: [0, 1, 3].map(index => COMPANION_BEHAVIOR_IDS[index]), situations: [COMPANION_SITUATION_IDS[0], COMPANION_SITUATION_IDS.at(-1)!],
  gifts: { pending: null, unlocked: [COMPANION_WEARABLE_IDS[0], COMPANION_WEARABLE_IDS[1], COMPANION_WEARABLE_IDS[2], COMPANION_WEARABLE_IDS.at(-1)!], equipped: COMPANION_WEARABLE_IDS[0], activeMs: 0, interactionCredit: 0 },
  seen: { foods: [COMPANION_FOOD_KINDS[0]], behaviors: [COMPANION_BEHAVIOR_IDS[0]], situations: [], accessories: [COMPANION_WEARABLE_IDS[0]] },
};
const priorToys = ["ball", "blocks", "feather", "toy-rocket"];
const known: Record<BookKind, string[]> = { food: prior.foods, toy: priorToys, memory: [...prior.behaviors.map(id => `behavior:${id}`), ...prior.situations.map(id => `moment:${id}`)], wardrobe: prior.gifts.unlocked };
const seenItems = (page: Page, kind: BookKind) => page.evaluate(({ kind, key }) => {
  if (kind === "toy") return (JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!) as { seen: string[] }).seen;
  const collection = JSON.parse(localStorage.getItem(key)!) as CompanionCollection, seen = collection.seen!;
  return kind === "food" ? seen.foods : kind === "wardrobe" ? seen.accessories : [...seen.behaviors.map(id => `behavior:${id}`), ...seen.situations.map(id => `moment:${id}`)];
}, { kind, key: COMPANION_COLLECTION_KEY });

type DotBounds134 = { x:number;right:number;y:number;bottom:number;width:number;height:number };
/** Preserve DOM page order across actual wrapped rows. The tolerance is the
 * original0.1 CSS px; neither same-row overlap nor backwards rows are allowed. */
function dotLayoutIssues134(dots: readonly DotBounds134[]) {
  const issues:string[]=[];
  const valid=(dot:DotBounds134)=>[dot.x,dot.right,dot.y,dot.bottom,dot.width,dot.height].every(Number.isFinite)
    &&dot.width>0&&dot.height>0&&dot.right>dot.x&&dot.bottom>dot.y
    &&Math.abs(dot.right-dot.x-dot.width)<=.1&&Math.abs(dot.bottom-dot.y-dot.height)<=.1;
  for(let i=0;i<dots.length;i++){
    const dot=dots[i];if(!valid(dot)){issues.push(`invalid:${i}`);continue;}
    const previous=dots[i-1];
    if(previous&&valid(previous)){
      const verticalOverlap=Math.min(previous.bottom,dot.bottom)-Math.max(previous.y,dot.y);
      if(verticalOverlap>.1 ? previous.right>dot.x+.1 : previous.bottom>dot.y+.1)issues.push(`order:${i-1}:${i}`);
    }
    for(let j=0;j<i;j++){
      const other=dots[j];if(!valid(other))continue;
      if(Math.min(other.right,dot.right)-Math.max(other.x,dot.x)>.1
        &&Math.min(other.bottom,dot.bottom)-Math.max(other.y,dot.y)>.1)issues.push(`overlap:${j}:${i}`);
    }
  }
  return issues;
}

async function assertDots(book: Locator, unread: number[], size: number) {
  const rail = book.getByRole("slider"), page = Number(await rail.inputValue()) - 1, maximum = Number(await rail.getAttribute("max"));
  await expect(book.locator(".rhh-collection-page-bar")).toHaveCount(0);
  const dots = book.locator(".rhh-collection-page-dots > span[data-page]"); await expect(dots).toHaveCount(maximum);
  // This book intentionally scrolls at short viewport heights. Reveal the
  // actual native target before measuring; do not alter its content or layout.
  await rail.scrollIntoViewIfNeeded();
  // Dot and ancestor rectangles must describe the same browser frame. A
  // selected-tile focus or native scroll may move the whole footer between
  // separate protocol reads while every individual rectangle remains valid.
  const measure = () => book.evaluate(root => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
    const railNode = root.querySelector<HTMLInputElement>(".rhh-collection-page-rail"), dotNode = root.querySelector<HTMLElement>(".rhh-collection-page-dots");
    if (!railNode || !dotNode) throw new Error("Actual collection rail and dots are required");
    const viewport = window.visualViewport, x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    const clip = { x, y, right:x+(viewport?.width ?? document.documentElement.clientWidth), bottom:y+(viewport?.height ?? document.documentElement.clientHeight) };
    const clips = [];
    for (let node: HTMLElement | null = dotNode.parentElement; node; node = node.parentElement) {
      const s = getComputedStyle(node), r = rect(node), clipsX = /^(auto|scroll|hidden|clip)$/.test(s.overflowX), clipsY = /^(auto|scroll|hidden|clip)$/.test(s.overflowY);
      if (!clipsX && !clipsY) continue;
      // Native client boxes exclude borders and scrollbars. BCR/offset ratios
      // retain the actual shell zoom instead of assuming an unscaled 44px UI.
      const scaleX = r.width / node.offsetWidth, scaleY = r.height / node.offsetHeight;
      const inner = { x:r.x+node.clientLeft*scaleX, y:r.y+node.clientTop*scaleY, right:r.x+(node.clientLeft+node.clientWidth)*scaleX, bottom:r.y+(node.clientTop+node.clientHeight)*scaleY };
      clips.push({ tag:node.tagName, className:node.className, overflowX:s.overflowX, overflowY:s.overflowY, cssWidth:s.width, cssHeight:s.height, boxSizing:s.boxSizing, borderLeft:s.borderLeftWidth, borderRight:s.borderRightWidth, borderTop:s.borderTopWidth, borderBottom:s.borderBottomWidth, zoom:s.zoom, transform:s.transform, display:s.display, scrollLeft:node.scrollLeft, scrollTop:node.scrollTop, scrollWidth:node.scrollWidth, scrollHeight:node.scrollHeight, paddingTop:s.paddingTop, paddingRight:s.paddingRight, paddingBottom:s.paddingBottom, paddingLeft:s.paddingLeft, clientWidth:node.clientWidth, clientHeight:node.clientHeight, offsetWidth:node.offsetWidth, offsetHeight:node.offsetHeight, scaleX, scaleY, box:r, inner });
      if (clipsX) { clip.x=Math.max(clip.x,inner.x); clip.right=Math.min(clip.right,inner.right); }
      if (clipsY) { clip.y=Math.max(clip.y,inner.y); clip.bottom=Math.min(clip.bottom,inner.bottom); }
    }
    const railStyle = getComputedStyle(railNode), positionStyle = getComputedStyle(railNode.parentElement!), bookStyle=getComputedStyle(root), bookNode=root as HTMLElement;
    const bookBox=rect(root),railBox=rect(railNode),left=Math.max(bookBox.x,clip.x),right=Math.min(bookBox.right,clip.right),top=Math.max(bookBox.y,clip.y),bottom=Math.min(bookBox.bottom,clip.bottom);
    const point={x:left+2,y:bottom-2},hit=document.elementFromPoint(point.x,point.y);
    const wheelPoint={...point,inside:point.x>left&&point.x<right&&point.y>top&&point.y<bottom,
      outsideRange:point.x<railBox.x-.1,hitInBook:Boolean(hit&&root.contains(hit)),hitOnRange:Boolean(hit&&railNode.contains(hit))};
    const bookScroll={scrollTop:root.scrollTop,scrollHeight:root.scrollHeight,scrollWidth:root.scrollWidth,clientHeight:root.clientHeight,clientWidth:root.clientWidth,
      offsetHeight:bookNode.offsetHeight,offsetWidth:bookNode.offsetWidth,cssHeight:bookStyle.height,overflowY:bookStyle.overflowY,
      paddingTop:bookStyle.paddingTop,paddingRight:bookStyle.paddingRight,paddingBottom:bookStyle.paddingBottom,paddingLeft:bookStyle.paddingLeft};
    const selected=[...root.querySelectorAll<HTMLElement>("[data-collection-index][aria-pressed='true']")].map(node=>node.getAttribute("data-collection-index"));
    const painted=Boolean(root.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&railNode.checkVisibility({checkVisibilityCSS:true})&&!railNode.closest("[hidden],[inert]"));
    return { at:performance.now(), page:Number(railNode.value)-1, maximum:Number(railNode.max), book:bookBox, bookScroll, selected, painted, wheelPoint, dotBox:rect(dotNode), rail:railBox, clip, clips,
      railOpacity:railStyle.opacity, positionMinHeight:positionStyle.minHeight, hitSize:positionStyle.getPropertyValue("--companion-hit-size"), shellZoom:positionStyle.getPropertyValue("--shell-zoom"),
      styles:[...dotNode.querySelectorAll<HTMLElement>(":scope > span[data-page]")].map(node => { const s = getComputedStyle(node); return { page:Number(node.dataset.page), unread:node.hasAttribute("data-unread"), current:node.getAttribute("aria-current")==="page", background:s.backgroundColor, image:s.backgroundImage, shadow:s.boxShadow, opacity:Number(s.opacity), ...rect(node) }; }) };
  });
  let measurement=await measure();
  receipts.get(book.page())?.recordDots({phase:"after-native-scroll-into-view",...measurement});
  // Chromium's native reveal can truncate a subpixel edge inside a zoomed
  // scrollport. Only a measured <=1px remainder with real DOM scroll extent
  // may receive this one native1px wheel; all original bounds still apply.
  const beforeWheel=measurement,scroll=beforeWheel.bookScroll;
  const below=beforeWheel.rail.bottom-beforeWheel.clip.bottom,above=beforeWheel.clip.y-beforeWheel.rail.y;
  const direction=below>.1&&below<=1&&above<=.1 ? 1 : above>.1&&above<=1&&below<=.1 ? -1 : 0;
  const scale=beforeWheel.book.width/scroll.offsetWidth,availableCss=direction>0 ? scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop : scroll.scrollTop;
  const finite=[below,above,scale,availableCss,...Object.values(beforeWheel.book),...Object.values(beforeWheel.rail),...Object.values(beforeWheel.clip)].every(Number.isFinite);
  const dotsInside=beforeWheel.dotBox.x>=beforeWheel.clip.x-.1&&beforeWheel.dotBox.right<=beforeWheel.clip.right+.1
    &&beforeWheel.dotBox.y>=beforeWheel.clip.y-.1&&beforeWheel.dotBox.bottom<=beforeWheel.clip.bottom+.1
    &&beforeWheel.dotBox.x>=beforeWheel.book.x&&beforeWheel.dotBox.right<=beforeWheel.book.right
    &&beforeWheel.dotBox.y>=beforeWheel.book.y&&beforeWheel.dotBox.bottom<=beforeWheel.book.bottom;
  const horizontal=beforeWheel.rail.x>=beforeWheel.clip.x-.1&&beforeWheel.rail.right<=beforeWheel.clip.right+.1;
  const point=beforeWheel.wheelPoint;
  if(direction&&finite&&scale>0&&availableCss*scale>=1&&/^(auto|scroll)$/.test(scroll.overflowY)
    &&beforeWheel.painted&&beforeWheel.rail.width>=43.9&&beforeWheel.rail.height>=43.9&&dotsInside&&horizontal
    &&point.inside&&point.outsideRange&&point.hitInBook&&!point.hitOnRange){
    const observedAt=beforeWheel.at;
    await book.page().mouse.move(point.x,point.y);
    await book.page().mouse.wheel(0,direction);
    const wheelIssuedAt=Date.now(),consumeDeadline=wheelIssuedAt+500;
    await book.page().evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    measurement=await measure();
    const consumeSamples=[{at:measurement.at,scrollTop:measurement.bookScroll.scrollTop,rail:measurement.rail,clip:measurement.clip}];
    // Native wheel delivery is asynchronous. Two painted frames alone do
    // not acknowledge consumption; observe actual geometry for at most500ms.
    // There is no repeated wheel, injected scroll, or timer-based success.
    while(measurement.bookScroll.scrollTop===scroll.scrollTop&&Date.now()<consumeDeadline){
      const remaining=consumeDeadline-Date.now();if(remaining<=0)break;
      await book.page().waitForTimeout(Math.min(25,remaining));
      if(Date.now()>consumeDeadline)break;
      measurement=await measure();
      consumeSamples.push({at:measurement.at,scrollTop:measurement.bookScroll.scrollTop,rail:measurement.rail,clip:measurement.clip});
    }
    receipts.get(book.page())?.recordDots({phase:"after-bounded-native-wheel",nativeWheel:{deltaY:direction,point:{x:point.x,y:point.y},observedAt,
      measuredDomAvailableCss:availableCss,measuredScale:scale,priorScrollTop:scroll.scrollTop,currentScrollTop:measurement.bookScroll.scrollTop,
      consumptionObservation:{budgetMs:500,elapsedMs:Date.now()-wheelIssuedAt,changed:measurement.bookScroll.scrollTop!==scroll.scrollTop,samples:consumeSamples}},...measurement});
    expect(measurement.page,"native wheel reveal preserves the real page value").toBe(beforeWheel.page);
    expect(measurement.maximum).toBe(beforeWheel.maximum);
    expect(measurement.selected,"native wheel reveal preserves the real selected item").toEqual(beforeWheel.selected);
  }
  const styles = measurement.styles;
  expect(measurement.page).toBe(page); expect(measurement.maximum).toBe(maximum);
  const expected = new Set(unread.map(index => Math.floor(index / size)));
  expect(styles.map(dot => dot.page)).toEqual(Array.from({ length: maximum }, (_, index) => index));
  expect(styles.filter(dot => dot.unread).map(dot => dot.page)).toEqual([...expected].sort((a, b) => a - b));
  expect(styles.filter(dot => dot.current).map(dot => dot.page)).toEqual([page]);
  const current = styles[page], gray = styles.find(dot => !dot.unread && !dot.current);
  if (!current.unread) { const rgb = current.background.match(/[\d.]+/g)!.map(Number); expect(rgb[2]).toBeGreaterThan(rgb[0]); }
  for (const warm of styles.filter(dot => dot.unread && !dot.current)) { const c = warm.background.match(/[\d.]+/g)!.map(Number); expect(c[0]).toBeGreaterThan(c[2]); expect(warm.opacity).toBe(1); expect(warm.background).not.toBe(current.background); if (gray) expect(warm.background).not.toBe(gray.background); }
  if (current.unread) { const stops = [...current.image.matchAll(/rgba?\(([^)]+)\)/g)].map(match => match[1].match(/[\d.]+/g)!.map(Number)), colors = stops.filter((color, index) => !index || color.some((channel, at) => channel !== stops[index - 1][at])); expect(current.image).toContain("linear-gradient"); expect(colors).toHaveLength(2); expect(colors[0][2]).toBeGreaterThan(colors[0][0]); expect(colors[1][0]).toBeGreaterThan(colors[1][2]); }
  for (const dot of styles) { expect(dot.shadow).toBe("none"); expect(dot.width).toBeGreaterThan(0); expect(dot.height).toBeGreaterThan(0); }
  expect(dotLayoutIssues134(styles), "all dots stay separate and preserve actual row-major page order").toEqual([]);
  if (expected.size) { const description = await rail.getAttribute("aria-describedby"); expect(description).toBeTruthy(); await expect(book.locator(`[id="${description}"]`)).toHaveText(`새 발견이 남은 페이지: ${[...expected].sort((a, b) => a - b).map(index => index + 1).join(", ")}`); } else await expect(rail).not.toHaveAttribute("aria-describedby");
  const box = measurement.rail; expect(box.width).toBeGreaterThanOrEqual(43.9); expect(box.height).toBeGreaterThanOrEqual(43.9);
  await expect(rail).toHaveCSS("opacity", "0"); await expect(rail).toHaveAttribute("aria-valuetext", `${maximum}페이지 중 ${page + 1}페이지`);
  const dotBox = measurement.dotBox, bookBox = measurement.book;
  // The complete dot field and actual target must be visible through every
  // real overflow ancestor after scrolling, as well as inside the book.
  const visible = measurement.clip;
  expect([visible.x,visible.y,visible.right,visible.bottom,...measurement.clips.flatMap(item => [item.scaleX,item.scaleY])].every(Number.isFinite)).toBe(true);
  expect(visible.right).toBeGreaterThan(visible.x); expect(visible.bottom).toBeGreaterThan(visible.y);
  for (const actual of [dotBox,box]) {
    expect(actual.x).toBeGreaterThanOrEqual(visible.x-.1); expect(actual.right).toBeLessThanOrEqual(visible.right+.1);
    expect(actual.y).toBeGreaterThanOrEqual(visible.y-.1); expect(actual.bottom).toBeLessThanOrEqual(visible.bottom+.1);
  }
  expect(dotBox.x).toBeGreaterThanOrEqual(bookBox.x); expect(dotBox.x + dotBox.width).toBeLessThanOrEqual(bookBox.x + bookBox.width);
  expect(dotBox.y).toBeGreaterThanOrEqual(bookBox.y); expect(dotBox.y + dotBox.height).toBeLessThanOrEqual(bookBox.y + bookBox.height);
  for (const dot of styles) {
    expect(dot.x).toBeGreaterThanOrEqual(dotBox.x - .1); expect(dot.right).toBeLessThanOrEqual(dotBox.x + dotBox.width + .1);
    expect(dot.y).toBeGreaterThanOrEqual(dotBox.y - .1); expect(dot.bottom).toBeLessThanOrEqual(dotBox.y + dotBox.height + .1);
  }
  return styles;
}

test.use({ baseURL: activityBase, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.afterEach(async ({ page }, info) => {
  const receipt = receipts.get(page); if (!receipt) return;
  await Promise.allSettled(receipt.pending); mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/${receipt.name}.json`, JSON.stringify({ actualStatus: info.status, evidence: receipt.read() }, null, 2));
});
for (const [surface, width, height, dark] of [["viewer", 1050, 640, false], ["studio", 1920, 1100, true], ["preview", 1440, 900, false]] as const) test(`134 ${surface}: arrows activate displayed buttons, unread dots and single semantic activity`, async ({ page }) => {
  test.setTimeout(120000); mkdirSync(output, { recursive: true });
  const origin = new URL(activityBase).origin, buildDir = process.env.VISUAL_TEST_BUILD_DIR ?? ".next", build = readFileSync(resolve(buildDir, "BUILD_ID"), "utf8").trim();
  const events: Activity[] = [], clicks: Click[] = [], manual: string[] = [], errors: string[] = [], blocked: string[] = [], mutations: string[] = [], steps: unknown[] = [], dotMeasurements: unknown[] = [], chunks: { served: string; local: string }[] = [], pending: Promise<void>[] = [];
  let expected: Record<string, number> = {};
  receipts.set(page, { name: surface, pending, recordDots: sample => dotMeasurements.push(sample), read: () => ({ build, priorLocalFixtureOnly: true, earnedInSession: false, clicks, manual, expected, events, steps, dotMeasurements, chunks, errors, blocked, interceptedMutations: mutations }) });
  const manifest = JSON.parse(readFileSync(resolve(buildDir, "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewActions = new Set(Object.entries(manifest).filter(([, item]) => item.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (response.status() !== 200 || !/^\/_next\/static\/chunks\/app\/visual-fixture\/(poster|studio)\/page-[\w-]+\.js$/.test(url.pathname)) return;
    pending.push((async () => { const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex"); chunks.push({ served: hash(await response.body()), local: hash(readFileSync(resolve(buildDir, "static", url.pathname.slice("/_next/static/".length)))) }); })().catch(error => { errors.push(`chunk proof: ${String(error)}`); }));
  });
  await page.exposeBinding("recordGallery134Click", (_source, value: Click) => clicks.push(value));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), local = url.origin === origin || url.origin === origin.replace("127.0.0.2", "127.0.0.1");
    if (!local) { if (request.resourceType() === "font") return fulfillReadOnlyFont(route, fonts, blocked); blocked.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (!["GET", "HEAD"].includes(request.method())) {
      mutations.push(`${request.method()} ${url.pathname}`);
      if (url.pathname === "/api/activity") { events.push(...(request.postDataJSON() as { events: Activity[] }).events); return route.fulfill({ json: { ok: true } }); }
      if (["/api/visit", "/api/presence", "/api/visit-session", "/api/visit-ping"].includes(url.pathname)) return route.fulfill({ json: { ok: true, skipped: true } });
      if (url.pathname === "/visual-fixture/studio" && previewActions.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
      blocked.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "No live mutation in fixture" });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { live: false } });
    if (url.hostname === "127.0.0.2") { url.hostname = "127.0.0.1"; return route.continue({ url: url.href }); }
    return route.continue();
  });
  await page.addInitScript(({ preferences, memory, prior, priorToys, epoch, epochKey, dark }) => {
    // Enable the existing client queue only inside this fully intercepted
    // loopback fixture. This is not a role/authentication or analytics bypass.
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false });
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "on", "vic.gfxPref": "off", "vic.dark": dark ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, feeding: false, ambientPrank: false, heartPrank: false, panelPrank: false, cardPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory })); localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify(prior));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys: priorToys, seen: ["ball"], toyTastes: {}, foodTastes: {} }));
    // Passive capture only: records which real displayed button was clicked;
    // never invokes a control, changes app state, or reads an item identity.
    document.addEventListener("click", event => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button[data-act]"); if (!button) return;
      const action = button.dataset.act ?? ""; if (!/^(companion-collection-(page|inspect|category)|companion-accessory-select)$/.test(action)) return;
      void (window as unknown as { recordGallery134Click: (value: Click) => Promise<void> }).recordGallery134Click({ target: action + (button.dataset.actOpt ? `#${button.dataset.actOpt}` : ""), direction: button.dataset.pageDirection ?? null, label: button.getAttribute("aria-label") });
    }, true);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, prior, priorToys, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, dark });
  await page.setViewportSize({ width, height }); await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2025&m=11"); await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
  let dialog: Locator;
  if (surface === "viewer") { const home = await openCompanionHome(page); await home.locator('[data-home-action="book"]').click(); dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); }
  else {
    if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) { await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page); }
    if (!await page.getByRole("button", { name: "설정", exact: true }).isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
    await page.getByRole("button", { name: "설정", exact: true }).click(); dialog = page.getByRole("dialog", { name: "설정", exact: true }); await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  }
  await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  const profile = dialog.locator(".rhh-companion-profile"), nav = profile.getByRole("tablist", { name: "빅타민 프로필", exact: true }); await nav.getByRole("tab", { name: "도감", exact: true }).click();
  for (const kind of ["food", "toy", "memory", "wardrobe"] as const) {
    if (kind === "wardrobe") await nav.getByRole("tab", { name: "옷장", exact: true }).click();
    else await profile.locator(`[data-act="companion-collection-category"][data-act-opt="${kind === "memory" ? "behavior" : kind}"]`).click();
    const book = profile.locator(kind === "toy" ? ".rhh-companion-toy-discovery" : kind === "wardrobe" ? ".rhh-companion-wardrobe" : ".rhh-companion-discovery"), grid = book.locator("ul"), rail = book.getByRole("slider");
    const category = kind === "wardrobe" ? nav.getByRole("tab", { name: "옷장", exact: true }) : profile.locator(`[data-act="companion-collection-category"][data-act-opt="${kind === "memory" ? "behavior" : kind}"]`);
    const current = async () => Number(await grid.locator('[aria-pressed="true"]').getAttribute("data-collection-index"));
    const remaining = async () => { const seen = await seenItems(page, kind); return known[kind].filter(id => !seen.includes(id)).map(id => identities[kind].indexOf(id)).sort((a, b) => a - b); };
    const manualPage = async (key: "Home" | "End" | "PageUp" | "PageDown") => {
      if (!await rail.isEnabled()) return;
      const before = Number(await rail.inputValue()), maximum = Number(await rail.getAttribute("max")), seen = await seenItems(page, kind); await rail.focus(); await rail.press(key);
      const targetPage = key === "Home" ? 1 : key === "End" ? maximum : key === "PageUp" ? Math.max(1, before - 1) : Math.min(maximum, before + 1);
      await expect(rail).toHaveValue(String(targetPage));
      const after = Number(await rail.inputValue()); if (after !== before) manual.push(`companion-collection-page#${after < before ? "prev" : "next"}`);
      expect(await seenItems(page, kind)).toEqual(seen);
    };
    await manualPage("Home"); await grid.locator('[data-collection-index="0"]').click();
    const size = await grid.locator("button").count(), maximum = Number(await rail.getAttribute("max")), initialDots = await assertDots(book, await remaining(), size);
    const activate = async (direction: "prev" | "next", focus: Locator, label: string) => {
      const button = book.locator(`[data-page-direction="${direction}"]`), beforeIndex = await current(), beforePage = Number(await rail.inputValue()), beforeSeen = await seenItems(page, kind), unread = await remaining();
      const nearest = direction === "next" ? unread.find(index => index > beforeIndex) : unread.filter(index => index < beforeIndex).at(-1);
      const target = nearest ?? (beforePage - 1 + (direction === "next" ? 1 : -1)) * size;
      const disabled = await button.isDisabled(), beforeClicks = clicks.length, semantic = (await button.getAttribute("data-act"))! + (await button.getAttribute("data-act-opt") ? `#${await button.getAttribute("data-act-opt")}` : ""), aria = await button.getAttribute("aria-label");
      await focus.focus(); await focus.press(direction === "next" ? "ArrowRight" : "ArrowLeft");
      if (disabled) { await page.waitForTimeout(80); expect(clicks).toHaveLength(beforeClicks); expect(await current()).toBe(beforeIndex); expect(await seenItems(page, kind)).toEqual(beforeSeen); }
      else {
        await expect.poll(() => clicks.length).toBe(beforeClicks + 1); expect(clicks.at(-1)).toEqual({ target: semantic, direction, label: aria });
        await expect(grid.locator(`[data-collection-index="${target}"]`)).toHaveAttribute("aria-pressed", "true");
        // Persistence normalizes acknowledgements to catalog order. Compare
        // exact identities and cardinality, not chronological insertion order.
        await expect.poll(async () => (await seenItems(page, kind)).sort()).toEqual((nearest === undefined ? [...beforeSeen] : [...beforeSeen, identities[kind][nearest]]).sort());
        if (nearest !== undefined) await expect(grid.locator(`[data-collection-index="${nearest}"]`)).not.toHaveAttribute("data-unread");
      }
      await expect(category).toHaveAttribute(kind === "wardrobe" ? "aria-selected" : "aria-pressed", "true");
      await expect(nav.getByRole("tab", { name: kind === "wardrobe" ? "옷장" : "도감", exact: true })).toHaveAttribute("aria-selected", "true");
      steps.push({ kind, label, direction, beforeIndex, afterIndex: await current(), nearest, disabled, semantic }); await assertDots(book, await remaining(), size);
    };
    await manualPage("End");
    const beforePrevious = await current(), previousUnread = (await remaining()).filter(index => index < beforePrevious).at(-1);
    expect(previousUnread).toBeDefined(); expect(previousUnread).not.toBe(beforePrevious - 1);
    await activate("prev", kind === "toy" || kind === "wardrobe" ? rail : category, "category or range focus / previous nearest unread");
    expect(await current()).toBe(previousUnread);
    await manualPage("Home");
    // A native range already at page 1 emits no change for Home. Explicitly
    // select the previously read first tile without consuming another unread.
    const afterPreviousSeen = await seenItems(page, kind);
    await grid.locator('[data-collection-index="0"]').click(); expect(await seenItems(page, kind)).toEqual(afterPreviousSeen);
    await activate("next", category, "category focus / same-page unread"); expect(await current()).toBe(1);
    await activate("next", grid.locator('[data-collection-index="0"]'), "tile focus uses selection, not focused tile index");
    for (let step = 0; (await remaining()).length; step++) {
      expect(step).toBeLessThan(6); const unread = await remaining(), index = await current(), direction = unread.some(item => item > index) ? "next" : "prev";
      await activate(direction, step === 0 && await rail.isEnabled() ? rail : book.locator(`[data-page-direction="${direction}"]`), step === 0 ? "range focus / later-page unread" : "footer focus / next unread");
    }
    await manualPage("Home");
    if (maximum > 1) {
      await activate("next", category, "zero-unread category / manual next page"); expect(await current()).toBe(size);
      const control = kind === "wardrobe" ? book.locator('[data-act="companion-accessory-equip"]').first() : grid.locator('[aria-pressed="true"]');
      await activate("prev", control, "zero-unread tile or fitting control / manual previous page"); expect(await current()).toBe(0);
      await activate("next", rail, "zero-unread range / same visible next button");
      await activate("prev", book.locator('[data-page-direction="prev"]'), "zero-unread footer / same previous button");
    }
    await activate("prev", category, "disabled start consumes key without category or tile movement"); await manualPage("End");
    await activate("next", grid.locator('[aria-pressed="true"]'), "disabled end consumes key without inspection");
    expect(await page.evaluate(key => (JSON.parse(localStorage.getItem(key)!) as CompanionCollection).gifts.equipped, COMPANION_COLLECTION_KEY)).toBe(prior.gifts.equipped);
    await assertCompanionSilhouettes(grid);
    await dialog.screenshot({ path: `${output}/${surface}-${kind}.png` }); steps.push({ kind, initialDots, finalDots: await assertDots(book, [], size) });
  }
  // Let the real bounded client queue flush naturally. Every mutation has
  // already been intercepted above; no synthetic blur or application hook.
  expected = counts([...clicks.map(click => click.target), ...manual]);
  await expect.poll(() => counts(events.filter(event => event.kind === "ui.click" && scoped(event.target ?? "")).map(event => event.target!)), { timeout: 10000 }).toEqual(expected);
  await page.waitForTimeout(160); expect(counts(events.filter(event => event.kind === "ui.click" && scoped(event.target ?? "")).map(event => event.target!))).toEqual(expected);
  const relevant = events.filter(event => event.kind === "ui.click" && scoped(event.target ?? "")); expect(relevant.every(event => event.meta === null && event.durMs === null)).toBe(true);
  expect(relevant.every(event => !event.target!.includes("#") || ["prev", "next", "food", "toy", "behavior", "moment"].includes(event.target!.split("#")[1]))).toBe(true);
  await Promise.all(pending); expect(chunks.length).toBeGreaterThan(0); expect(chunks.every(chunk => chunk.served === chunk.local)).toBe(true); expect(readFileSync(resolve(buildDir, "BUILD_ID"), "utf8").trim()).toBe(build);
  expect(errors).toEqual([]); expect(blocked).toEqual([]);
});
