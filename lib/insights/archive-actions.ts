"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { isDeveloperOrFixture } from "@/lib/auth/fixture-dev";
import {
  buildYearArchive,
  kstYearMonth,
  listArchiveYears,
  readYearArchive,
  FIRST_ARCHIVE_YEAR,
  type ArchiveMonth,
  type BuildReport
} from "@/lib/insights/archive";

// 설정 → 개발자 → '지난 해 인사이트'(0160). 개발자만. 숫자 아카이브를 읽고, 시험용으로 지금 만들 수 있다.
const SLUG = "vic";
const DENIED = { ok: false as const, error: "개발자만 볼 수 있는 화면입니다." };

async function isDeveloper(): Promise<boolean> {
  return isDeveloperOrFixture(await resolveCurrentActor(SLUG));
}

export async function listInsightsArchiveYearsAction(): Promise<{ ok: true; years: number[] } | { ok: false; error: string }> {
  if (!(await isDeveloper())) return DENIED;
  const stored = await listArchiveYears();
  const cur = kstYearMonth().year;
  // 만들 수 있는 해(올해·지난해)도 고를 수 있게 — 아직 비어 있어도 '지금 만들기'로 시험한다.
  const years = [...new Set([...stored, cur, cur - 1].filter((y) => y >= FIRST_ARCHIVE_YEAR))].sort((a, b) => b - a);
  return { ok: true, years };
}

export async function getInsightsArchiveAction(
  year: number
): Promise<{ ok: true; months: ArchiveMonth[] } | { ok: false; error: string }> {
  if (!(await isDeveloper())) return DENIED;
  if (!Number.isInteger(year)) return { ok: false, error: "연도가 올바르지 않아요." };
  const r = await readYearArchive(year);
  return "error" in r ? { ok: false, error: r.error } : { ok: true, months: r.months };
}

/** 한 번에 약 20초까지 만들고 남은 달을 돌려준다 — 화면이 remaining이 빌 때까지 다시 부른다. */
export async function buildInsightsArchiveAction(
  year: number,
  only?: number[]
): Promise<{ ok: true; report: BuildReport } | { ok: false; error: string }> {
  if (!(await isDeveloper())) return DENIED;
  if (!Number.isInteger(year)) return { ok: false, error: "연도가 올바르지 않아요." };
  const months = Array.isArray(only) ? only.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12) : undefined;
  // 버튼 = 다시 계산(원본 삭제가 열린 해는 buildYearArchive가 없는 달만으로 낮춘다). 이어 하기는 남은 달만.
  const r = await buildYearArchive({ year, mode: "all", only: months, deadlineMs: Date.now() + 20_000 });
  return "error" in r ? { ok: false, error: r.error } : { ok: true, report: r };
}
