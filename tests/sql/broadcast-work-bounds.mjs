// Isolated WASM PostgreSQL only. Never reads env, connects to DB or calls external APIs.
// node tests/sql/broadcast-work-bounds.mjs [optional-custom-pglite-module-path]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { PGlite } = process.argv[2]
  ? await import(pathToFileURL(resolve(process.argv[2])).href)
  : await import('@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.vod_archive(title_no bigint primary key,bno text,broadcast_day date not null,title text default '',
      duration_ms bigint default 0,reg_date timestamptz,comment_cnt int default 0,like_cnt int default 0,read_cnt int default 0,
      auth_no int,thumb text,guest boolean not null default false,synced_at timestamptz not null default now());
    create table public.perf_samples(created_at timestamptz);
    create table public.visit_session(id text,account_hash text,day date,role text,device text,ended_at timestamptz,last_seen_at timestamptz);
    create table public.search_trends(computed_at timestamptz);
    create table public.test_graph(control text primary key, count int default 0);
    insert into test_graph values('rebuild',0),('swap',0),('trends',0);
    create function search_song_refresh() returns void language sql as 'select';
    create function search_game_refresh() returns void language sql as 'select';
    create function search_synonyms_rebuild() returns void language sql as 'select';
    create function search_trending_rebuild() returns void language plpgsql as $$begin
      if exists(select 1 from test_graph where control='trends' and count<0) then raise exception 'synthetic trend failure'; end if;
      update test_graph set count=count+1 where control='trends'; delete from search_trends; insert into search_trends values(now()); end$$;
    create function search_term_graph_rebuild() returns int language plpgsql as $$begin
      if exists(select 1 from test_graph where control='rebuild' and count<0) then raise exception 'synthetic failure'; end if;
      update test_graph set count=count+1 where control='rebuild'; return 1; end$$;
    create function search_term_relations_swap() returns boolean language plpgsql as $$begin
      if exists(select 1 from test_graph where control='swap' and count<0) then return false; end if;
      update test_graph set count=count+1 where control='swap'; return true; end$$;`);
  await db.exec(readFileSync('db/migrations/0071_vod_timeline.sql','utf8'));
  const search=readFileSync('db/migrations/0076_public_search.sql','utf8');
  await db.exec(search.slice(0,search.indexOf('-- 백필:')).replace('create extension if not exists pg_trgm;',''));
  await db.exec(readFileSync('db/migrations/0124_vod_timeline_variants.sql','utf8'));
  await db.exec(`create table public.test_projection_writes(n int); insert into test_projection_writes values(0);
    create function count_projection() returns trigger language plpgsql as $$begin
      update test_projection_writes set n=n+1; return new; end$$;
    create trigger projection_writes after insert or update of entries,variants on vod_timeline for each row execute function count_projection();`);
  const migration = readFileSync('db/migrations/0151_broadcast_work_bounds.sql','utf8');
  await db.exec(migration); await db.exec(migration);
  const candidate = label => ({ key:'root:1',rootCommentNo:1,sourceCommentNos:['root:1'],authorNick:'Public source',
    entries:[{sec:1,label}],eligible:true,reason:'overview',score:800 });
  const ingest = async (label,time) => (await db.query('select vod_timeline_ingest_changes(42,$1::jsonb,$2::timestamptz) v',
    [JSON.stringify([candidate(label)]),time])).rows[0].v;
  assert.deepEqual(await ingest('A','2026-01-01T00:00:00Z'),{accepted:true,changed:true});
  const unchangedTid=(await db.query('select ctid from vod_timeline_candidate')).rows[0].ctid;
  assert.deepEqual(await ingest('A','2026-01-01T01:00:00Z'),{accepted:true,changed:false});
  assert.equal((await db.query('select ctid from vod_timeline_candidate')).rows[0].ctid,unchangedTid);
  assert.equal((await db.query('select n from test_projection_writes')).rows[0].n,1);
  assert.equal((await db.query("select revision from broadcast_work_state where key='timeline-search'")).rows[0].revision,1);
  assert.deepEqual(await ingest('B','2026-01-01T02:00:00Z'),{accepted:true,changed:true});
  assert.deepEqual(await ingest('A','2026-01-01T01:30:00Z'),{accepted:false,changed:false});
  await db.exec("update broadcast_work_state set state='{\"dirty\":false}' where key='timeline-search'");
  const priorRevision=(await db.query("select revision from broadcast_work_state where key='timeline-search'")).rows[0].revision;
  await db.query("select vod_timeline_moderate(42,'root:1','hide')");
  const afterModeration=(await db.query("select revision,state from broadcast_work_state where key='timeline-search'")).rows[0];
  assert.equal(afterModeration.revision,priorRevision+1);
  assert.deepEqual(afterModeration.state,{dirty:true});
  await ingest('C','2026-01-01T03:00:00Z');
  assert.equal((await db.query('select entry_count from vod_timeline where title_no=42')).rows[0].entry_count,0);
  assert.equal((await db.query("select vod_timeline_ingest(42,'[]','2026-01-01T04:00:00Z') ok")).rows[0].ok,true);

  // Trend success alone cannot suppress graph retries; failed swap cannot claim completion.
  await db.exec("update test_graph set count=-1 where control='rebuild'");
  await db.query('select search_graph_nightly()');
  assert.equal((await db.query("select count(*)::int n from broadcast_work_state where key='search-term-graph'")).rows[0].n,0);
  assert.equal((await db.query("select count from test_graph where control='trends'")).rows[0].count,1);
  assert.equal((await db.query('select search_graph_nightly_if_stale() ran')).rows[0].ran,true);
  await db.exec("update test_graph set count=0 where control='rebuild';update test_graph set count=-1 where control='swap'");
  await db.query('select search_graph_nightly()');
  assert.equal((await db.query("select count(*)::int n from broadcast_work_state where key='search-term-graph'")).rows[0].n,0);
  await db.exec("update test_graph set count=0 where control='swap'");
  await db.query('select search_graph_nightly()');
  assert.equal((await db.query('select search_graph_nightly_if_stale() ran')).rows[0].ran,false);
  await db.exec("delete from search_trends;update test_graph set count=-1 where control='trends'");
  assert.equal((await db.query('select search_graph_nightly_if_stale() ran')).rows[0].ran,true);
  await db.exec("update test_graph set count=0 where control='trends'");
  await db.query('select search_graph_nightly_if_stale()');
  assert.equal((await db.query('select search_graph_nightly_if_stale() ran')).rows[0].ran,false);

  await db.exec(`insert into vod_archive(title_no,broadcast_day,title,auth_no,synced_at) values
    (42,'2020-01-01','kept',101,'2020-01-01'),(43,'2020-01-01','gone',101,'2020-01-01'),
    (44,'2020-01-01','new concurrent',101,now()+interval '1 minute');
    insert into vod_archive(title_no,broadcast_day,title,auth_no,guest,synced_at) values(45,'2020-01-01','guest',101,true,'2020-01-01');`);
  const row={title_no:42,bno:null,broadcast_day:'2020-01-01',title:'updated',duration_ms:1000,reg_date:null,
    comment_cnt:0,like_cnt:0,read_cnt:0,auth_no:101,thumb:''};
  const state={startedAt:new Date().toISOString(),nextPage:2,lastPage:2,rows:[{titleNo:42}],dbRows:[row]};
  const commit=async(rev,state,complete)=>(await db.query('select vod_archive_sweep_commit($1,$2::jsonb,$3) v',[rev,JSON.stringify(state),complete])).rows[0].v;
  assert.equal((await commit(0,state,false)).accepted,true);
  assert.equal((await db.query('select count(*)::int n from vod_archive')).rows[0].n,4);
  assert.equal((await db.query("select completed_at from broadcast_work_state where key='vod-archive-sweep'")).rows[0].completed_at,null);
  await assert.rejects(()=>commit(1,state,true),/Incomplete archive/);
  assert.equal((await commit(0,{...state,nextPage:3},true)).accepted,false);
  assert.deepEqual(await commit(1,{...state,nextPage:3},true),{accepted:true,deleted:1});
  assert.deepEqual((await db.query('select title_no from vod_archive order by title_no')).rows.map(r=>r.title_no),[42,44,45]);
  assert.equal((await db.query("select state from broadcast_work_state where key='vod-archive-sweep'")).rows[0].state,null);
  await assert.rejects(()=>commit(2,{startedAt:state.startedAt},true),/Invalid archive/);
  // KST midnight window includes the previous day; future, ended, stale and invalid roles stay out.
  await db.exec(`insert into visit_session values
    ('synthetic-sensitive-canary','synthetic-hash','2026-09-21','anon','desktop',null,'2026-09-21T14:59:00Z'),
    ('synthetic2','synthetic-hash','2026-09-22','developer','ios',null,'2026-09-21T15:00:10Z'),
    ('stale',null,'2026-09-21','anon','desktop',null,'2026-09-21T14:58:39Z'),
    ('future',null,'2026-09-22','anon','desktop',null,'2026-09-21T15:00:11Z'),
    ('ended',null,'2026-09-22','anon','desktop','2026-09-21T15:00:10Z','2026-09-21T15:00:10Z'),
    ('invalid',null,'2026-09-22','other','desktop',null,'2026-09-21T15:00:10Z');`);
  const presence=async()=> (await db.query("select developer_live_presence_counts('2026-09-21T15:00:10Z') v")).rows[0].v;
  assert.deepEqual(await presence(),{total:2,roles:{owner:0,viewer:0,anon:1,developer:1},devices:{desktop:1,android:0,ios:1,mobile:0}});
  assert.doesNotMatch(JSON.stringify(await presence()),/synthetic|hash|session/);
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(()=>db.query('select * from broadcast_work_state'),/permission denied/);
    await assert.rejects(presence,/permission denied/);
    await assert.rejects(()=>commit(2,state,false),/permission denied/);
    await assert.rejects(()=>ingest('canary','2026-01-02'),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await presence()).total,2);
  assert.equal((await commit(2,state,false)).accepted,true);
  await db.exec('reset role');
  await db.exec(readFileSync('docs/agent/verification/ROLLBACK-0151-broadcast-work.sql','utf8'));
  assert.equal((await db.query("select vod_timeline_ingest(42,'[]','2026-01-03') ok")).rows[0].ok,true);
  console.log('PASS: 0151 idempotence, no-op physical write gate, bool/moderation/stale contracts, graph failure/swap retry, archive incomplete/CAS/guest/concurrent-write guards, anonymous/authenticated denial, service grants, rollback functions');
} catch(error) { console.error(error.message, error.code ?? ''); process.exitCode=1; } finally { await db.close(); }
