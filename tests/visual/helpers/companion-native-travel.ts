import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

type Rect = { x: number; y: number; width: number; height: number };
export type NativeSupportSurface = { kind:"home"|"viewport"|"ink"|"edge"; rect:Rect; footY:number; visible:boolean; registered?:boolean };
/** A real DOM ink fragment can have pointer-events:none. The DOM observer
 * passes its bounded hit-day descendants too, never a platform-ID guess. */
export function measuredNativeTravelSupport(x:number,y:number,surfaces:readonly NativeSupportSurface[]):NativeSupportSurface|undefined {
  if(![x,y].every(Number.isFinite)) return;
  return surfaces.slice(0,128).find(surface=>surface.visible && [surface.footY,...Object.values(surface.rect)].every(Number.isFinite)
    && (surface.kind!=="ink" || surface.registered === true && Math.abs(surface.footY-(surface.rect.y-3))<.0001)
    && surface.rect.width>0 && surface.rect.height>0 && x>=surface.rect.x-1 && x<=surface.rect.x+surface.rect.width+1 && Math.abs(y-surface.footY)<=3);
}
/** Geometry is observed from public DOM only. `epoch` changes on real scroll,
 * resize or trusted input; `anchor` is one retained source surface's DOM rect.
 * No scene label, model target or authored success callback proves travel. */
export type NativeTravelFrame = {
  at: number; state: string; pose: number; x: number; y: number; platform: string; visible: boolean; decoded: boolean;
  travel: { id: number; epoch: number; enabled: boolean; roam: boolean; jump: boolean; manual: boolean; actorWidth: number; actorHeight: number; anchor: Rect | null; supported: boolean; support: NativeSupportSurface | null; inkRects: Rect[] };
};
export type NativeTravelWitness = { id: number; kind: "walk" | "jump"; startedAt: number; endedAt: number; movingAt: number[]; distance: number; poses: number };

/** A meaningful ordinary trip requires changing actual motion pixels, >=8px
 * real displacement, then two observed stable frames on an actual DOM edge.
 * An unfinished jump, CSS follower, held actor or one moving sample is not a
 * completed trip. Count its original moving timestamps only AFTER this proof. */
export function completedNativeTravel(frames: readonly NativeTravelFrame[]): NativeTravelWitness[] {
  const result: NativeTravelWitness[] = [];
  type Candidate = { kind: "walk" | "jump"; first: NativeTravelFrame; moving: NativeTravelFrame[]; end?: NativeTravelFrame; stable: number; poses: Set<number>; flight: boolean; landing: boolean };
  let candidate: Candidate | undefined, previous: NativeTravelFrame | undefined;
  const rejected = new Set<number>();
  const moving = (frame: NativeTravelFrame) => frame.state === "walk" || frame.state === "jump";
  const row = (frame: NativeTravelFrame, rows: number[]) => rows.some(index => companionSpriteMetadata.rows[index].includes(frame.pose));
  const valid = (frame: NativeTravelFrame) => frame.visible && frame.decoded && frame.travel.enabled && frame.travel.roam && !frame.travel.manual
    && [frame.at,frame.x,frame.y,frame.travel.id,frame.travel.epoch,frame.travel.actorWidth,frame.travel.actorHeight].every(Number.isFinite)
    && frame.travel.actorWidth > 0 && frame.travel.actorHeight > 0 && Boolean(frame.travel.anchor
      && Object.values(frame.travel.anchor).every(Number.isFinite) && frame.travel.anchor.width > 0 && frame.travel.anchor.height > 0);
  const sameWorld = (a: NativeTravelFrame, b: NativeTravelFrame) => a.travel.id === b.travel.id && a.travel.epoch === b.travel.epoch
    && Math.abs(a.travel.actorWidth-b.travel.actorWidth) < 1 && Math.abs(a.travel.actorHeight-b.travel.actorHeight) < 1
    && a.travel.anchor && b.travel.anchor && (Object.keys(a.travel.anchor) as (keyof Rect)[]).every(key => Math.abs(a.travel.anchor![key]-b.travel.anchor![key]) < 1);
  for (const frame of frames) {
    if (previous && (!Number.isFinite(frame.at) || frame.at <= previous.at)) return [];
    if (!valid(frame) || previous && frame.at-previous.at > 160 || candidate && !sameWorld(candidate.first,frame)) {
      if (candidate) rejected.add(candidate.first.travel.id);
      candidate = undefined;
    }
    if (valid(frame)) {
      if (!candidate && !rejected.has(frame.travel.id) && moving(frame) && (!previous || !moving(previous) || previous.travel.id !== frame.travel.id)) {
        candidate = { kind: frame.state as "walk"|"jump", first: frame, moving: [], stable: 0, poses: new Set(), flight: false, landing: false };
      }
      if (candidate) {
        if (frame.at-candidate.first.at > 12000) candidate = undefined;
        else if (moving(frame)) {
          if (frame.state !== candidate.kind || frame.state === "jump" && !frame.travel.jump) { rejected.add(frame.travel.id); candidate = undefined; }
          // A cold first texture may hold one earlier pose. It earns no
          // motion proof, and cannot interrupt an already painted stride.
          else if (!row(frame,frame.state === "walk" ? [2,20] : [3,4,5,6])) {
            if (candidate.moving.length) { rejected.add(frame.travel.id); candidate = undefined; }
          }
          else {
            candidate.moving.push(frame); candidate.poses.add(frame.pose); candidate.stable = 0; candidate.end = undefined;
            candidate.flight ||= frame.state === "jump" && row(frame,[4,5]); candidate.landing ||= candidate.flight && frame.state === "jump" && row(frame,[6]);
          }
        } else if (!frame.travel.supported || !frame.travel.support || !measuredNativeTravelSupport(frame.x,frame.y,[frame.travel.support]) || !frame.platform || candidate.end && (frame.platform !== candidate.end.platform || Math.hypot(frame.x-candidate.end.x,frame.y-candidate.end.y) > 1)) candidate = undefined;
        else {
          candidate.end ??= frame; candidate.stable++;
          // A cold initial texture can hold an unrelated pose. Only the
          // registered motion samples establish displacement, time and start.
          const first = candidate.moving[0], last = candidate.moving.at(-1);
          const distance = first ? Math.hypot(frame.x-first.x,frame.y-first.y) : 0;
          const paintedDistance = first && last ? Math.hypot(last.x-first.x,last.y-first.y) : 0;
          if (candidate.stable >= 2) {
            if (first && last && candidate.moving.length >= 3 && last.at-first.at >= 100 && candidate.poses.size >= 2 && distance >= 8 && paintedDistance >= 8
              && (candidate.kind === "walk" ? Math.abs(frame.y-first.y) < 2 : candidate.flight && candidate.landing)) {
              result.push({ id:first.travel.id,kind: candidate.kind, startedAt: first.at, endedAt: frame.at, movingAt: candidate.moving.map(value => value.at), distance, poses: candidate.poses.size });
            }
            candidate = undefined;
          }
        }
      }
    }
    previous = frame;
  }
  return result;
}

/** A bounded look-ahead may establish arrival of the SAME trip crossing a
 * fixed observation end. Later motion/new trips never become earlier proof. */
export function nativeTravelPointsBefore(witnesses: readonly NativeTravelWitness[], cutoff: number): Set<number> {
  return new Set(witnesses.flatMap(witness=>witness.movingAt.filter(at=>at<=cutoff)));
}
