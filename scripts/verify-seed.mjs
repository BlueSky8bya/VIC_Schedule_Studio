// 시드 결과 확인용 일회성 스크립트.
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

const cal = await client.query(
  `select c.slug, c.title, u.email as owner_email
   from public.calendars c join auth.users u on u.id = c.owner_id`
);
const counts = await client.query(`select
  (select count(*)::int from public.broadcast_tags) as tags,
  (select count(*)::int from public.color_palette) as palette,
  (select count(*)::int from public.events) as events,
  (select count(*)::int from public.event_tags) as event_tags`);

console.log("캘린더:", JSON.stringify(cal.rows));
console.log("개수:", JSON.stringify(counts.rows[0]));

await client.end();
