import { describe,expect,it } from "vitest";
import { companionFloorPlacementSamplePasses157 as passes, type CompanionFloorPlacementSample157 } from "../visual/helpers/companion-floor-placement-157";
const sample=(overrides: Partial<CompanionFloorPlacementSample157>={}): CompanionFloorPlacementSample157 => ({
  at:6629.5,sameActor:true,placingReleased:true,platform:"companion-home-floor",floorPlatform:true,state:"idle",notJump:true,
  feet:583.8590087890625,floorFeet:583.8590087890625,feetError:0,...overrides,
});
describe("157 atomic actual floor placement",()=>{
  it("admits the original158ms real floor stop but rejects the later ordinary sofa idle",()=>{
    expect(passes(sample())).toBe(true);
    expect(passes(sample({at:8107.2,platform:"companion-home",floorPlatform:false,feet:545.34375,feetError:38.5152587890625}))).toBe(false);
  });
  it("a35ms sampling interval can observe the real short settled window without stopping autonomy",()=>{
    const frames=Array.from({length:80},(_,i)=>5600+i*35).map(at=>sample(at>=6629.5&&at<=6787.7?{at}:{at,state:"jump",notJump:false}));
    expect(frames.some(passes)).toBe(true);
  });
  it.each([{sameActor:false},{placingReleased:false},{floorPlatform:false},{notJump:false},
    {platform:"companion-home"},{state:"jump"},{feet:NaN},{floorFeet:NaN},{at:Infinity},
    {feet:585.8590087890625,feetError:2},{feet:580,feetError:0},
  ])("preserves every original independent condition in the same frame %j",invalid=>expect(passes(sample(invalid))).toBe(false));
  it("does not borrow a completed jump from a different frame",()=>{
    const airborne=sample({state:"jump",notJump:false});
    const sofa=sample({platform:"companion-home",floorPlatform:false,feet:545.34375,feetError:38.5152587890625});
    expect([airborne,sofa].some(passes)).toBe(false);
  });
});
