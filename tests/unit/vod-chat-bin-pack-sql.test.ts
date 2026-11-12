import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";

// 0162/0163 다시보기 채팅 구간 묶음 — 메모리 PostgreSQL에서만 검증한다(자격 증명·네트워크·운영 데이터 없음).
// 핵심: 옛 표(행 단위)로 만든 vod_chat_profile JSON과 새 표(방송 1행 배열)로 만든 JSON이 바이트까지 같다.
const oldProfile=(()=>{
  const src=readFileSync("db/migrations/0125_privacy_boundary.sql","utf8");
  const start=src.indexOf("create or replace function public.vod_chat_profile");
  return src.slice(start,src.indexOf("$$;",start)+3);
})();

function seeded(seed:number){let s=seed;return()=>((s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff);}

it("0162 packs bins per VOD with identical profiles, dual-writes, and 0163 drops the old table",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table vod_archive(title_no bigint primary key,auth_no integer);
      create table vod_chat_job(title_no bigint primary key references vod_archive(title_no) on delete cascade,revision integer not null default 0,
        state jsonb,complete boolean not null default false,next_retry_at timestamptz not null default now(),updated_at timestamptz not null default now());
      create table vod_chat_sync(title_no bigint primary key,chunks integer,messages integer,complete boolean,synced_at timestamptz);
      create table vod_chat_terms(title_no bigint references vod_archive(title_no) on delete cascade,term text,cnt integer,peak_bin integer,peak_cnt integer,bins integer,
        constraint vod_chat_terms_pkey primary key(title_no,term));
      create index idx_vod_chat_terms_term on vod_chat_terms(term);
      create table vod_chat_bins(title_no bigint references vod_archive(title_no) on delete cascade,bin integer,msgs integer,speakers integer,laugh integer,terms text[],
        primary key(title_no,bin));
      create table vod_chat_people(title_no bigint,name text,greetings integer,mentions integer);
      create table vod_chapter_index(title_no bigint,label_cho text,section_norm text,label_jamo text); -- 운영은 gin_trgm, 여기선 이름만 같은 btree(PGlite에 pg_trgm 없음)
      create index idx_vod_chapter_cho_trgm on vod_chapter_index (label_cho);
      create index idx_vod_chapter_section_trgm on vod_chapter_index (section_norm);
      create index idx_vod_chapter_jamo_trgm on vod_chapter_index (label_jamo);`);
    await db.exec(oldProfile);

    // 실데이터 모양: 성긴 구간(빈 구간은 행 없음), 대부분 빈 단어 배열, 일부 1~3단어, 웃음 많은/적은 방송 섞기.
    const rnd=seeded(7);
    const vods=Array.from({length:14},(_,i)=>1000+i);
    await db.exec(`insert into vod_archive values ${vods.map(v=>`(${v},${v===1013?102:101})`).join(",")},(2000,101);`);
    for(const v of vods){
      const rows:string[]=[];
      const n=v===1012?5:30+Math.floor(rnd()*60);
      let bin=0;
      for(let i=0;i<n;i++){
        bin+=1+Math.floor(rnd()*3);
        const msgs=1+Math.floor(rnd()*40), sp=1+Math.floor(rnd()*msgs), laugh=Math.floor(rnd()*msgs*(v%3));
        const k=rnd()<0.7?0:1+Math.floor(rnd()*3);
        const terms=Array.from({length:k},(_,j)=>`'w${Math.floor(rnd()*9)}_${j}'`);
        rows.push(`(${v},${bin},${msgs},${sp},${laugh},array[${terms.join(",")}]::text[])`);
      }
      await db.exec(`insert into vod_chat_bins values ${rows.join(",")};`);
    }
    const profiles=async()=>Object.fromEntries(await Promise.all([...vods,2000,9999].map(async v=>
      [v,(await db.query<{p:string}>(`select vod_chat_profile(${v})::text as p`)).rows[0].p] as const)));
    const before=await profiles();
    expect(JSON.parse(before[1013]).bins).toEqual([]); // 비공개 방송은 비어 있다
    expect(Object.values(before).some(p=>JSON.parse(p).laughTier==="high")).toBe(true); // 등급 분기까지 비교한다

    const pack=readFileSync("db/migrations/0162_vod_chat_bin_pack.sql","utf8");
    await db.exec(pack);await db.exec(pack); // 멱등
    expect(await profiles()).toEqual(before);
    expect((await db.query<{n:number}>("select count(*)::int n from vod_chat_bin_pack")).rows[0].n).toBe(vods.length);

    // 새 수집: 이중 기록 → 옛 표 프로필 = 새 표 프로필.
    const commit=(id:number,revision:number,snapshot:unknown)=>db.query("select vod_chat_commit_job($1,$2,$3::jsonb,$4::jsonb) as ok",
      [id,revision,JSON.stringify({state:null,complete:true,chunks:1,messages:9,nextRetryAt:"2000-01-01Z"}),JSON.stringify(snapshot)]);
    const snapshot={terms:[{term:"ㅋㅋ",cnt:3,peak_bin:4,peak_cnt:2,bins:2}],
      bins:[{bin:9,msgs:3,speakers:2,laugh:5,terms:["b","a"]},{bin:4,msgs:7,speakers:3,laugh:1,terms:[]},{bin:6,msgs:1,speakers:1,laugh:0,terms:["z"]}],people:[]};
    expect((await commit(2000,0,snapshot)).rows[0]).toEqual({ok:true});
    const viaPack=(await db.query<{p:string}>("select vod_chat_profile(2000)::text as p")).rows[0].p;
    await db.exec(oldProfile);
    const viaRows=(await db.query<{p:string}>("select vod_chat_profile(2000)::text as p")).rows[0].p;
    expect(viaPack).toBe(viaRows);
    expect(JSON.parse(viaPack).bins.map((b:{i:number;t:string[]})=>[b.i,b.t])).toEqual([[4,[]],[6,["z"]],[9,["b","a"]]]);
    // 빈 스냅숏도 이전처럼 빈 구간으로 덮는다.
    await db.exec(pack);
    expect((await commit(2000,1,{terms:[],bins:[],people:[]})).rows[0]).toEqual({ok:true});
    expect(JSON.parse((await db.query<{p:string}>("select vod_chat_profile(2000)::text as p")).rows[0].p).bins).toEqual([]);

    // 0163: 옛 표·안 쓰는 색인 삭제, 쓰기·읽기는 그대로.
    const afterPack=await profiles();
    await db.exec(readFileSync("db/migrations/0163_vod_chat_bins_drop.sql","utf8"));
    expect((await db.query<{n:number}>("select count(*)::int n from pg_tables where tablename='vod_chat_bins'")).rows[0].n).toBe(0);
    expect((await db.query<{n:number}>("select count(*)::int n from pg_indexes where tablename='vod_chapter_index'")).rows[0].n).toBe(0);
    expect(await profiles()).toEqual(afterPack);
    expect((await commit(2000,2,snapshot)).rows[0]).toEqual({ok:true});
    expect((await db.query<{p:string}>("select vod_chat_profile(2000)::text as p")).rows[0].p).toBe(viaPack);
    expect((await db.query<{allowed:boolean}>("select has_table_privilege('anon','vod_chat_bin_pack','select') as allowed")).rows[0].allowed).toBe(false);
  } finally {await db.close();}
},30000);
