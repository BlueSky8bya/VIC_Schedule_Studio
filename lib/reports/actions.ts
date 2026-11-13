"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { isDeveloperOrFixture } from "@/lib/auth/fixture-dev";
import { countUnseenReports, deleteReport, getReplyEmail, setReportDone, setReportReplied } from "@/lib/reports/report";
import { sendGmail } from "@/lib/reports/gmail";

// 제보함 조작 — 개발자만. 서버가 액터를 다시 확인한다.
async function allowed(): Promise<boolean> {
  const actor = await resolveCurrentActor("vic");
  return actor.role === "developer" || isDeveloperOrFixture(actor);
}

export async function setReportDoneAction(id: string, done: boolean): Promise<{ ok: boolean }> {
  if (!(await allowed()) || typeof id !== "string" || !id) return { ok: false };
  return { ok: await setReportDone(id, done) };
}

export async function setReportRepliedAction(id: string, replied: boolean): Promise<{ ok: boolean }> {
  if (!(await allowed()) || typeof id !== "string" || !id) return { ok: false };
  return { ok: await setReportReplied(id, replied) };
}

/** 헤더 제보함 단추 숫자(개발자만, 아니면 null). */
export async function getUnseenReportCountAction(): Promise<number | null> {
  if (!(await allowed())) return null;
  return countUnseenReports();
}

/** 답장 자동 발송 — Gmail API(lib/reports/gmail.ts). 성공하면 답장함으로 표시한다. */
export async function sendReplyAction(
  id: string,
  subject: string,
  body: string
): Promise<{ ok: true } | { ok: false; reason: "denied" | "no-email" | "invalid" | "not-configured" | "auth" | "send" }> {
  if (!(await allowed())) return { ok: false, reason: "denied" };
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
