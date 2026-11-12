// Cloudflare Worker 비밀값을 .env.local에서 옮긴다. 값은 화면·파일에 남기지 않고 wrangler stdin으로만 보낸다.
// Vercel의 Sensitive 값은 `vercel env pull`로 꺼낼 수 없어(자리표시 "[SENSITIVE]"만 옴) 로컬 정본을 쓴다.
// CRON_SECRET은 새로 만든다. 같은 값을 GitHub 저장소 secret CRON_SECRET에도 넣어야 하므로 한 번만 보여준다.
// 실행: node scripts/cloudflare/push-secrets.mjs
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_EMAIL",
  "PRIVATE_LAYER_UNLOCK_SECRET"
];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

const secrets = {};
for (const key of KEYS) {
  if (!env[key]) throw new Error(`.env.local에 ${key}가 없습니다.`);
  secrets[key] = env[key];
}
secrets.CRON_SECRET = randomBytes(32).toString("hex");

const result = spawnSync("npx", ["wrangler", "secret", "bulk", "--name", "vic-schedule-studio"], {
  input: JSON.stringify(secrets),
  stdio: ["pipe", "inherit", "inherit"],
  shell: true
});
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("\nGitHub → 저장소 Settings → Secrets and variables → Actions → CRON_SECRET 을 아래 값으로 바꾸세요:");
console.log(secrets.CRON_SECRET);
