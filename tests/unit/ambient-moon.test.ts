import {describe,it,expect} from "vitest";
import {moonPhase,moonLit,moonPixelLit} from "../../components/shared/ambient/world/moon";

describe("continuous KST lunar illumination",()=>{
  it("agrees within two percentage points with NASA hourly 2026 illumination",()=>{
    // https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/mooninfo_2026.json
    for(const [d,h,pct] of [[3,19,99.86],[11,1,50.06],[19,5,.09],[26,14,50.23]])
      expect(Math.abs(moonLit(moonPhase(2026,1,d,h))*100-pct)).toBeLessThan(2);
  });
  it("preserves fractional KST hours and continuity across midnight",()=>{
    expect(moonPhase(2026,1,10,24)).toBeCloseTo(moonPhase(2026,1,11,0),12);
    expect(moonPhase(2026,1,10,0)).not.toBe(moonPhase(2026,1,10,12));
    expect(Math.abs(moonPhase(2026,1,10,23.99)-moonPhase(2026,1,11,.01))).toBeLessThan(.001);
  });
  it("keeps a circular full disc, waxing right and waning left",()=>{
    expect(moonPixelLit(.7,.7,.5)).toBe(true);
    expect(moonPixelLit(.8,.8,.5)).toBe(false);
    expect(moonPixelLit(.5,0,.25)).toBe(true);
    expect(moonPixelLit(-.5,0,.25)).toBe(false);
    expect(moonPixelLit(-.5,0,.75)).toBe(true);
    expect(moonPixelLit(.5,0,.75)).toBe(false);
  });
  it("rasterized illuminated area follows a full cycle without eight-step snapping",()=>{
    for(const phase of [.04,.125,.25,.375,.5,.625,.75,.875,.96]){
      let disk=0,lit=0;
      for(let y=0;y<80;y++)for(let x=0;x<80;x++){
        const nx=(x+.5-40)/40,ny=(y+.5-40)/40;
        if(nx*nx+ny*ny<=1){disk++;if(moonPixelLit(nx,ny,phase))lit++;}
      }
      expect(Math.abs(lit/disk-moonLit(phase))).toBeLessThan(.012);
    }
  });
});
