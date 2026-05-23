// DB 적용 상태 확인용 일회성 스크립트.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  text.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]])
);
const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];

const client = new Client({
  host: `aws-1-ap-northeast-2.pooler.supabase.com`,
  port: 5432,
  user: `postgres.${ref}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000
});
await client.connect();

const tables = await client.query(
  `select count(*)::int as n from information_schema.tables where table_schema='public'`
);
const admins = await client.query(`select email from public.platform_admins`);
const policies = await client.query(
  `select count(*)::int as n from pg_policies where schemaname='public'`
);
const funcs = await client.query(
  `select proname from pg_proc where proname in ('is_developer','is_calendar_admin','is_calendar_owner','has_private_unlock') order by proname`
);

console.log("public 테이블 수:", tables.rows[0].n);
console.log("RLS 정책 수:", policies.rows[0].n);
console.log("보안 함수:", funcs.rows.map((r) => r.proname).join(", "));
console.log("platform_admins:", admins.rows.map((r) => r.email).join(", ") || "(없음)");

await client.end();
