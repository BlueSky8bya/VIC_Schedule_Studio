// Isolated Postgres/WASM only; no environment or production DB access.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);
const db=new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table vod_archive(title_no bigint primary key,auth_no integer,broadcast_day date);
 create table vod_timeline(title_no bigint primary key,entries jsonb);
 create table vod_chat_sync(title_no bigint primary key,chunks integer,messages integer,complete boolean,synced_at timestamptz);
 create table vod_chat_terms(title_no bigint,term text,cnt integer,peak_bin integer,peak_cnt integer,bins integer);
 create table vod_chat_bins(title_no bigint,bin integer,msgs integer,speakers integer,laugh integer,terms text[]);
 create table vod_chat_people(title_no bigint,name text,greetings integer,mentions integer);
 insert into vod_archive values(42,101,'2026-09-18'),(43,102,'2026-09-18'),(44,101,'2026-09-18'),(45,101,'2026-09-18');
 insert into vod_chat_terms values(42,'old',7,0,7,1);
 insert into vod_chat_sync values(45,0,0,true,now());`);
 const sql=readFileSync('db/migrations/0126_vod_chat_recovery.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 const commit=(id,revision,job,snapshot=null)=>db.query('select vod_chat_commit_job($1,$2,$3::jsonb,$4::jsonb) as ok',
   [id,revision,JSON.stringify(job),snapshot===null?null:JSON.stringify(snapshot)]);
 const job={state:{cursor:1,missing:[0]},complete:false,chunks:1,messages:2,nextRetryAt:'2000-01-01Z'};
 const snapshot={terms:[{term:'new',cnt:2,peak_bin:1,peak_cnt:2,bins:1}],
   bins:[{bin:1,msgs:2,speakers:1,laugh:3,terms:['new']}],people:[]};
 assert.equal((await commit(42,0,job)).rows[0].ok,true);
 assert.equal((await db.query('select term from vod_chat_terms where title_no=42')).rows[0].term,'old');
 assert.equal((await commit(42,0,job,snapshot)).rows[0].ok,false); // stale worker
 assert.equal((await commit(42,1,job,snapshot)).rows[0].ok,true);
 assert.deepEqual((await db.query('select term,cnt from vod_chat_terms where title_no=42')).rows,[{term:'new',cnt:2}]);
 assert.equal((await commit(43,0,job,snapshot)).rows[0].ok,false); // private VOD
 const invalid={...snapshot,terms:[{...snapshot.terms[0],cnt:'not an integer'}]};
 await assert.rejects(()=>commit(42,2,job,invalid));
 assert.equal((await db.query('select revision from vod_chat_job where title_no=42')).rows[0].revision,2);
 assert.equal((await db.query('select cnt from vod_chat_terms where title_no=42')).rows[0].cnt,2); // rollback deletion
 // First-ever timeline invalidates workers that read "no job" (revision0).
 await db.exec(`insert into vod_timeline values(44,'[{"label":"late timeline"}]');`);
 assert.equal((await commit(44,0,job,snapshot)).rows[0].ok,false);
 assert.equal((await db.query('select revision from vod_chat_job where title_no=44')).rows[0].revision,1);
 await db.exec(`update vod_timeline set entries='[{"label":"edited"}]' where title_no=44;`);
 assert.equal((await db.query('select revision from vod_chat_job where title_no=44')).rows[0].revision,2);
 await db.exec(`update vod_timeline set entries=entries where title_no=44;`);
 assert.equal((await db.query('select revision from vod_chat_job where title_no=44')).rows[0].revision,2);
 // Unseen backlog larger than PostgREST row cap cannot suppress due continuations.
 await db.exec(`insert into vod_archive select n,101,'2020-01-01' from generate_series(100,1300) n;`);
 const picked=(await db.query('select * from vod_chat_pick_jobs(4)')).rows.map(r=>Number(r.title_no));
 assert(picked.includes(42)); assert(picked.includes(44)); assert(picked.includes(45)); assert(!picked.includes(43));
 assert((await db.query('select * from vod_chat_pick_jobs(2)')).rows.some(r=>Number(r.title_no)===44)); // late context precedes old gap retries
 for(const role of ['anon','authenticated']) {
   await db.exec(`set role ${role}`);
   await assert.rejects(()=>db.query('select * from vod_chat_job'),/permission denied/);
   await assert.rejects(()=>db.query('select * from vod_chat_pick_jobs(4)'),/permission denied/);
   await assert.rejects(()=>commit(42,2,job,snapshot),/permission denied/);
   await db.exec('reset role');
 }
 await db.exec('set role service_role');
 assert.equal((await commit(42,2,{...job,complete:true,state:null},snapshot)).rows[0].ok,true);
 console.log('PASS: migration idempotence, CAS, atomic rollback, late-context invalidation, uncapped fair queue, private VOD and role boundaries');
} finally {await db.close();}
