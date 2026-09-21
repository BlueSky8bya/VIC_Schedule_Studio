// In-memory PostgreSQL only. No credentials, network, production fixtures or records.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const cal = "00000000-0000-4000-8000-000000000001";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create type event_category as enum ('stream','rest');
 create table calendars(id uuid primary key,owner_id uuid,slug text,display_name text,title text,timezone text,
 is_public boolean,theme_id uuid,created_at timestamptz,updated_at timestamptz,public_changed_at timestamptz,
 public_memo text,poster_theme text,public_memo_align text,public_memo_valign text,public_memo_lines integer);
 create table events(id uuid primary key,calendar_id uuid,date_key date,created_at timestamptz,
 end_date_key date,link_next uuid,is_support boolean,support_kind text,support_url text,start_time time,
 end_time time,is_all_day boolean,is_tentative boolean,public_title text,public_description text,status text,
 sort_order integer,category event_category,teaser boolean,teaser_reveal_at timestamptz,
 visibility_scope text,deleted_at timestamptz,secret_cipher text);
 create table event_tags(event_id uuid,tag_id uuid,is_primary boolean,sort_order integer);
 create table event_private_meta(event_id uuid,private_title text);
 create table private_layer_settings(calendar_id uuid,passcode_hash text);
 create table private_unlock_attempts(user_id uuid,ok boolean,created_at timestamptz default now());
 create table vod_archive(title_no bigint primary key,auth_no integer);
 create table vod_chat_bins(title_no bigint,bin integer,msgs integer,speakers integer,laugh integer,terms text[]);
 create function is_calendar_admin(uuid) returns boolean language sql as $$select current_setting('test.role',true) in ('owner','developer')$$;
 create function is_calendar_owner(uuid) returns boolean language sql as $$select current_setting('test.role',true)='owner'$$;
 create function has_private_unlock(uuid) returns boolean language sql as $$select current_setting('test.unlock',true)='yes'$$;
 create function get_perf_stats(timestamptz) returns text language sql security definer as $$select 'PRIVATE-CANARY'$$;
 create function search_dictionary_draft(integer) returns text language sql security definer as $$select 'PRIVATE-CANARY'$$;
 grant select on calendars,events,event_tags,event_private_meta,vod_archive to anon,authenticated;
 grant all on private_layer_settings to authenticated;
 alter table events enable row level security; alter table event_private_meta enable row level security;
 alter table vod_archive enable row level security;
 insert into calendars(id,owner_id,is_public) values('${cal}','${id(99)}',true);
 insert into vod_archive values(42,101),(43,102);
 insert into vod_chat_bins values(42,0,10,3,2,array['hello']), (43,0,10,3,2,array['PRIVATE-CANARY']);
 insert into private_layer_settings values('${cal}','PRIVATE-CANARY');`);
 for (const [n,scope,teaser,status,deleted] of [
   [2,'public',false,'scheduled',false], [3,'public',true,'scheduled',false],
   [4,'work',false,'scheduled',false], [5,'owner_private',false,'scheduled',false],
   [6,'public',false,'draft',false], [7,'public',false,'scheduled',true]
 ]) {
   await db.query(`insert into events(id,calendar_id,date_key,created_at,public_title,public_description,
     start_time,end_time,end_date_key,link_next,is_support,support_url,is_all_day,category,
     visibility_scope,teaser,teaser_reveal_at,status,deleted_at,secret_cipher)
     values($1,$2,'2026-09-21',now(),$3,'PRIVATE-CANARY','12:00','13:00','2026-09-22',$2,true,
     'https://private.invalid',false,'rest',$4,$5,now()+interval '1 day',$6,$7,'PRIVATE-CANARY')`,
     [id(n),cal,n===2?'Public title':'PRIVATE-CANARY',scope,teaser,status,deleted?new Date().toISOString():null]);
   await db.query("insert into event_tags values($1,$2,true,0)",[id(n),id(98)]);
 }
 const sql=readFileSync('db/migrations/0125_privacy_boundary.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 const denied=async(q)=>{await assert.rejects(db.query(q),/permission denied/);};
 for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}; select set_config('test.role','viewer',false); select set_config('test.unlock','no',false);`);
   assert.deepEqual((await db.query('select id from events')).rows.map(r=>r.id),[id(2)]);
   const projection=(await db.query('select * from public_schedule_events order by id')).rows;
   assert.equal(projection.length,2);
   const teaser=projection[1];
   assert.equal(teaser.public_title,''); assert.equal(teaser.public_description,null);
   assert.equal(teaser.support_url,null);assert.equal(teaser.start_time,null);
   assert.equal(teaser.link_next,null);assert.deepEqual(teaser.event_tags,[]);
   assert.ok(!JSON.stringify(teaser).includes('PRIVATE-CANARY'));
   await denied('select owner_id from calendars');
   await denied('select * from private_layer_settings');
   await denied("update private_layer_settings set passcode_hash='changed'");
   await denied('select get_perf_stats(now())');
   await denied('select search_dictionary_draft(1)');
   await denied(`select reserve_private_unlock_attempt('${id(88)}')`);
   assert.deepEqual((await db.query('select title_no from vod_archive')).rows,[{title_no:42}]);
   assert.deepEqual((await db.query('select vod_chat_profile(43) as profile')).rows[0].profile.bins,[]);
   assert.equal((await db.query('select vod_chat_profile(42) as profile')).rows[0].profile.bins.length,1);
   await db.exec('reset role');
 }
 await db.exec("set role authenticated; select set_config('test.role','developer',false); select set_config('test.unlock','no',false)");
 assert.equal((await db.query("select count(*)::int n from events where visibility_scope<>'public'")).rows[0].n,0);
 await db.exec("select set_config('test.unlock','yes',false)");
 assert.deepEqual((await db.query("select id from events where visibility_scope<>'public'")).rows.map(r=>r.id),[id(4)]);
 await db.exec("select set_config('test.role','owner',false)");
 assert.equal((await db.query("select count(*)::int n from events where visibility_scope<>'public'")).rows[0].n,2);
 await db.exec('reset role; set role service_role');
 const reserved=await Promise.all(Array.from({length:12},()=>db.query('select reserve_private_unlock_attempt($1) ok',[id(88)])));
 assert.equal(reserved.filter(r=>r.rows[0].ok).length,5);
 await db.exec('reset role');
 console.log('PASS: privacy migration idempotence, anon/viewer direct REST boundaries, teaser canaries, role/unlock rules, RPC restrictions and 5/12 atomic reservations');
} finally {await db.close();}
