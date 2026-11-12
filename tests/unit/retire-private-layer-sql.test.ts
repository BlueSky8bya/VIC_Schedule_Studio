import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";

// 0159 비공개 레이어 철수 — 메모리 PostgreSQL에서만 검증한다(자격 증명·네트워크·운영 데이터 없음).
it("0159 drops the private layer, keeps tag writes public-only and is idempotent",async()=>{
  const db=new PGlite();
  const cal="00000000-0000-0000-0000-000000000002";
  try {
    await db.exec(`create role anon;create role authenticated;
      create type visibility_scope as enum ('public','embargo','work','owner_private');
      create table events(id uuid primary key,calendar_id uuid,visibility_scope visibility_scope,status text default 'scheduled',
        deleted_at timestamptz,public_title text,secret_cipher text);
      create table broadcast_tags(id uuid primary key,calendar_id uuid,is_active boolean);
      create table event_tags(event_id uuid references events,tag_id uuid references broadcast_tags,is_primary boolean,sort_order int,unique(event_id,tag_id));
      create table event_private_meta(event_id uuid references events);
      create table private_unlock_grants(token_hash text primary key,calendar_id uuid);
      create table support_campaigns(id uuid primary key,calendar_id uuid);
      create table private_layer_settings(calendar_id uuid primary key,passcode_hash text,passcode_version int,unlock_duration_minutes int);
      create function is_calendar_admin(uuid) returns boolean language sql as $$select current_setting('test.role') in ('owner','developer')$$;
      create function is_calendar_owner(uuid) returns boolean language sql as $$select current_setting('test.role')='owner'$$;
      create function has_private_unlock(uuid) returns boolean language sql as $$select false$$;
      create function is_active_worker(uuid) returns boolean language sql as $$select false$$;
      alter table events enable row level security;alter table event_tags enable row level security;
      alter table event_private_meta enable row level security;
      create policy "owners can manage events" on events for all using(is_calendar_admin(calendar_id) and (visibility_scope='public' or has_private_unlock(calendar_id))) with check(true);
      create policy "workers can read work events" on events for select using(is_active_worker(calendar_id) and has_private_unlock(calendar_id));
      create policy "read event tags for visible events" on event_tags for select using(exists(select 1 from events e where e.id=event_tags.event_id and has_private_unlock(e.calendar_id)));
      create policy "owners can manage private meta" on event_private_meta for all using(has_private_unlock((select calendar_id from events limit 1)));
      grant select,update on events to authenticated;grant select on event_tags to authenticated;
      insert into events(id,calendar_id,visibility_scope,public_title) values
        ('00000000-0000-0000-0000-000000000001','${cal}','public','keep title'),
        ('00000000-0000-0000-0000-000000000009','${cal}','owner_private','old private');
      insert into broadcast_tags values('00000000-0000-0000-0000-000000000003','${cal}',true);
      insert into private_layer_settings values('${cal}','hash',3,60);
      set test.role='owner';`);
    const sql=readFileSync("db/migrations/0159_retire_private_layer.sql","utf8");
    await db.exec(sql);await db.exec(sql);

    const exists=async(q:string)=>(await db.query<{n:number}>(q)).rows[0].n;
    expect(await exists("select count(*)::int n from pg_tables where tablename in ('event_private_meta','private_unlock_grants','support_campaigns')")).toBe(0);
    expect(await exists("select count(*)::int n from information_schema.columns where (table_name='events' and column_name='secret_cipher') or (table_name='private_layer_settings' and column_name='unlock_duration_minutes')")).toBe(0);
    expect(await exists("select count(*)::int n from pg_proc where proname in ('has_private_unlock','is_active_worker')")).toBe(0);
    expect(await exists("select count(*)::int n from pg_policies where policyname='workers can read work events'")).toBe(0);
    // 게이트 비밀번호는 그대로.
    expect((await db.query<{passcode_version:number}>("select passcode_version from private_layer_settings")).rows[0].passcode_version).toBe(3);

    const call=(id:string,tags:unknown)=>db.query(`select replace_event_tags_atomic('${id}','${cal}',$1::jsonb)`,[JSON.stringify(tags)]);
    await call("00000000-0000-0000-0000-000000000001",[{tag_id:"00000000-0000-0000-0000-000000000003",is_primary:true}]);
    expect((await db.query("select tag_id from event_tags")).rows).toHaveLength(1);
    // 남은 비공개 행은 소유자도 태그를 바꿀 수 없다.
    await expect(call("00000000-0000-0000-0000-000000000009",[])).rejects.toThrow();
    expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','replace_event_tags_atomic(uuid,uuid,jsonb)','execute') as allowed")).rows[0].allowed).toBe(false);

    // 편집자 RLS: 공개 행만 보인다.
    await db.exec("set role authenticated");
    expect((await db.query<{public_title:string}>("select public_title from events")).rows.map(r=>r.public_title)).toEqual(["keep title"]);
  } finally {await db.close();}
},20000);
