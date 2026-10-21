import {expect,it} from "vitest";
import {companionExpressionFoodId} from "@/lib/ui/viewer-companion/expression-food-context";
import type {PersonalitySceneBeat} from "@/lib/ui/viewer-companion/personality-director";

const meta={id:"G01",serial:4,beat:1,command:{kind:"food",mode:"inspect"}} as PersonalitySceneBeat;
it("uses the actual first bound item rather than the proposal or first world food",()=>{
  const action={kind:"sniff" as const,personalityScene:meta};
  const foods=[{id:"B",kind:"lemon"},{id:"A",kind:"apple"}];
  const selected=companionExpressionFoodId(action,"sniff",{itemId:"A"},()=>true);
  expect(foods.find(f=>f.id===selected)?.kind).toBe("apple");
  expect(foods.filter(f=>f.id!=="A").find(f=>f.id===selected)).toBeUndefined();
  expect(action).not.toHaveProperty("foodId");
});
it("keeps explicit food targets and rejects unowned, travel, other commands and other statuses",()=>{
  expect(companionExpressionFoodId({kind:"eat",foodId:"meal"},"eat",{itemId:"A"},()=>false)).toBe("meal");
  expect(companionExpressionFoodId({kind:"sniff",personalityScene:meta},"sniff",{itemId:"A"},()=>false)).toBeUndefined();
  for(const command of [{kind:"food",mode:"compare"},{kind:"toy",mode:"inspect"}] as const)
    expect(companionExpressionFoodId({kind:"sniff",personalityScene:{...meta,command}},"sniff",{itemId:"A"},()=>true)).toBeUndefined();
  expect(companionExpressionFoodId({kind:"sniff",personalityScene:{...meta,travel:true}},"sniff",{itemId:"A"},()=>true)).toBeUndefined();
  expect(companionExpressionFoodId({kind:"sniff",personalityScene:meta},"walk",{itemId:"A"},()=>true)).toBeUndefined();
  expect(companionExpressionFoodId({kind:"sniff"},"sniff",{itemId:"A"},()=>true)).toBeUndefined();
});
