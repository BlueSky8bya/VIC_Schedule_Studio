import { describe, expect, it } from "vitest";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { completedNativeTravel, nativeTravelPointsBefore, measuredNativeTravelSupport, type NativeTravelFrame } from "../visual/helpers/companion-native-travel";

function journey(kind: "walk" | "jump" = "walk"): NativeTravelFrame[] {
  return Array.from({ length: 15 }, (_,index) => {
    const moving = index > 0 && index < 12, portion = Math.min(1,Math.max(0,(index-1)/10));
    const row = !moving ? 1 : kind === "walk" ? 2 : index < 3 ? 3 : index < 10 ? 4 : 6;
    const poses = companionSpriteMetadata.rows[row];
    return { at:index*50, state:moving ? kind : "look", pose:poses[index%poses.length], x:kind === "walk" ? 100+portion*48 : 100,
      y:kind === "walk" ? 550 : 550-portion*38-Math.sin(portion*Math.PI)*70, platform:kind === "jump" && portion === 1 ? "companion-home" : "companion-home-floor",
      visible:true, decoded:true, travel:{id:1,epoch:0,enabled:true,roam:true,jump:true,manual:false,actorWidth:92,actorHeight:92,anchor:{x:0,y:100,width:320,height:480},supported:!moving,support:!moving?{kind:"home",rect:{x:0,y:400,width:320,height:200},footY:kind === "walk"?550:512,visible:true}:null,inkRects:[]} };
  });
}

describe("142 native progress observes completed physical travel rather than scene labels", () => {
  it("counts a decoded48px ordinary walk and its original movement timestamps after stable measured arrival", () => {
    expect(completedNativeTravel(journey())).toMatchObject([{ kind:"walk",startedAt:50,endedAt:650,distance:48 }]);
    expect(completedNativeTravel(journey())[0].movingAt).toHaveLength(11);
  });
  it("counts a real vertical sofa/floor jump even without horizontal displacement or an authored scene", () => {
    expect(completedNativeTravel(journey("jump"))).toMatchObject([{ kind:"jump",distance:38 }]);
  });
  it.each(["hidden","undecoded","held","placing","OFF","roam-OFF","jump-OFF","scroll","resize","trusted-input","layout-follower","scaled-layout","one-sample","zero-motion","frozen-pose","wrong-row","abandoned","unmeasured-arrival","missing-support-witness","false-support-witness","moving-arrival","wrong-support","short","gap","bad-time"] as const)("rejects %s without relaxing the10second native requirement", defect => {
    let frames = journey(defect === "jump-OFF" || defect === "abandoned" ? "jump" : "walk");
    if (defect === "hidden") frames[6].visible=false;
    if (defect === "undecoded") frames[6].decoded=false;
    if (defect === "held" || defect === "placing") for (const frame of frames) frame.travel.manual=true;
    if (defect === "OFF") for (const frame of frames) frame.travel.enabled=false;
    if (defect === "roam-OFF") for (const frame of frames) frame.travel.roam=false;
    if (defect === "jump-OFF") for (const frame of frames) frame.travel.jump=false;
    if (["scroll","resize","trusted-input"].includes(defect)) for (const frame of frames.slice(6)) frame.travel.epoch++;
    if (defect === "layout-follower") for (const frame of frames) frame.travel.anchor!.x=frame.x-100;
    if (defect === "scaled-layout") for (const frame of frames.slice(6)) frame.travel.anchor!.width+=10;
    if (defect === "one-sample") frames=frames.filter((_,index)=>index===0||index===6||index>11);
    if (defect === "zero-motion") for (const frame of frames) frame.x=100;
    if (defect === "frozen-pose") for (const frame of frames) frame.pose=companionSpriteMetadata.rows[2][0];
    if (defect === "wrong-row") for (const frame of frames) frame.pose=companionSpriteMetadata.rows[16][0];
    if (defect === "abandoned") frames=frames.slice(0,10);
    if (defect === "unmeasured-arrival") for (const frame of frames) frame.travel.supported=false;
    if (defect === "missing-support-witness") for (const frame of frames) frame.travel.support=null;
    if (defect === "false-support-witness") for (const frame of frames) if(frame.travel.support) frame.travel.support.footY+=30;
    if (defect === "moving-arrival") frames[13].x+=4;
    if (defect === "wrong-support") frames[13].platform="another-floor";
    if (defect === "short") for (const frame of frames) frame.at/=10;
    if (defect === "gap") frames=frames.filter((_,index)=>index<4||index>9);
    if (defect === "bad-time") frames[7].at=NaN;
    expect(completedNativeTravel(frames)).toEqual([]);
  });
  it("does not rescue a hidden or scrolled incomplete run with later correct frames from that same run", () => {
    const frames=journey();frames[4].visible=false;
    expect(completedNativeTravel(frames)).toEqual([]);
  });
  it("accepts a later independent completed trip after a genuinely rejected run", () => {
    const first=journey();first[4].decoded=false;
    const later=journey().map(frame=>({...frame,at:frame.at+1000,travel:{...frame.travel,id:2}}));
    expect(completedNativeTravel([...first,...later])).toHaveLength(1);
  });
  it("may use bounded later arrival to prove only the original window's already painted movement", () => {
    const frames=journey(),cutoff=400;
    expect(completedNativeTravel(frames.filter(frame=>frame.at<=cutoff))).toEqual([]);
    const proof=completedNativeTravel(frames),points=nativeTravelPointsBefore(proof,cutoff);
    expect([...points]).toEqual([50,100,150,200,250,300,350,400]);
    expect(proof[0].endedAt).toBeGreaterThan(cutoff);
  });
  it("never borrows a new journey begun after the original observation end", () => {
    const proof=completedNativeTravel(journey().map(frame=>({...frame,at:frame.at+1000})));
    expect([...nativeTravelPointsBefore(proof,400)]).toEqual([]);
  });
});


describe("142 measured ink support includes bounded public hit-day descendants",()=>{
 const rect={x:390,y:594,width:20,height:17};
 it("recognizes actual date Range ink despite a pointer-events-none glyph being absent from elementsFromPoint",()=>{
  expect(measuredNativeTravelSupport(405,591,[{kind:"ink",rect,footY:rect.y-3,visible:true,registered:true}])).toMatchObject({kind:"ink",rect});
 });
 it.each(["missing","hidden","wrong-x","wrong-y","nonfinite","empty","wrong-ink-origin","unregistered"] as const)("rejects %s instead of trusting a day/platform label",defect=>{
  const point={x:405,y:591},surface={kind:"ink" as const,rect:{...rect},footY:591,visible:true,registered:true};
  if(defect==='hidden')surface.visible=false;if(defect==='wrong-x')point.x=440;if(defect==='wrong-y')point.y=620;if(defect==='nonfinite')surface.footY=NaN;if(defect==='empty')surface.rect.width=0;if(defect==='wrong-ink-origin')surface.rect.y=100;if(defect==='unregistered')surface.registered=false;
  expect(measuredNativeTravelSupport(point.x,point.y,defect==='missing'?[]:[surface])).toBeUndefined();
 });
 it("an actual ink rectangle never turns an unmoving actor or CSS follower into completed travel",()=>{
  const stationary=journey();for(const frame of stationary)frame.x=100;
  expect(completedNativeTravel(stationary)).toEqual([]);
  const followed=journey();for(const frame of followed)frame.travel.anchor!.x=frame.x-100;
  expect(completedNativeTravel(followed)).toEqual([]);
 });
});
