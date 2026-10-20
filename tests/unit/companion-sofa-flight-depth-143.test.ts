import { describe,it,expect } from "vitest";
import { companionSofaDepth } from "@/lib/ui/viewer-companion/sofa";
const bed={left:0,right:180,top:0,bottom:100};
const body=[{x:70,y:15},{x:110,y:15},{x:110,y:75},{x:70,y:75}];
describe("143 jump depth follows the ground path",()=>{
  it("keeps a front jump in front while its feet rise above the seat",()=>{
    expect(companionSofaDepth({point:{x:90,y:40},body,bed,seatY:50,previous:"seat",groundY:80})).toBe("front");
  });
  it("keeps a genuine seat-side passage behind the front cloth",()=>{
    expect(companionSofaDepth({point:{x:90,y:20},body,bed,seatY:50,groundY:50})).toBe("seat");
  });
  it("clears the cloth when the complete opaque body clears the side tips",()=>{
    expect(companionSofaDepth({point:{x:90,y:10},body:body.map(p=>({...p,y:p.y-60})),bed,seatY:50,groundY:80})).toBe("clear");
  });
  it("retains real sidewall and ordinary held-body classification",()=>{
    expect(companionSofaDepth({point:{x:90,y:40},body:body.map(p=>({...p,x:p.x-60})),bed,seatY:50,groundY:50})).toBe("front");
    expect(companionSofaDepth({point:{x:90,y:40},body,bed,seatY:50})).toBe("seat");
  });
});
