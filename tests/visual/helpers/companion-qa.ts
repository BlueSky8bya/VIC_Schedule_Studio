import { expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { inspectTrace, traceSufficiency, traceContextComplete, type QaFrame } from "../../../scripts/companion-qa/trace-checks.mjs";
import { fulfillReadOnlyFont } from "./readonly-font";
import { traceLivingContextComplete } from "../../../scripts/companion-qa/living-criteria.mjs";

export type Companion143DiagnosticRecord = {stage:string;activeMs:number;facts:Readonly<Record<string,unknown>>};
/** Opt-in observation only. It exposes no actor/scene/clock/geometry setter. */
export async function enableCompanion143Diagnostics(page:Page):Promise<void> {
  await page.addInitScript(()=>{(window as Window & {__vicCompanionDiagnostics143?:{version:1;records:Companion143DiagnosticRecord[]}}).__vicCompanionDiagnostics143={version:1,records:[]};});
}
export async function readCompanion143Diagnostics(page:Page):Promise<Companion143DiagnosticRecord[]> {
  return page.evaluate(()=>{const value=(window as Window & {__vicCompanionDiagnostics143?:{version:number;records:Companion143DiagnosticRecord[]}}).__vicCompanionDiagnostics143;
    return value?.version===1&&Array.isArray(value.records)?value.records.slice(0,24):[];});
}
export type QaObservation = QaFrame & { sourceClipMeasured: boolean; scene: string; beat: string; platform: string; frame: number };
type ProbeWindow = Window & { companionDaily142?: { frames: QaObservation[]; stop: () => void } };
export type DailyProof = { build: string; errors: string[]; rejected: string[]; mutations: string[]; liveReads: string[]; blockedTelemetry: string[]; chunks: { path: string; served: string; local: string }[]; pending: Promise<void>[] };
export async function guardCompanionQa(page: Page, context: BrowserContext, base: string): Promise<DailyProof> {
  const origin = new URL(base);
  if (origin.protocol !== "http:" || !["localhost", "127.0.0.1", "127.0.0.2", "[::1]"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw Error("Only exact HTTP loopback fixture origins are allowed");
  await enableCompanion143Diagnostics(page);
  const directory = process.env.VISUAL_TEST_BUILD_DIR ?? ".next", proof: DailyProof = { build: readFileSync(resolve(directory, "BUILD_ID"), "utf8").trim(), errors: [], rejected: [], mutations: [], liveReads: [], blockedTelemetry: [], chunks: [], pending: [] };
  const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
  const manifest = JSON.parse(readFileSync(resolve(directory, "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const preview = new Set(Object.entries(manifest).filter(([, item]) => item.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url()); if (url.origin !== origin.origin || response.status() !== 200 || !/^\/_next\/static\/chunks\/.+\.js$/.test(url.pathname)) return;
    proof.pending.push((async () => { const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex"); proof.chunks.push({ path: url.pathname, served: digest(await response.body()), local: digest(readFileSync(resolve(directory, "static", url.pathname.slice("/_next/static/".length)))) }); })().catch(error => { proof.errors.push(`chunk check: ${String(error)}`); }));
  });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.resourceType() === "font" && url.origin !== origin.origin) return fulfillReadOnlyFont(route, fonts, proof.rejected);
    if (url.origin !== origin.origin) { proof.rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (request.method() === "GET" && !url.search && !url.hash && ["/_vercel/insights/script.js", "/_vercel/speed-insights/script.js"].includes(url.pathname)) {
      // Expected telemetry bootstraps are never fetched or executed. Keep
      // their blocked count separate from unexpected paths and live APIs.
      proof.blockedTelemetry.push(url.pathname);
      return route.fulfill({ status: 200, contentType: "application/javascript", body: "/* Telemetry disabled in the synthetic QA fixture. */" });
    }
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && preview.has(request.headers()["next-action"])) {
      // This exact read is fulfilled locally, never executed on the server.
      return import("@/lib/schedules/sample-public-data").then(({ samplePublicScheduleData }) => route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` }));
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.mutations.push(`${request.method()} ${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) { proof.liveReads.push(url.pathname); return route.fulfill({ status: 404, body: "Daily companion QA blocks every live API read" }); }
    if (url.pathname.startsWith("/visual-fixture/") || url.pathname.startsWith("/_next/static/")) return route.continue();
    const publicRoot = resolve("public");
    const asset = (value: string) => { try { const file = resolve(publicRoot, "." + decodeURIComponent(value)); return file.startsWith(publicRoot + sep) && statSync(file, { throwIfNoEntry: false })?.isFile(); } catch { return false; } };
    if (url.pathname === "/_next/image" && asset(url.searchParams.get("url") ?? "")) return route.continue();
    if (asset(url.pathname)) return route.continue();
    proof.rejected.push(`${request.method()} unapproved-local-path`); return route.abort();
  });
  return proof;
}
export async function startCompanionQaProbe(page: Page) {
  await page.evaluate(({metadata,playRows}) => {
    const scope = window as ProbeWindow; scope.companionDaily142?.stop();
    const frames: QaObservation[] = [], start = performance.now(), cache = new Map<string, { left: number; right: number; top: number; bottom: number } | null>();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = metadata.cell;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let stopped = false, request = 0, last = -Infinity, previousFood = "", stableSince = 0, cleanupSince = 0;
    // Read-only epochs: real human input or layout movement ends an ordinary
    // route candidate. No actor callback, clock or geometry state is changed.
    let humanEpoch = 0, layoutEpoch = 0, pointer: { x: number; y: number } | undefined;
    const human = (event: Event) => {
      if (!event.isTrusted) return;
      if (event.type === "pointermove") {
        const point = event as PointerEvent;
        if (!pointer || Math.hypot(point.clientX - pointer.x, point.clientY - pointer.y) >= 2) { humanEpoch++; pointer = { x: point.clientX, y: point.clientY }; }
      } else humanEpoch++;
    };
    const layout = () => { layoutEpoch++; };
    document.addEventListener("pointermove", human, true); document.addEventListener("pointerdown", human, true); document.addEventListener("keydown", human, true);
    window.addEventListener("scroll", layout, true); window.addEventListener("resize", layout);
    const sample = (at: number) => {
      if (stopped) return;
      if (at - last >= 80) {
        last = at;
        const actor = document.querySelector<HTMLElement>(".vc-companion"), rect = actor?.getBoundingClientRect(), style = actor && getComputedStyle(actor), texture = actor?.querySelector<HTMLImageElement>(".vc-texture"), sprite = actor?.querySelector<HTMLElement>(".vc-sprite");
        const preferences = (() => { try { return JSON.parse(localStorage.getItem("vic.viewerCompanion") ?? "{}"); } catch { return {}; } })();
        const visible = Boolean(actor && rect?.width && !actor.hidden && !document.hidden && style?.display !== "none" && style?.visibility !== "hidden" && Number(style?.opacity) > .05);
        const decoded = Boolean(texture?.complete && texture.naturalWidth), pose = Number(actor?.dataset.pose ?? -1), frame = metadata.frames[pose], platform = actor?.dataset.platform ?? "";
        const foods = [...document.querySelectorAll<HTMLElement>(".vc-food")], toys = [...document.querySelectorAll<HTMLElement>(".vc-toy")];
        const foodFingerprint = foods.map(item => { const r = item.getBoundingClientRect(); return `${item.dataset.food}:${item.dataset.platform}:${r.x.toFixed(1)},${r.y.toFixed(1)}`; }).join("|");
        if (foodFingerprint !== previousFood) { previousFood = foodFingerprint; stableSince = at; }
        const owned = Boolean(actor?.hasAttribute("data-placing") || actor?.dataset.state === "held" || actor?.hasAttribute("data-overlay") && actor.dataset.overlay === "quiet" || toys.some(item => item.dataset.held === "true") || foods.some(item => item.hasAttribute("data-selected") || item.matches(":active")));
        const blocked = Boolean(document.querySelector('[role="dialog"]:not([hidden])') || actor?.hasAttribute("data-working") || actor?.hasAttribute("data-workspace-busy") || actor?.hasAttribute("data-premiere-companion"));
        const quiet = document.documentElement.hasAttribute("data-reduce-motion") || ["soft", "off"].includes(document.documentElement.dataset.gfx ?? "");
        const nearby = toys.filter(item => { const r = item.getBoundingClientRect(); return item.dataset.platform === platform && item.dataset.held === "false" && item.dataset.carried === "false" && item.dataset.falling === "false" && rect && Math.hypot(r.x + r.width / 2 - rect.x - rect.width / 2, r.bottom - rect.bottom) <= 48; });
        const full = Number(document.querySelector<HTMLMeterElement>('meter[aria-label="빅타민 포만감"]')?.value ?? 0) > .65;
        const hunger = 1 - Number(document.querySelector<HTMLMeterElement>('meter[aria-label="빅타민 포만감"]')?.value ?? NaN);
        const energy = Number(document.querySelector<HTMLMeterElement>('meter[aria-label="빅타민 기력"]')?.value ?? NaN);
        const outsideVisible = [...document.querySelectorAll<HTMLElement>(".public-day,.agenda-day,.studio-day")].slice(0, 50).some(node => {
          const r = node.getBoundingClientRect(); return r.width > 60 && r.height > 30 && r.bottom > 100 && r.top < innerHeight - 30 && r.right > 70 && r.left < innerWidth - 70 && node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
        });
        const nearbyCleanupCandidate = !blocked && !owned && !quiet && preferences.personality === "tidy" && full && nearby.length >= 2 && Boolean(document.querySelector('.vc-home .vc-toy-box:not(:disabled)'));
        if (!nearbyCleanupCandidate) cleanupSince = 0; else cleanupSince ||= at;
        let clipError: number | undefined, sourceClipMeasured = false;
        if (decoded && frame && ctx && texture && sprite && texture.currentSrc.endsWith(metadata.atlases[frame.atlas].src)) {
          const key = `${texture.currentSrc}:${frame.index}`;
          if (!cache.has(key)) {
            ctx.clearRect(0, 0, metadata.cell, metadata.cell);
            ctx.drawImage(texture, frame.index % metadata.grid * metadata.cell, Math.floor(frame.index / metadata.grid) * metadata.cell, metadata.cell, metadata.cell, 0, 0, metadata.cell, metadata.cell);
            const pixels = ctx.getImageData(0, 0, metadata.cell, metadata.cell).data;
            let left = metadata.cell, right = -1, top = metadata.cell, bottom = -1;
            for (let y = 0; y < metadata.cell; y++) for (let x = 0; x < metadata.cell; x++) if (pixels[(y * metadata.cell + x) * 4 + 3] >= 250) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
            cache.set(key, right >= left ? { left, right, top, bottom } : null);
          }
          const alpha = cache.get(key), insetText = getComputedStyle(sprite).clipPath.match(/^inset\(([^)]+)\)$/)?.[1].split(/\s+/);
          const inset = insetText?.length === 4 && insetText.every(value => /^-?[\d.]+%$/.test(value)) ? insetText.map(value => parseFloat(value)) : undefined;
          if (alpha && inset?.length === 4 && inset.every(Number.isFinite)) {
            const ratio = sprite.clientWidth / metadata.cell, [top, right, bottom, left] = inset.map(value => value * metadata.cell / 100);
            clipError = Math.max(0, left - alpha.left, top - alpha.top, alpha.right - (metadata.cell - right), alpha.bottom - (metadata.cell - bottom)) * ratio; sourceClipMeasured = true;
          }
        }
        // Read only the actually painted wash tool and pad. Do not consult or
        // replace a scene callback, timer, brain, geometry tracker or ACK.
        const measuredRect = (node: Element | null) => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const painted = (node: HTMLElement | null, r: ReturnType<typeof measuredRect>) => {
          if (!node || !r || node.hidden || node.closest("[hidden],[inert]") || r.width <= 0 || r.height <= 0) return false;
          const css = getComputedStyle(node);
          return css.display !== "none" && css.visibility === "visible" && Number(css.opacity) > .05 && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && r.x + r.width > 0 && r.y + r.height > 0 && r.x < innerWidth && r.y < innerHeight;
        };
        const padNode = document.querySelector<HTMLElement>(".vc-home-wash-pad"), padRect = measuredRect(padNode), padImage = padNode?.querySelector<HTMLImageElement>("img");
        const brushNode = document.querySelector<HTMLElement>(".vc-wash-tool"), brushRect = measuredRect(brushNode), brushSvg = brushNode?.querySelector("svg");
        const matrix = brushNode ? new DOMMatrixReadOnly(getComputedStyle(brushNode).transform) : null;
        const wash = { signaled: actor?.hasAttribute("data-washing") ?? false, command: actor?.dataset.personalityCommand ?? "",
          row9: Boolean(decoded && texture && frame && sprite && painted(sprite, measuredRect(sprite)) && painted(texture, measuredRect(texture)) && texture.currentSrc.endsWith(metadata.atlases[frame.atlas].src) && metadata.rows[9].includes(pose)),
          body: measuredRect(actor), pad: padRect ? { ...padRect, visible: painted(padNode, padRect) && painted(padImage ?? null, measuredRect(padImage ?? null)), decoded: Boolean(padImage?.complete && padImage.naturalWidth) } : null,
          brush: brushRect ? { ...brushRect, visible: painted(brushNode, brushRect) && Boolean(brushSvg?.getBoundingClientRect().width), angle: matrix ? Math.atan2(matrix.b, matrix.a) * 180 / Math.PI : NaN } : null };
        // A private toy hug is not an invitation to the person. Observe the
        // same actual object, its painted image and body proximity; labels
        // and a synthetic scene/ownership callback never establish this.
        // The action label can change one decoded idle frame before its
        // actual sprite. Reuse this same measured source once, distinguishing
        // a proved different row from an unavailable/undecodable observation.
        const playSourceMeasured = Boolean(decoded && texture && frame && sprite
          && painted(sprite, measuredRect(sprite)) && painted(texture, measuredRect(texture))
          && texture.currentSrc.endsWith(metadata.atlases[frame.atlas].src));
        const playPaint = !playSourceMeasured ? "unmeasured" as const
          : playRows[actor?.dataset.play as keyof typeof playRows]?.some(row=>metadata.rows[row].includes(pose)) ? "matching" as const : "other" as const;
        const toyPlay = { body: measuredRect(actor), source: playPaint === "matching",
          toys: toys.slice(0,4).map(node=>{const rect=measuredRect(node),image=node.querySelector<HTMLImageElement>("img"),imageRect=measuredRect(image);
            return {id:node.dataset.toyId??"",carried:node.dataset.carried==="true",held:node.dataset.held==="true",falling:node.dataset.falling==="true",
              rect,imageRect,visible:painted(node,rect)&&painted(image,imageRect),decoded:Boolean(image?.complete&&image.naturalWidth)};}) };
        frames.push({ at: at - start, x: rect ? rect.x + rect.width / 2 : NaN, y: rect?.bottom ?? NaN, visible, decoded, state: actor?.dataset.state ?? "", enabled: preferences.enabled !== false, roam: preferences.roam !== false, sleepAllowed: preferences.sleep !== false,
          owned, blocked, lifePurpose: actor?.dataset.lifePurpose, humanEpoch, layoutEpoch, walkSource: Boolean(decoded && texture && frame && sprite && painted(sprite, measuredRect(sprite)) && painted(texture, measuredRect(texture)) && texture.currentSrc.endsWith(metadata.atlases[frame.atlas].src) && [2,20].some(row => metadata.rows[row].includes(pose))), eligible: visible && decoded && !quiet && !blocked && !owned && preferences.roam !== false, pose, frame: pose, sourceClipMeasured, clipError, wash, toyPlay, playPaint,
          personality: preferences.personality, hunger, energy, outsideVisible, command: actor?.dataset.personalityCommand ?? "", play: actor?.dataset.play ?? "",
          jumpSource: Boolean(decoded && texture && frame && sprite && texture.currentSrc.endsWith(metadata.atlases[frame.atlas].src) && [5,6,7].some(row => metadata.rows[row].includes(pose))),
          platform, scene: actor?.dataset.personalityScene ?? actor?.dataset.scene ?? "", beat: actor?.dataset.personalityBeat ?? actor?.dataset.sceneBeat ?? "", effect: actor?.dataset.personalityEffect ?? "", goal: actor?.dataset.foodGoal,
          carried: [...foods.filter(item => item.hasAttribute("data-carried")).map(item => item.dataset.food), ...toys.filter(item => item.dataset.carried === "true").map(item => item.dataset.toyId)].join(","), items: `${foods.map(item => item.dataset.food).join(",")}|${toys.map(item => item.dataset.toyId).join(",")}`,
          controls: [document.querySelector<HTMLElement>(".vc-home-room")?.dataset.tv ?? "", document.querySelector<HTMLElement>(".vc-home-room")?.dataset.lampLit ?? "off", document.querySelector<HTMLElement>(".vc-home-window")?.dataset.curtain ?? "", document.querySelector('[data-home-action="radio"]')?.getAttribute("aria-pressed") ?? ""].join("|"),
          stableFood: foods.length > 0 && at - stableSince >= 1000, nearbyCleanupCandidate, cleanupWaitingMs: cleanupSince ? at - cleanupSince : 0,
          intendedOcclusion: platform === "companion-home" || actor?.hasAttribute("data-hidden-reason") });
      }
      if (at - start <= 100000) request = requestAnimationFrame(sample);
    };
    scope.companionDaily142 = { frames, stop() { stopped = true; cancelAnimationFrame(request);
      document.removeEventListener("pointermove", human, true); document.removeEventListener("pointerdown", human, true); document.removeEventListener("keydown", human, true);
      window.removeEventListener("scroll", layout, true); window.removeEventListener("resize", layout);
    } }; request = requestAnimationFrame(sample);
  }, {metadata:companionSpriteMetadata,playRows:Object.fromEntries(Object.entries(COMPANION_PLAY_TIMING).map(([key,value])=>[key,value.beats.map(beat=>beat.row)]))});
}
export async function finishCompanionQa(page: Page, info: TestInfo, proof: DailyProof, scenario: Record<string, string | number>, completed: boolean, originalError?: string) {
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).companionDaily142; probe?.stop(); return probe?.frames ?? []; }).catch(() => []);
  await Promise.allSettled(proof.pending);
  const diagnostics143 = await readCompanion143Diagnostics(page).catch(()=>[]);
  const analysis = inspectTrace(frames), sufficiency = traceSufficiency(frames, Number(scenario.seconds)), directory = resolve(process.env.COMPANION_QA_OUTPUT ?? ".scratch-pw/companion-daily-manual", "daily"); mkdirSync(directory, { recursive: true });
  const id = String(scenario.id), file = resolve(directory, `${id}.json`);
  const contextComplete = traceContextComplete(frames) && traceLivingContextComplete(frames);
  const networkClean = proof.errors.length === 0 && proof.rejected.length === 0 && proof.mutations.length === 0;
  const chunksMatch = proof.chunks.length > 0 && proof.chunks.every(chunk => chunk.local === chunk.served);
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, status: completed && sufficiency.passed && contextComplete && !analysis.findings.length && networkClean && chunksMatch ? "passed" : "needs-review", scenario, originalError, diagnostics143, proof: { ...proof, pending: undefined, liveReadsExecuted: 0, telemetryRequestsExecuted: 0, blockedTelemetryCount: proof.blockedTelemetry.length }, frames, analysis, sufficiency, contextComplete, sourceClipFrames: frames.filter(f => f.sourceClipMeasured).length, limitations: "Synthetic initial preferences/care; actual UI inputs; read-only canvas/DOM observations. Every live API attempt was denied with404 and counted, never executed. Exactly two known Vercel SDK GET paths are locally fulfilled with inert JavaScript and counted separately; no SDK or telemetry request executes. No runtime/RNG/clock/geometry mutation. Physical wash uses raw pad/body/visible brush rectangles and brush rotation, exact decoded row9, at least500ms continuous contact and fresh body-relative motion; labels alone never qualify and older traces receive no retrospective credit. Nearby cleanup has no route proof; dedicated return traces are separate. Source alpha/clip measurement is a candidate, not expert art approval." }, null, 2), { flag: "wx" });
  await page.screenshot({ path: resolve(directory, `${id}.png`) }); await info.attach("companion-daily142", { path: file, contentType: "application/json" });
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]); expect(chunksMatch).toBe(true);
  expect(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim()).toBe(proof.build);
  expect(sufficiency.passed, `Actual ninety-second evidence is insufficient: ${JSON.stringify(sufficiency)}`).toBe(true);
  expect(contextComplete, "Every visible decoded daily frame needs an actual finite life-purpose, read-only human/layout epochs and measured walk-source boolean; missing context cannot pass").toBe(true);
  expect(analysis.findings, "Read-only detector candidates require evidence review, never an automatic baseline update").toEqual([]);
}
