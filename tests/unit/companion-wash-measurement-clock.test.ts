import {expect,it} from "vitest";
import {measuredWashGeometryDeliveries} from "../visual/helpers/wash-geometry-observation";
const pad={x:100,y:200,width:80,height:40};
it("binds the first actual geometry delivery rather than an earlier nominal rAF or later API receipt",()=>{
  const frames=[{absolute:990,measuredAt:995,measuredUntil:996,pad},{absolute:999.2,measuredAt:1010,measuredUntil:1011,pad:{...pad,x:110}},{absolute:1030,measuredAt:1040,measuredUntil:1041,pad:{...pad,x:112}}];
  expect(measuredWashGeometryDeliveries(frames,[{began:1000,ended:1020}])).toEqual([1010]);
  // The second geometry change does not keep restarting the100ms allowance.
  const delivery=measuredWashGeometryDeliveries(frames,[{began:1000,ended:1020}])[0];
  expect(1111>delivery+100).toBe(true);
});
it("uses the existing end timestamp when layout did not change and rejects old unmeasured raw",()=>{
  expect(measuredWashGeometryDeliveries([{measuredAt:1000,measuredUntil:1001,pad}],[{began:1000,ended:1020}])).toEqual([1020]);
  expect(()=>measuredWashGeometryDeliveries([{pad} as never],[{began:1000,ended:1020}])).toThrow("measurement clock");
});
