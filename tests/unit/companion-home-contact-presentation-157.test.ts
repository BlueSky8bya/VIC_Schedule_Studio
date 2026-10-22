import { describe, expect, it } from "vitest";
import { advanceCompanionHomeContactPresentation as advance, companionLampPresentationReady as ready,
  observeCompanionLampPresentation as observe, COMPANION_HOME_CONTACT_RECEIPT_MS,
  type CompanionLampPaintSample, type CompanionLampPresentation } from "@/lib/ui/viewer-companion/home-contact-presentation";
import { sampleCompanionHomeReach } from "@/lib/ui/viewer-companion/home-interaction";

const frame = (at: number, overrides: Partial<CompanionLampPaintSample> = {}): CompanionLampPaintSample => ({
  at, serial: 7, active: true, bodyTouch: false, visible: true, sourceMatches: true, samePlane: true,
  requestedPull: 0, height: 100, width: 50, cssWidth: 50, buttonHeight: 104, feedbackVisible: false, feedbackOpacity: 0, ...overrides,
});
const tug = (at: number, overrides: Partial<CompanionLampPaintSample> = {}) => frame(at, {
  bodyTouch: true, requestedPull: 3, height: 102, feedbackVisible: true, feedbackOpacity: 1, ...overrides,
});
function neutral() { return observe(observe(undefined,frame(0)),frame(50)); }
function receipt() { return observe(neutral(),tug(100)); }

describe("157 calibrated contact presentation", () => {
  it("holds a cold lamp at phase zero until two actual neutral paints, within the original deadline", () => {
    let began=0;let state:CompanionLampPresentation|undefined;
    for(const now of [50,100,150,200]) {
      const prepared=state?.serial===7&&Boolean(state.baseline);
      const step=advance({now,began,startedAt:0,delta:50,duration:900,active:true,prepared});began=step.began;
      expect(now-began).toBe(0);
      state=observe(state,frame(now,{active:now>=150}));
    }
    expect(state?.baseline).toBeTruthy();
    const start=advance({now:250,began,startedAt:0,delta:50,duration:900,active:true,prepared:true});
    expect(250-start.began).toBe(50);
    expect(observe(state,tug(300)).receiptAt).toBe(300);
    const blocked=advance({now:3401,began:3350,startedAt:0,delta:51,duration:900,active:true,prepared:false});
    expect(blocked.expired).toBe(true);
    expect(advance({now:250,began,startedAt:0,delta:50,duration:900,active:false,prepared:false}).cancelled).toBe(true);
  });
  it("keeps normal foreground frames and the original finite duration unchanged", () => {
    let began = 0;
    for (let now=50;now<=900;now+=50) {
      const result = advance({ now,began,startedAt:0,delta:50,duration:900,active:true });
      expect(result).toEqual({ began:0,expired:false,cancelled:false }); began=result.began;
    }
    expect(900-began).toBe(900);
  });
  it("does not borrow a delayed preceding tick when a new contact launches now", () => {
    expect(advance({ now:1000,began:1000,startedAt:1000,delta:900,duration:900,active:true }).began).toBe(1000);
  });
  it("gives a533ms gap a real first-touch frame, then a later actual paint before effect", () => {
    let began=0,previous=0,state: CompanionLampPresentation|undefined;
    for (const now of [0,50,100,150,200,250,783]) {
      const next=advance({now,began,startedAt:0,delta:now-previous,duration:900,active:true});began=next.began;previous=now;
      const progress=(now-began)/900;
      const touch=sampleCompanionHomeReach({hand:{x:0,y:500},contact:{x:0,y:430},footY:600,ceiling:300,size:80,progress,jump:true})!.touching;
      state=observe(state,frame(now,{bodyTouch:touch,requestedPull:touch?3:0}));
    }
    expect((783-began)/900).toBeGreaterThanOrEqual(.32);
    expect((783-began)/900).toBeLessThan(.5);
    expect(state?.receiptAt).toBeUndefined(); // A requested but unpainted tug is insufficient.
    const next=advance({now:833,began,startedAt:0,delta:50,duration:900,active:true});began=next.began;
    state=observe(state,tug(833,{height:101.4,feedbackOpacity:.5}));
    expect(ready(state,7,833,true)).toBe(false); // Same rendering call cannot ACK itself.
    expect(ready(state,7,883,true)).toBe(true);
    expect((933-began)/900).toBeGreaterThanOrEqual(.5);
    for (let now=883;now<=1400;now+=50) began=advance({now,began,startedAt:0,delta:50,duration:900,active:true}).began;
    expect(1400-began).toBeGreaterThanOrEqual(900);
  });
  it("fails closed on a long suspended action without manufacturing completion or receipt", () => {
    const result=advance({now:3401,began:0,startedAt:0,delta:3401,duration:900,active:true});
    expect(result.expired).toBe(true);expect(result.began).toBe(0);
    expect(ready(undefined,7,3401,true)).toBe(false);
  });
  it("bounds repeated jank by the unchanged action duration plus2500ms wall overrun", () => {
    let began=0;let result;
    for(let now=500;now<=3500;now+=500){result=advance({now,began,startedAt:0,delta:500,duration:900,active:true});began=result.began;}
    expect(result?.expired).toBe(true);
  });
  it("cancels inactive or manually owned work without spending or acknowledging it", () => {
    expect(advance({now:100,began:0,startedAt:0,delta:100,duration:900,active:false})).toEqual({began:0,expired:false,cancelled:true});
    const cancelled=observe(receipt(),tug(150,{active:false}));expect(ready(cancelled,7,200,true)).toBe(false);
  });
  it.each([NaN,Infinity,-1])("rejects invalid delta %s", delta => {
    expect(advance({now:100,began:0,startedAt:0,delta,duration:900,active:true}).expired).toBe(true);
  });
});

describe("157 actual prior lamp paint receipt", () => {
  it.each([-1,.5,1,1.5,2,3])("never prepares or acknowledges from pointer hover or an unregistered rest pull%s", requestedPull => {
    const state=observe(observe(undefined,frame(0,{requestedPull})),frame(50,{requestedPull}));
    expect(state.baseline).toBeUndefined();expect(state.receiptAt).toBeUndefined();
  });
  it("requires a stable neutral pair and a decoded-body touch with an actual visible tug", () => {
    expect(observe(observe(undefined,frame(0)),tug(100)).receiptAt).toBeUndefined();
    const actual=receipt();expect(actual.receiptAt).toBe(100);
    expect(ready(actual,7,100,true)).toBe(false);expect(ready(actual,7,101,true)).toBe(true);
  });
  it("keeps the650ms contact window instead of renewing it by a request label", () => {
    const actual=receipt();expect(COMPANION_HOME_CONTACT_RECEIPT_MS).toBe(650);
    expect(ready(actual,7,750,true)).toBe(true);expect(ready(actual,7,750.001,true)).toBe(false);
    const request=observe(actual,tug(700,{height:100,feedbackVisible:false,feedbackOpacity:0}));
    expect(request.receiptAt).toBe(100);expect(ready(request,7,751,true)).toBe(false);
  });
  it("never lends a receipt or baseline to a new owner", () => {
    const next=observe(receipt(),tug(150,{serial:8}));expect(next.receiptAt).toBeUndefined();expect(ready(receipt(),8,151,true)).toBe(false);
  });
  it.each([
    {active:false},{visible:false},{sourceMatches:false},{samePlane:false},
    {bodyTouch:false},{requestedPull:1.5},{height:100.99},{height:103.26},
    {feedbackVisible:false},{feedbackOpacity:.05},{width:0},{cssWidth:NaN},
    {cssWidth:51},{buttonHeight:106},
  ])("does not certify missing or mismatched actual paint %j", invalid => {
    const state=observe(neutral(),tug(100,invalid));expect(state.receiptAt).toBeUndefined();expect(ready(state,7,150,true)).toBe(false);
  });
  it("discards hidden/invalid geometry rather than retaining a previously good receipt", () => {
    const state=observe(receipt(),tug(150,{visible:false}));expect(state.receiptAt).toBeUndefined();
    const resized=observe(receipt(),frame(150,{cssWidth:51}));expect(resized.receiptAt).toBeUndefined();
  });
  it("rejects reversed paint time and a stale neutral pair", () => {
    expect(observe(receipt(),tug(99)).receiptAt).toBeUndefined();
    const late=observe(observe(undefined,frame(0)),frame(251));expect(observe(late,tug(300)).receiptAt).toBeUndefined();
  });
});
