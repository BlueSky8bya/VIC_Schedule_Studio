// Isolated in-memory PostgreSQL. No credentials, production rows or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);
const db=new PGlite();
const a='00000000-0000-4000-8000-000000000001';
const b='00000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language plpgsql stable as $$
    begin return nullif(current_setting('test.uid',true),'')::uuid; end; $$;
    grant usage on schema auth to anon,authenticated;
    create table public.event_hearts(event_id integer primary key,user_id uuid not null);
    insert into event_hearts select n, case when n%2=0 then '${a}'::uuid else '${b}'::uuid end from generate_series(1,2000)n;
    alter table event_hearts enable row level security;
    create policy event_hearts_read_own on event_hearts for select using(user_id=auth.uid());
    grant select on event_hearts to authenticated;`);
  const counts=async()=>{
    const results=[];
    await db.exec('set role authenticated');
    for(const uid of [a,b,'']) {
      await db.query("select set_config('test.uid',$1,false)",[uid]);
      results.push((await db.query('select count(*)::int n from event_hearts')).rows[0].n);
      const users=(await db.query('select distinct user_id from event_hearts')).rows.map(r=>r.user_id);
      assert.deepEqual(users,uid?[uid]:[]);
      await assert.rejects(db.query(`insert into event_hearts values(9999,'${a}')`),/permission denied/);
      await assert.rejects(db.query('delete from event_hearts'),/permission denied/);
    }
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from event_hearts'),/permission denied/);
    await db.exec('reset role');
    return results;
  };
  const before=await counts();assert.deepEqual(before,[1000,1000,0]);
  const grantsBefore=(await db.query("select grantee,privilege_type from information_schema.role_table_grants where table_name='event_hearts' order by 1,2")).rows;
  const sql=readFileSync('db/migrations/0152_event_hearts_read_initplan.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual(await counts(),before);
  const grantsAfter=(await db.query("select grantee,privilege_type from information_schema.role_table_grants where table_name='event_hearts' order by 1,2")).rows;
  assert.deepEqual(grantsAfter,grantsBefore);
  await db.exec(`set role authenticated;select set_config('test.uid','${a}',false)`);
  const plan=(await db.query('explain(format json) select * from event_hearts')).rows[0]['QUERY PLAN'];
  assert.ok(JSON.stringify(plan).includes('InitPlan'));
  await db.exec('reset role');
  await db.exec('alter policy event_hearts_read_own on event_hearts using(user_id=auth.uid())');
  assert.deepEqual(await counts(),before);
  assert.deepEqual((await db.query("select grantee,privilege_type from information_schema.role_table_grants where table_name='event_hearts' order by 1,2")).rows,grantsBefore);
  await db.exec(sql);
  await db.exec('alter policy event_hearts_read_own on event_hearts using(true)');
  await assert.rejects(db.exec(sql),/Unexpected event_hearts SELECT policy/);
  await db.exec('rollback');
  await db.exec('alter policy event_hearts_read_own on event_hearts using(null)');
  await assert.rejects(db.exec(sql),/Unexpected event_hearts SELECT policy/);
  await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from event_hearts')).rows[0].n,2000);
  console.log(JSON.stringify({checks:'idempotence,own-user,null,anon-denied,write-denied,grants,InitPlan,drift-guard',rows:2000,ok:true}));
} finally {await db.close()}
