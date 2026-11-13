// 제보함 답장 자동 발송(Gmail API) 설정 — 소유자가 한 번 실행한다.
//   1) .env.local에 GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET을 넣어 둔다(Google Cloud의 'OAuth 클라이언트 ID — 데스크톱 앱').
//   2) node scripts/gmail/setup.mjs → 출력된 주소를 브라우저에서 열어 3blackspacegames 계정으로 '허용'.
//   3) 받은 갱신 토큰을 .env.local에 저장하고, 세 값을 Cloudflare Worker 비밀값으로 올린다(wrangler secret put, 화면에 값 안 보임).
// 권한 범위는 gmail.send(보내기) 하나뿐 — 메일 읽기·지우기 권한은 받지 않는다.
import http from "node:http";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ENV = ".env.local";
const SCOPE = "https://www.googleapis.com/auth/gmail.send";
const ACCOUNT = "3blackspacegames@gmail.com";
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

const raw = readFileSync(ENV, "utf8");
const env = Object.fromEntries(
  raw.split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  })
);
const clientId = env.GMAIL_CLIENT_ID;
const clientSecret = env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("먼저 .env.local에 GMAIL_CLIENT_ID와 GMAIL_CLIENT_SECRET을 넣어 주세요.");
  process.exit(1);
}

const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
auth.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline",
  prompt: "consent",
  login_hint: ACCOUNT
}).toString();

console.log("\n아래 주소를 브라우저에서 열고, 3blackspacegames 계정으로 '허용'을 눌러 주세요:\n");
console.log(auth.toString() + "\n");

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", REDIRECT);
    if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
    const c = url.searchParams.get("code");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(c ? "<p style='font-family:sans-serif'>허용됐어요. 이 창을 닫고 터미널로 돌아가세요.</p>" : "<p>허용되지 않았어요.</p>");
    server.close();
    if (c) resolve(c);
    else reject(new Error(url.searchParams.get("error") ?? "no code"));
  });
  server.listen(PORT, "127.0.0.1");
  setTimeout(() => { server.close(); reject(new Error("5분 안에 허용하지 않아 멈췄어요. 다시 실행해 주세요.")); }, 300_000);
});

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: "authorization_code" }).toString()
});
const token = await tokenRes.json();
if (!token.refresh_token) {
  console.error("갱신 토큰을 받지 못했어요:", token.error ?? tokenRes.status);
  process.exit(1);
}

const lines = raw.split(/\r?\n/).filter((l) => !l.startsWith("GMAIL_REFRESH_TOKEN="));
while (lines.length && lines[lines.length - 1] === "") lines.pop();
lines.push(`GMAIL_REFRESH_TOKEN=${token.refresh_token}`, "");
writeFileSync(ENV, lines.join(raw.includes("\r\n") ? "\r\n" : "\n"));
console.log("✓ .env.local에 갱신 토큰을 저장했어요.");

for (const [name, value] of [["GMAIL_CLIENT_ID", clientId], ["GMAIL_CLIENT_SECRET", clientSecret], ["GMAIL_REFRESH_TOKEN", token.refresh_token]]) {
  const r = spawnSync("npx", ["wrangler", "secret", "put", name], { input: value, encoding: "utf8", shell: true });
  console.log(r.status === 0 ? `✓ Cloudflare 비밀값 ${name} 등록` : `✗ ${name} 등록 실패 — wrangler 로그인을 확인해 주세요`);
}
console.log("\n끝났어요. 제보함 답장 창의 '보내기'가 바로 Gmail로 보냅니다.");
