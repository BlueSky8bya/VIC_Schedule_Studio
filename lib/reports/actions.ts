"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { isDeveloperOrFixture } from "@/lib/auth/fixture-dev";
import { canEditSchedule } from "@/lib/permissions/roles";
import { countUnseenReports, deleteReport, getReplyEmail, setReportDone, setReportReplied } from "@/lib/reports/report";
import { sendGmail } from "@/lib/reports/gmail";
import { REPORT_OWNER_VISIBLE_FROM } from "@/lib/reports/topics";

// 제보함 보기·처리·삭제 — 관리자와 개발자(2026-11-23 소유자: 개발자가 자리를 비워도 관리자가 볼 수 있게).
// 서버가 액터를 다시 확인한다.
async function allowed(): Promise<boolean> {
  const actor = await resolveCurrentActor("vic");
  return canEditSchedule(actor.role) || isDeveloperOrFixture(actor);
}

// 답장 자동 발송은 개발자 문의 계정(Gmail)으로 나가므로 개발자만.
async function canSendReply(): Promise<boolean> {
  return isDeveloperOrFixture(await resolveCurrentActor("vic"));
}

export async function setReportDoneAction(id: string, done: boolean): Promise<{ ok: boolean }> {
  if (!(await allowed()) || typeof id !== "string" || !id) return { ok: false };
  return { ok: await setReportDone(id, done) };
}

export async function setReportRepliedAction(id: string, replied: boolean): Promise<{ ok: boolean }> {
  if (!(await allowed()) || typeof id !== "string" || !id) return { ok: false };
  return { ok: await setReportReplied(id, replied) };
}

/** 헤더 제보함 단추 숫자(관리자·개발자, 아니면 null). */
export async function getUnseenReportCountAction(): Promise<number | null> {
  if (!(await allowed())) return null;
  // 개발자는 전부, 관리자는 새 안내 이후에 받은 제보만 센다(page와 같은 범위).
  return countUnseenReports((await canSendReply()) ? undefined : REPORT_OWNER_VISIBLE_FROM);
}

/** 답장 자동 발송 — Gmail API(lib/reports/gmail.ts). 성공하면 답장함으로 표시한다. */
export async function sendReplyAction(
  id: string,
  subject: string,
  body: string
): Promise<{ ok: true } | { ok: false; reason: "denied" | "no-email" | "invalid" | "not-configured" | "auth" | "send" }> {
  if (!(await canSendReply())) return { ok: false, reason: "denied" };
  if (typeof id !== "string" || !id || typeof subject !== "string" || typeof body !== "string") return { ok: false, reason: "invalid" };
  const s = subject.trim().slice(0, 200);
  const b = body.slice(0, 20000);
  if (!s || !b.trim()) return { ok: false, reason: "invalid" };
  const to = await getReplyEmail(id);
  if (!to) return { ok: false, reason: "no-email" };
  const sent = await sendGmail(to, s, b);
  if (!sent.ok) return { ok: false, reason: sent.reason };
  await setReportReplied(id, true);
  return { ok: true };
}

export async function deleteReportAction(id: string): Promise<{ ok: boolean }> {
  if (!(await allowed()) || typeof id !== "string" || !id) return { ok: false };
  return { ok: await deleteReport(id) };
}
