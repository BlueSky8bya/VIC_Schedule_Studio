"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { isDeveloperOrFixture } from "@/lib/auth/fixture-dev";
import {
  buildYearArchive,
  canOverwriteYear,
  isYearClosed,
  kstYearMonth,
  listArchiveYears,
  readYearArchive,
  type ArchiveMonth,
  type BuildReport
} from "@/lib/insights/archive";

// 설정 → 개발자 → '연간 인사이트 보관함'(0160·0164). 개발자만. 한 해 통째로만 만든다 — 12월 31일이 지난 해만.
const SLUG = "vic";
const DENIED = { ok: false as const, error: "개발자만 볼 수 있는 화면입니다." };

async function isDeveloper(): Promise<boolean> {
  return isDeveloperOrFixture(await resolveCurrentActor(SLUG));
}

export async function listInsightsArchiveYearsAction(): Promise<
  { ok: true; years: number[]; currentYear: number } | { ok: false; error: string }
> {
  if (!(await isDeveloper())) return DENIED;
  return { ok: true, years: await listArchiveYears(), currentYear: kstYearMonth().year };
}

export async function getInsightsArchiveAction(
  year: number
): Promise<{ ok: true; months: ArchiveMonth[]; canBuild: boolean } | { ok: false; error: string }> {
  if (!(await isDeveloper())) return DENIED;
  if (!Number.isInteger(year)) return { ok: false, error: "연도가 올바르지 않아요." };
  const r = await readYearArchive(year);
  if ("error" in r) return { ok: false, error: r.error };
  // 끝난 해만 만들고, 이미 있는 해는 원본 삭제가 시작될 수 없는 동안만 다시 만든다(빈 원본으로 덮지 않게).
  const canBuild = isYearClosed(year) && (r.months.length === 0 || canOverwriteYear(year, r.months));
  return { ok: true, months: r.months, canBuild };
}

/** 한 번에 약 20초까지 만들고 남은 달을 돌려준다 — 화면이 remaining이 빌 때까지 다시 부른다. */
export async function buildInsightsArchiveAction(
  year: number,
  only?: number[]
): Promise<{ ok: true; report: BuildReport } | { ok: false; error: string }> {
  if (!(await isDeveloper())) return DENIED;
  if (!Number.isInteger(year)) return { ok: false, error: "연도가 올바르지 않아요." };
  if (!isYearClosed(year)) return { ok: false, error: "12월 31일이 지나야 만들 수 있어요." };
  const months = Array.isArray(only) ? only.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12) : undefined;
  // 버튼 = 다시 계산(원본 삭제가 시작됐을 수 있는 해는 buildYearArchive가 없는 달만으로 낮춘다). 이어 하기는 남은 달만.
  const r = await buildYearArchive({ year, mode: "all", only: months, deadlineMs: Date.now() + 20_000 });
  return "error" in r ? { ok: false, error: r.error } : { ok: true, report: r };
}
