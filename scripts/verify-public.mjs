// anon(publishable) 키 + RLS로 공개 읽기가 되는지, 비공개가 새지 않는지 확인.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  text.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: cal } = await supabase
  .from("calendars").select("slug,title").eq("slug", "vic").maybeSingle();
const { data: tags } = await supabase.from("broadcast_tags").select("display_name").eq("is_active", true);
const { data: palette } = await supabase.from("color_palette").select("key");
const { data: events } = await supabase
  .from("events")
  .select("public_title, visibility_scope, status, event_tags(tag_id, is_primary)")
  .eq("visibility_scope", "public").neq("status", "draft");

console.log("캘린더:", cal?.title ?? "(없음)");
console.log("공개 태그:", tags?.length, "개");
console.log("팔레트:", palette?.length, "색");
console.log("공개 일정:", events?.map((e) => e.public_title));

// 보안 확인: anon이 비공개 일정을 못 봐야 한다
const { data: leak } = await supabase
  .from("events").select("public_title, visibility_scope").neq("visibility_scope", "public");
console.log("anon이 본 비공개 일정 수(0이어야 정상):", leak?.length ?? 0);
