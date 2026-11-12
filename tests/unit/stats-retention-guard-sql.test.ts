import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// 0164: 원본 통계 삭제는 DB에서도 '끝난 해 · 2월 1일 이후 · 12달 보관본 · 만든 지 30일 넘음'을 확인한다.
// 성능 표본은 7일만 남기고 매일 정리 작업을 등록한다. PGlite의 now()는 실제 시계라 연도는 그에 맞춰 고른다.
it("0164 guards purge_stats_batch and keeps perf samples for 7 days", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema cron;
      create table cron.job(jobid serial primary key, jobname text unique, schedule text, command text);
      create function cron.schedule(n text, s text, c text) returns bigint language sql as
        $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid$$;
      create function cron.unschedule(n text) returns boolean language sql as
        $$delete from cron.job where jobname=n returning true$$;
      create table calendars(id uuid primary key, slug text);
      insert into calendars values('00000000-0000-0000-0000-000000000001','vic');
      create table insights_year_archive(calendar_id uuid, year int, month int, payload jsonb default '{}', built_at timestamptz,
        primary key(calendar_id, year, month));
      create table activity_event(day date);
      create table visit_session(day date);
      create table perf_samples(id bigint generated always as identity primary key, label text, dur_ms numeric, created_at timestamptz default now());`);

    // 올해에서 두 해 전 = 이미 끝났고 다음 해 2월 1일도 지났다.
    const y = Number((await db.query<{ y: number }>("select extract(year from now() at time zone 'Asia/Seoul')::int as y")).rows[0].y) - 2;
    await db.exec(`insert into activity_event select make_date(${y}, 3, 1) from generate_series(1, 3);
      insert into activity_event values (make_date(${y + 1}, 3, 1));
      insert into perf_samples(label, dur_ms, created_at) values ('old', 1, now() - interval '8 days'), ('new', 1, now() - interval '1 day');`);

    await db.exec(readFileSync("db/migrations/0164_stats_retention_guard.sql", "utf8"));
    await db.exec(readFileSync("db/migrations/0164_stats_retention_guard.sql", "utf8")); // 멱등

    // 성능 표본: 7일 넘은 것만 지워지고, 매일 작업이 한 번만 등록된다.
    expect((await db.query<{ label: string }>("select label from perf_samples")).rows.map((r) => r.label)).toEqual(["new"]);
    expect((await db.query<{ schedule: string }>("select schedule from cron.job where jobname='vic-perf-retention'")).rows).toEqual([
      { schedule: "45 18 * * *" }
    ]);

    const purge = (from: string, to: string) =>
      db.query<{ n: number }>("select public.purge_stats_batch('activity_event', $1::date, $2::date, 5000) as n", [from, to]);
    const range = [`${y}-01-01`, `${y + 1}-01-01`] as const;
    const archive = (age: string, months = 12) =>
      db.exec(`delete from insights_year_archive;
        insert into insights_year_archive(calendar_id, year, month, built_at)
        select '00000000-0000-0000-0000-000000000001', ${y}, m, now() - interval '${age}' from generate_series(1, ${months}) m;`);

    // 보관본이 없으면 거절.
    await expect(purge(...range)).rejects.toThrow(/incomplete or younger/);
    // 방금 손으로 만든 보관본(5일) — 거절.
    await archive("5 days");
    await expect(purge(...range)).rejects.toThrow(/incomplete or younger/);
    // 31일 지났지만 11달뿐 — 거절.
    await archive("31 days", 11);
    await expect(purge(...range)).rejects.toThrow(/incomplete or younger/);
    // 한 해를 넘는 범위 — 거절.
    await archive("31 days");
    await expect(purge(`${y}-01-01`, `${y + 2}-01-01`)).rejects.toThrow(/inside one year/);
    // 올해 — 2월 1일 전이거나 끝나지 않은 해라 거절.
    await expect(
      db.query("select public.purge_stats_batch('activity_event', make_date($1::int, 1, 1), make_date($1::int + 1, 1, 1))", [y + 2])
    ).rejects.toThrow(/not open/);
    // 조건 충족 — 그 해 행만 지운다.
    expect((await purge(...range)).rows[0].n).toBe(3);
    expect((await db.query<{ n: number }>("select count(*)::int as n from activity_event")).rows[0].n).toBe(1);
    // 화이트리스트 밖 표는 여전히 거절.
    await expect(db.query("select public.purge_stats_batch('calendars', $1::date, $2::date)", [...range])).rejects.toThrow(/not allowed/);
    expect(
      (await db.query<{ ok: boolean }>("select has_function_privilege('anon','purge_stats_batch(text,date,date,integer)','execute') as ok")).rows[0].ok
    ).toBe(false);
  } finally {
    await db.close();
  }
});
