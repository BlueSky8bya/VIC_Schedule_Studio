type Rect = {x:number;y:number;width:number;height:number};
type MeasuredFrame = {measuredAt:number;measuredUntil:number;pad:Rect|null};
export type WashGeometryOperation = {began:number;ended:number};

/** First actual delivery for each native operation. rAF's scheduled timestamp
 * is not the time its callback read layout; never reinterpret old raw as new. */
export function measuredWashGeometryDeliveries(frames: readonly MeasuredFrame[], operations: readonly WashGeometryOperation[]) {
  if(frames.some(frame=>!Number.isFinite(frame.measuredAt)||!Number.isFinite(frame.measuredUntil)||frame.measuredUntil<frame.measuredAt)) throw Error("Actual geometry measurement clock is required");
  if(operations.some(op=>!Number.isFinite(op.began)||!Number.isFinite(op.ended)||op.ended<op.began)) throw Error("Actual operation clock is required");
  const changes=frames.filter((frame,index)=>{
    const previous=frames[index-1]?.pad;
    return frame.pad&&previous&&(["x","y","width","height"] as const).some(key=>Math.abs(frame.pad![key]-previous[key])>.1);
  });
  return operations.map(op=>changes.find(frame=>frame.measuredUntil>=op.began&&frame.measuredAt<=op.ended+100)?.measuredAt??op.ended);
}
