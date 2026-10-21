import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";

it("tag SQL rolls back partial insertion, isolates event fields and enforces caller scope",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;
      create table events(id uuid primary key,calendar_id uuid,visibility_scope text,deleted_at timestamptz,public_title text);
      create table broadcast_tags(id uuid primary key,calendar_id uuid,is_active boolean);
      create table event_tags(event_id uuid references events,tag_id uuid references broadcast_tags,is_primary boolean,sort_order int,unique(event_id,tag_id));
      create table event_private_meta(event_id uuid references events);
      create function is_calendar_admin(uuid) returns boolean language sql as $$select current_setting('test.role') in ('owner','developer')$$;
      create function is_calendar_owner(uuid) returns boolean language sql as $$select current_setting('test.role')='owner'$$;
      create function has_private_unlock(uuid) returns boolean language sql as $$select current_setting('test.unlock')='yes'$$;
      alter table events enable row level security;
      create policy "owners can manage events" on events for all using(true) with check(true);
      create policy "owners can manage private meta" on event_private_meta for all using(true) with check(true);
      grant select,update on events to authenticated;
      insert into events values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','public',null,'keep title');
      insert into broadcast_tags values('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',true),('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002',true);
      insert into event_tags values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',true,0);
      set test.role='developer';set test.unlock='no';`);
    await db.exec(readFileSync("db/migrations/0153_event_tags_atomic.sql","utf8"));
    // Reapply is idempotent. No provider connection or actual auth/RLS claim.
    await db.exec(readFileSync("db/migrations/0153_event_tags_atomic.sql","utf8"));
    const call=(tags:unknown)=>db.query("select replace_event_tags_atomic('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',$1::jsonb)",[JSON.stringify(tags)]);
    const rows=async()=> (await db.query<{tag_id:string}>("select tag_id from event_tags order by sort_order")).rows.map(r=>r.tag_id);
    await db.exec("alter table event_tags add constraint fail_second check(tag_id<>'00000000-0000-0000-0000-000000000004')");
    await expect(call([{tag_id:"00000000-0000-0000-0000-000000000003"},{tag_id:"00000000-0000-0000-0000-000000000004"}])).rejects.toThrow();
    expect(await rows()).toEqual(["00000000-0000-0000-0000-000000000003"]);
    await db.exec("alter table event_tags drop constraint fail_second; update events set visibility_scope='owner_private'");
    await expect(call([])).rejects.toThrow();expect(await rows()).toHaveLength(1);
    await db.exec("set test.role='owner'");await expect(call([])).rejects.toThrow();
    await db.exec("set test.unlock='yes'");await call([{tag_id:"00000000-0000-0000-0000-000000000004",is_primary:true}]);
    expect(await rows()).toEqual(["00000000-0000-0000-0000-000000000004"]);
    expect((await db.query<{public_title:string}>("select public_title from events")).rows[0].public_title).toBe("keep title");
    expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','replace_event_tags_atomic(uuid,uuid,jsonb)','execute') as allowed")).rows[0].allowed).toBe(false);
    await call([]);expect(await rows()).toEqual([]);
    await db.exec("update events set visibility_scope='embargo';set test.role='developer';set test.unlock='yes';set role authenticated");
    expect((await db.query("update events set visibility_scope='public' returning id")).rows).toEqual([]);
    await db.exec("set test.role='owner'");
    expect((await db.query("update events set visibility_scope='public' returning id")).rows).toHaveLength(1);
  }finally {await db.close();}
},20000);
