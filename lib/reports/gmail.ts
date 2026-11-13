import { guardedFetch } from "@/lib/net/guarded-fetch";
import { LEGAL_CONTACT_EMAIL } from "@/components/legal/contact";

// 제보함 답장 자동 발송 — Gmail API(users.messages.send, 범위 gmail.send만). 문의 계정 3blackspacegames로 보내고
// 그 계정의 보낸편지함에 남는다. 비밀값(GMAIL_CLIENT_ID·GMAIL_CLIENT_SECRET·GMAIL_REFRESH_TOKEN)은 서버에만 —
// 발급·등록은 scripts/gmail/setup.mjs(소유자가 한 번 실행). 없으면 'not-configured'를 돌려주고 화면은 Gmail 창 열기로 넘어간다.

export type SendResult = { ok: true } | { ok: false; reason: "not-configured" | "auth" | "send"; detail?: string };

const SENDER_NAME = "빅토리 방송 일정표";

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const encodeWord = (text: string) => `=?UTF-8?B?${utf8ToBase64(text)}?=`;
const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();

/** RFC 2822 메시지(한글 제목·이름·본문은 UTF-8 base64). */
export function buildMime(to: string, subject: string, body: string): string {
  const headers = [
    `From: ${encodeWord(SENDER_NAME)} <${LEGAL_CONTACT_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${encodeWord(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64"
  ];
  return `${headers.join("\r\n")}\r\n\r\n${wrap76(utf8ToBase64(body.replace(/\r?\n/g, "\r\n")))}\r\n`;
}

const toBase64Url = (s: string) => utf8ToBase64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function gmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

export async function sendGmail(to: string, subject: string, body: string): Promise<SendResult> {
  if (!gmailConfigured()) return { ok: false, reason: "not-configured" };
  const tokenRes = await guardedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token"
    }).toString()
  }).catch(() => null);
  const token = tokenRes && tokenRes.ok ? ((await tokenRes.json().catch(() => null)) as { access_token?: string } | null)?.access_token : null;
  if (!token) return { ok: false, reason: "auth", detail: tokenRes ? String(tokenRes.status) : "network" };
  const sendRes = await guardedFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: toBase64Url(buildMime(to, subject, body)) })
  }).catch(() => null);
  if (!sendRes || !sendRes.ok) return { ok: false, reason: "send", detail: sendRes ? String(sendRes.status) : "network" };
  return { ok: true };
}
