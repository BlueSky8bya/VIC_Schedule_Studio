import { describe, expect, it } from "vitest";
import { companionFaceBackground } from "@/lib/ui/viewer-companion/face-plate";

describe("boundary-matched face background",()=>{
  it("removes dark ink and its white glint while preserving the underlying skin gradient and alpha",()=>{
    const size=32,source=new Uint8ClampedArray(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)source.set([230+x/2,210+y/2,170+(x+y)/4,253],(y*size+x)*4);
    const original=source.slice();
    for(let y=12;y<=18;y++)for(let x=12;x<=18;x++)source.set([70,45,25,253],(y*size+x)*4);
    source.set([255,255,245,253],(15*size+15)*4);
    const result=companionFaceBackground(source,size,[8,8,23,23],[240,220,180]);
    for(let y=8;y<=23;y++)for(let x=8;x<=23;x++){
      const at=((y-8)*16+x-8)*4,old=(y*size+x)*4;
      for(let c=0;c<3;c++)expect(Math.abs(result[at+c]-original[old+c])).toBeLessThanOrEqual(2); // Quantized perimeter samples can add two RGB levels.
      expect(result[at+3]).toBe(253);
    }
  });
  it("keeps clean boundary pixels exact instead of introducing a rectangular colour seam",()=>{
    const size=20,source=new Uint8ClampedArray(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)source.set([237+x%3,222+y%4,190,253],(y*size+x)*4);
    const before=source.slice(),result=companionFaceBackground(source,size,[4,4,15,15],[241,226,194]);
    for(let y=4;y<=15;y++)for(let x=4;x<=15;x++)if(x===4||x===15||y===4||y===15)expect([...result.slice(((y-4)*12+x-4)*4,((y-4)*12+x-4)*4+4)]).toEqual([...source.slice((y*size+x)*4,(y*size+x)*4+4)]);
    expect(source).toEqual(before);
  });
});
