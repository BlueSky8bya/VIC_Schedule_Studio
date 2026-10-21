import {beforeEach, describe, expect, it, vi} from "vitest";
const state = vi.hoisted(() => ({role:"developer",scope:"public",unlock:false,rpcError:false,noUpdated:false,writes:[] as string[],predicates:[] as unknown[][]}));
vi.mock("@/lib/auth/actor",()=>({resolveCurrentActor:async()=>({role:state.role})}));
vi.mock("@/lib/private-layer/unlock",()=>({getUnlockState:async()=>({hasUnlockSession:state.unlock})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/schedules/cache",()=>({revalidatePublicSchedule:vi.fn()}));
vi.mock("@/lib/activity/record",()=>({recordActivity:vi.fn()}));
vi.mock("@/lib/schedules/event-validation",()=>({validateDateKey:()=>({ok:true}),validateSupportUrl:()=>({ok:true}),validateTagAssignment:async()=>({ok:true})}));
function fakeClient(origin:string) {
  return {from:(table:string)=>{
    const query:Record<string,unknown>={};
    for(const key of ["select","eq","is"]) query[key]=(...args:unknown[])=>{state.predicates.push([origin,table,key,...args]);return query;};
    for(const key of ["update","delete","insert"]) query[key]=()=>{state.writes.push(origin+":"+table+":"+key);return query;};
    const result=()=>Promise.resolve({data:origin==="server"&&state.noUpdated?null:table==="calendars"?{id:"cal"}:{id:"event",calendar_id:"cal",visibility_scope:state.scope,is_support:true},error:null});
    query.maybeSingle=result;
    query.then=(resolve:(v:unknown)=>unknown)=>result().then(resolve);
    return query;
  },rpc:async(name:string)=>{state.writes.push(origin+":"+name);return {data:state.rpcError?null:"event",error:state.rpcError?{message:"fixture insert failure"}:null};}};
}
vi.mock("@/lib/auth/admin",()=>({createSupabaseAdminClient:()=>fakeClient("admin")}));
vi.mock("@/lib/auth/server",()=>({createSupabaseServerClient:async()=>fakeClient("server")}));
const {updateEventTagsAction,updateSupportSettingsAction}=await import("@/lib/schedules/event-actions");
const operations={tags:()=>updateEventTagsAction("event",[],[]),support:()=>updateSupportSettingsAction("event",{endDateKey:"2025-10-22"})};
beforeEach(()=>{Object.assign(state,{role:"developer",scope:"public",unlock:false,rpcError:false,noUpdated:false,writes:[],predicates:[]});});
describe.each(Object.entries(operations))("%s secondary write",(_name,run)=>{
  it.each(["owner_private","embargo","work","unknown"])("rejects locked/developer %s before any write",async(scope)=>{
    state.scope=scope;expect((await run()).ok).toBe(false);expect(state.writes).toEqual([]);
  });
  it("does not let an unlocked developer modify owner-only content",async()=>{
    state.scope="owner_private";state.unlock=true;expect((await run()).ok).toBe(false);expect(state.writes).toEqual([]);
  });
  it("requires owner private unlock too",async()=>{
    state.role="owner";state.scope="owner_private";expect((await run()).ok).toBe(false);expect(state.writes).toEqual([]);
  });
  it.each(["owner","developer"])("keeps %s public editing",async(role)=>{
    state.role=role;expect((await run()).ok).toBe(true);expect(state.writes.length).toBe(1);expect(state.writes[0]).toMatch(/^server:/);
  });
  it("permits unlocked owner private and unlocked developer work",async()=>{
    state.role="owner";state.scope="owner_private";state.unlock=true;expect((await run()).ok).toBe(true);
    state.role="developer";state.scope="work";expect((await run()).ok).toBe(true);
  });
  it("rejects viewer before any write",async()=>{state.role="viewer";expect((await run()).ok).toBe(false);expect(state.writes).toEqual([]);});
});
it("tag failure stays a single transaction, without destructive delete fallback",async()=>{
  state.rpcError=true;expect((await operations.tags()).ok).toBe(false);expect(state.writes).toEqual(["server:replace_event_tags_atomic"]);
});
it("support binds its original scope/type and rejects a zero-row raced/deleted write",async()=>{
  state.noUpdated=true;expect((await operations.support()).ok).toBe(false);
  for(const predicate of [["eq","visibility_scope","public"],["eq","calendar_id","cal"],["eq","is_support",true],["is","deleted_at",null]])
    expect(state.predicates).toContainEqual(["server","events",...predicate]);
  expect(state.writes).toEqual(["server:events:update"]);
});
