import { notFound } from "next/navigation";
import { BiomeFixture } from "@/components/shared/ambient/biome-fixture";
import { isSeasonKey, type SeasonKey } from "@/components/shared/ambient/registry";
import { isBiomeKey, type BiomeKey } from "@/components/shared/ambient/world/biomes";
import { DAY_BANDS, type DayBand } from "@/components/shared/ambient/world/time";
import { WEATHER_LABEL, type Weather } from "@/components/shared/ambient/world/weather";

// 바이옴 결정적 fixture(2026-09-05, PLAN-20260905-005 P0) — 검증 전용. `VISUAL_TEST_FIXTURE=1`일 때만 열린다(프로덕션 404).
// 달력·크롬 없이 캔버스 하나. 파라미터(전부 선택, 기본값 = 초원·봄·점심·맑음·시드 42·t 0):
//   biome=meadow|forest|mountain|hill|pond|valley|tidal|sandy|rocky|sea|deep
//   season=spring|summer|autumn|winter   band=dawn|morning|noon|dusk|evening|night   weather=clear|cloud|rain|snow|fog|wind
//   seed=42   t=1500(ms, 이 시각의 프레임을 결정적으로)   load=1(여력 0~1)   pointer=x,y(포인터 고정; 없으면 화면 밖)
//   camera=showcase|plain   y=2026
// 날씨는 항상 강제된다(기본 clear) — 오늘 날짜에 따라 달라지는 시드 날씨가 프레임에 끼지 않게.
export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

const num = (v: string | undefined, def: number, lo = -Infinity, hi = Infinity) => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

export default async function BiomeFixturePage({ searchParams }: { searchParams?: Promise<SP> }) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const sp = (await searchParams) ?? {};
  const season: SeasonKey = isSeasonKey(sp.season) ? sp.season : "spring";
  const biome: BiomeKey = isBiomeKey(sp.biome) ? sp.biome : "meadow";
  const band: DayBand = (DAY_BANDS as readonly string[]).includes(sp.band ?? "") ? (sp.band as DayBand) : "noon";
  const weather: Weather = sp.weather && sp.weather in WEATHER_LABEL ? (sp.weather as Weather) : "clear";
  const seed = Math.round(num(sp.seed, 42, 0, 2 ** 31));
  const t = num(sp.t, 0, 0, 600_000);
  const load = num(sp.load, 1, 0, 1);
  const year = Math.round(num(sp.y, 2026, 2000, 2100));
  let pointer: { x: number; y: number } | null = null;
  if (sp.pointer) {
    const [px, py] = sp.pointer.split(",").map(Number);
    if (Number.isFinite(px) && Number.isFinite(py)) pointer = { x: px, y: py };
  }
  const camera = sp.camera === "plain" ? "plain" : "showcase";
  return (
    <BiomeFixture
      camera={camera}
      force={{ biome, band, weather, seed, load, pointer, freeze: true, pin: true }}
      season={season}
      t={t}
      year={year}
    />
  );
}
