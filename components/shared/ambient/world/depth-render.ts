import { DEPTH_PAD, type DepthOffsets, type DepthTier } from "./depth";

// A scope belongs to one canvas/context, so two camera panels cannot share offsets.
const scopes = new WeakMap<CanvasRenderingContext2D, { offsets: DepthOffsets; tier: DepthTier; current: { x: number; y: number }; owner?: object; surface?: { horizon:number; height:number } }>();
export const scopedDepthTier=(g:CanvasRenderingContext2D)=>scopes.get(g)?.tier??'full';
export const depthPadding = (g: CanvasRenderingContext2D) => scopes.has(g) ? DEPTH_PAD : 0;
export function withDepthScene(g: CanvasRenderingContext2D, offsets: DepthOffsets, draw: () => void, tier: DepthTier = "full", owner?: object) {
  const previous = scopes.get(g);
  scopes.set(g, { offsets, tier, current: offsets.ground, owner });
  g.save(); g.translate(offsets.ground.x, offsets.ground.y);
  try { draw(); } finally { g.restore(); if (previous) scopes.set(g, previous); else scopes.delete(g); }
}
export function withDepthLayer(g: CanvasRenderingContext2D, layer: "sky" | "far" | "frame" | "water", draw: () => void) {
  const scope = scopes.get(g);
  if (!scope) { draw(); return; }
  const { offsets } = scope;
  const p = layer === "sky" ? { x: 0, y: 0 } : layer === "water" ? { x: offsets.ground.x, y: 0 } : offsets[layer];
  const previous = scope.current;
  g.save(); g.translate(p.x - previous.x, p.y - previous.y);
  scope.current = p;
  try { draw(); } finally { scope.current = previous; g.restore(); }
}

export function surfaceLocalPoint(x:number,y:number,off:{x:number;y:number},horizon:number,height:number){
  let yy=y;
  for(let i=0;i<6;i++)yy=y-off.y*surfaceMotionFactor((yy-horizon)/Math.max(1,height-horizon));
  const k=surfaceMotionFactor((yy-horizon)/Math.max(1,height-horizon));
  return {x:x-off.x*k,y:yy};
}
/** Apply to a ground-bound object before its own local transform. No-op elsewhere. */
export function anchorToSurface(g:CanvasRenderingContext2D,y:number){
  const scope=scopes.get(g);if(!scope?.surface)return;
  const k=surfaceMotionFactor((y-scope.surface.horizon)/Math.max(1,scope.surface.height-scope.surface.horizon));
  g.translate(scope.offsets.ground.x*k-scope.current.x,scope.offsets.ground.y*k-scope.current.y);
}
/** Surface distance: almost fixed horizon, progressively stronger near motion. */
export function surfaceMotionFactor(v:number){const u=Math.max(0,Math.min(1,v));return .04+.66*u*u*(3-2*u);}
export function withSurfaceDepth(g:CanvasRenderingContext2D,v:number,draw:()=>void){
  const scope=scopes.get(g);if(!scope){draw();return;}
  const k=surfaceMotionFactor(v),p=scope.offsets.ground;
  g.save();g.translate(p.x*k-scope.current.x,p.y*k-scope.current.y);
  try{draw();}finally{g.restore();}
}

type Entry = { source: HTMLCanvasElement; c: HTMLCanvasElement; w: number; h: number; scale: number; vertical: string; owner?: object };
const cache: Entry[] = [];
let bakes = 0;
/** Only already-baked scenery, never a live scene capture. Bounded LRU and edge extrusion. */
export function drawDepthGround(g: CanvasRenderingContext2D, source: HTMLCanvasElement, w: number, h: number, far = false, vertical: "both" | "bottom" | "none" = far ? "none" : "both", surfaceHorizon?:number) {
  if (!scopes.has(g)) { g.drawImage(source, 0, 0, w, h); return; }
  if(surfaceHorizon!==undefined)scopes.get(g)!.surface={horizon:surfaceHorizon,height:h};
  const tier = scopes.get(g)!.tier;
  const full = tier === "full";
  const matrix = g.getTransform();
  const dpr = Math.min(1.5, Math.hypot(matrix.a, matrix.b));
  const requested = Math.min(source.width / Math.max(1, w), (far ? (full ? 0.5 : 0.25) : (full ? 1 : 0.5)) * dpr);
  // Cap dimensions BEFORE allocation. Even a 4K/ultrawide pair fits without LRU thrashing.
  const mib = tier === "still" ? (far ? .2 : .75) : full ? (far ? 3 : 12) : (far ? .75 : 3);
  const scale = Math.min(requested, Math.sqrt(mib * 1024 * 1024 / (4 * (w + 64) * (h + 64))) * .99);
  // Replace an obsolete quality for this source, rather than retaining both tiers.
  for (let i = cache.length - 1; i >= 0; i--) {
    if (cache[i].source === source && cache[i].scale !== scale) {
      const old = cache.splice(i, 1)[0]; old.c.width = old.c.height = 1;
    }
  }
  const index = cache.findIndex(e => e.source === source && e.w === w && e.h === h && e.scale === scale && e.vertical === vertical);
  let entry = index >= 0 ? cache.splice(index, 1)[0] : undefined;
  if (!entry) {
    const c = document.createElement("canvas"), pad = DEPTH_PAD;
    c.width = Math.ceil((w + pad * 2) * scale); c.height = Math.ceil((h + pad * 2) * scale);
    const cg = c.getContext("2d")!;
    cg.scale(scale, scale); cg.imageSmoothingEnabled = false;
    cg.drawImage(source, pad, pad, w, h);
    if(surfaceHorizon!==undefined){
      const edge=Math.min(source.width,pad*source.width/w);
      cg.save();cg.translate(pad,pad);cg.scale(-1,1);cg.drawImage(source,0,0,edge,source.height,0,0,pad,h);cg.restore();
      cg.save();cg.translate(pad+w,pad);cg.scale(-1,1);cg.drawImage(source,source.width-edge,0,edge,source.height,-pad,0,pad,h);cg.restore();
    }else{
      cg.drawImage(source, 0, 0, 1, source.height, 0, pad, pad, h);
      cg.drawImage(source, source.width - 1, 0, 1, source.height, pad + w, pad, pad, h);
    }
    // F never moves vertically. Extending its final alpha row would turn distant
    // treetops into 32px vertical tails below a short transparent horizon canvas.
    if (vertical !== "none") {
      // Sample original rows, not the already-scaled canvas: fractional 4K caps
      // can put its first painted row just after floor(pad * scale).
      if (vertical === "both") cg.drawImage(source, 0, 0, source.width, 1, 0, 0, w + pad * 2, pad + 1);
      cg.drawImage(source, 0, source.height - 1, source.width, 1, 0, pad + h - 1, w + pad * 2, pad + 1);
    }
    entry = { source, c, w, h, scale, vertical, owner: scopes.get(g)?.owner }; bakes++;
  }
  cache.push(entry);
  const poolBytes = (tier === "still" ? 4 : full ? 54 : 16) * 1024 * 1024;
  while (cache.length > 12 || cache.reduce((n, e) => n + e.c.width * e.c.height * 4, 0) > poolBytes) {
    if (cache.length === 1) break;
    const old = cache.shift()!; old.c.width = old.c.height = 1;
  }
  const draw = () => { g.save(); g.imageSmoothingEnabled = false; g.drawImage(entry!.c, -DEPTH_PAD, -DEPTH_PAD, w + DEPTH_PAD * 2, h + DEPTH_PAD * 2); g.restore(); };
  if(surfaceHorizon!==undefined&&!far){
    const scope=scopes.get(g)!,off=scope.offsets.ground;
    if(off.x===0&&off.y===0){draw();return;}
    const bands=full?64:24,pad=DEPTH_PAD,height=h+pad*2;
    const point=(y:number)=>surfaceMotionFactor((y-surfaceHorizon)/Math.max(1,h-surfaceHorizon));
    // Shared device-aligned boundaries: no overlap, alpha seam or empty row.
    const device=Math.max(.1,Math.hypot(matrix.a,matrix.b));
    const boundary=(y:number)=>Math.round((y+off.y*point(y))*device)/device;
    g.save();g.translate(-scope.current.x,-scope.current.y);g.imageSmoothingEnabled=false;
    for(let i=0;i<bands;i++){
      const y0=-pad+height*i/bands,y1=-pad+height*(i+1)/bands;
      const dy0=boundary(y0),dy1=boundary(y1),k=point((y0+y1)/2);
      g.drawImage(entry!.c,0,(y0+pad)/height*entry!.c.height,entry!.c.width,(y1-y0)/height*entry!.c.height,
        -pad+off.x*k,dy0,w+pad*2,dy1-dy0);
    }
    g.restore();return;
  }
  if (far) withDepthLayer(g, "far", draw); else draw();
}
export function clearDepthCache() { for (const e of cache) e.c.width = e.c.height = 1; cache.length = 0; }
export function retainDepthOwners(owners: object[]) {
  for (let i = cache.length - 1; i >= 0; i--) if (cache[i].owner && !owners.includes(cache[i].owner!)) {
    const old = cache.splice(i, 1)[0]; old.c.width = old.c.height = 1;
  }
}
export function depthCacheStats() { return { bakes, entries: cache.length, bytes: cache.reduce((n, e) => n + e.c.width * e.c.height * 4, 0) }; }

/** P0 procedural foreground only: low edge vegetation/water marks, no standing objects. */
export function bakeDepthFrame(w: number, h: number, biome: string, season: string, seed: number) {
  const c = document.createElement("canvas"); c.width = Math.ceil(w + 64); c.height = 96;
  const g = c.getContext("2d")!;
  const deep = biome === "deep";
  const water = biome === "sea";
  const gravel = ["tidal", "sandy", "rocky", "pond", "valley", "mountain"].includes(biome);
  const pale = season === "winter" && !water;
  g.fillStyle = deep ? "rgba(110,153,172,.12)" : water ? "rgba(120,175,183,.12)" : pale ? "rgba(180,198,214,.24)" : "rgba(86,112,97,.22)";
  for (let i = 0; i < 12; i++) {
    const side = i < 6 ? 0 : w - 110;
    const x = 32 + side + ((i * 29 + seed) % 110);
    const y = 56 + ((i * 17 + seed) % 30);
    if (deep) g.fillRect(x, y, 2, 2); // Suspended matter; never a seabed or surface stripe.
    else if (water) g.fillRect(x, y, 8 + i % 3 * 4, 2);
    else if (gravel) g.fillRect(x, y + 4, 3 + i % 3, 2); // Flat ground marks, no shoreline-crossing grass.
    else { g.fillRect(x, y, 2, 8); g.fillRect(x - 4, y + 3, 2, 5); g.fillRect(x + 4, y + 2, 2, 6); }
  }
  return { c, y: h - 64 };
}
