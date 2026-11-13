"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { isDeveloperOrFixture } from "@/lib/auth/fixture-dev";
import { deleteReport, setReportDone, setReportReplied } from "@/lib/reports/report";

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

export async function deleteReportAction(id: string): Promise<{ ok: boolean }> {
  if (!(await allowed()) || typeof id !== "string" || !id) return { ok: false };
  return { ok: await deleteReport(id) };
}
