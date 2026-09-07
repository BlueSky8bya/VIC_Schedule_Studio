"use client";

// 앰비언트 아트 보드(2026-09-04, 2026-09-07 개정) — 계절 배경의 모든 그림 자리(매니페스트)를 한 화면에서 관리한다: 지금 화면이 쓰는
// 대체물(코드 도형·이모지·실루엣) ↔ 납품된 PNG(`public/ambient/art/<id>.png`), 자리 규격(계절·카메라·크기·변형·도트 격자),
// 코덱스 프롬프트 복사(파일럿·보이는 것만·1차·2차·전체·자리별). 파일을 폴더에 넣고 새로고침하면 상태가 바뀐다(서버가 폴더를 읽는다).
// 개발자 전용(라우트가 막는다).
//
// 개정 내용(2026-09-07): ① **빈 자리**(대체물조차 없는 26자리)를 대기와 구분해 따로 세고 거른다 — 바이옴 정체성 결손이 여기 있다.
// ② **파일럿 배치**(ENTITY_ART_PLAN §4, 12장)를 자리마다 표시하고 그 프롬프트만 따로 뽑는다. ③ 자리마다 **도트 격자·블록·저장 변**을
// 보여 준다(결정 ⓐ′ — 코덱스가 지킬 수와 우리가 줄이는 배수가 한 화면에 있어야 어긋나지 않는다). ④ 카드 98장이 한 번에 대체물을
// 굽던 것을 **화면에 들어올 때만** 굽게 바꿨다(IntersectionObserver) + 카드 메모이즈 + 검색어 지연.

import type React from "react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, BookOpen, Check, ClipboardCopy, Image as ImageIcon, LayoutGrid, List, Search } from "lucide-react";
import "./ambient-art-board.css";
import {
  ART_DIR,
  ART_SLOTS,
  batchPrompt,
  CATEGORY_KO,
  codexMasterPrompt,
  dotBlock,
  dotGrid,
  NOW_KO,
  pilotFiles,
  pilotPrompt,
  pilotSlots,
  SEASON_KO,
  slotFiles,
  slotPrompt,
  sourceRatio,
  targetEdge,
  VIEW_SHORT,
  type ArtCategory,
  type ArtFileInfo,
  type ArtSlot,
  type PresentArt
} from "@/components/shared/ambient/art/manifest";
import { kstToday, type SeasonKey } from "@/components/shared/ambient/registry";
import { previewOf } from "@/components/shared/ambient/art/preview";
import { codexById, CODEX_KINDS, HABITAT_LABEL, KIND_LABEL, type CodexEntry } from "@/components/shared/ambient/world/codex";
import { BIOMES } from "@/components/shared/ambient/world/biomes";
import { TIER_DOTS, TIER_LABEL } from "@/components/shared/ambient/world/rarity";
import { BAND_LABEL } from "@/components/shared/ambient/world/time";
import { hapticTick } from "@/lib/ui/haptics";

type Props = {
  /** id → 폴더에 실제로 있는 파일들(서버가 읽음: 이름·바이트·픽셀) */
  present: PresentArt;
  /** 파일 갱신 시각(캐시 무효화용) */
  stamp: number;
};

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))}KB`;

const SEASONS: SeasonKey[] = ["spring", "summer", "autumn", "winter"];
/** 달 목록을 사람이 읽는 줄로 — 1~12 전부면 "사철", 이어진 구간은 "4~10월", 흩어지면 쉼표. */
function monthsLabel(months: readonly number[]): string {
  if (months.length >= 12) return "사철";
  const sorted = [...months].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const mo of sorted) {
    const last = runs[runs.length - 1];
    if (last && mo === last[1] + 1) last[1] = mo;
    else runs.push([mo, mo]);
  }
  // 12월과 1월이 이어지면 겨울을 가로지르는 한 구간이다(11~3월).
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 12) {
    const first = runs.shift()!;
    runs[runs.length - 1][1] = first[1] + 12;
  }
  return runs.map(([a, b]) => (a === b ? `${a}월` : `${a}~${((b - 1) % 12) + 1}월`)).join(", ");
}
/** 시간대 목록 — 여섯이면 "종일". */
const bandsLabel = (bands: readonly string[]): string =>
  bands.length >= 6 ? "종일" : bands.map((b) => BAND_LABEL[b as keyof typeof BAND_LABEL]).join("·");
const CATS: ArtCategory[] = ["tree", "plant", "ground", "water", "prop", "sky", "fish", "bug", "animal"];
const WAVES = [1, 2, 3] as const;
const MONTH_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** 지금 화면 필터 — "대기"를 다시 둘로 가른다: 대체물이라도 있는 자리 ↔ 아무것도 안 그려지는 자리. */
type NowFilter = "all" | "sub" | "none";
const NOW_FILTERS: { k: NowFilter; ko: string }[] = [
  { k: "all", ko: "지금 전부" },
  { k: "sub", ko: "대체물 있음" },
  { k: "none", ko: "빈 자리" }
];

type SortKey = "declared" | "empty" | "big";
const SORTS: { k: SortKey; ko: string }[] = [
  { k: "declared", ko: "선언 순" },
  { k: "empty", ko: "빈 자리 먼저" },
  { k: "big", ko: "큰 것 먼저" }
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** 카드 하나가 화면에 들어왔는가 — 자리 98개가 한꺼번에 대체물을 굽지 않게 한다(굽기는 캔버스 합성이라 카드당 수 ms).
 *  **관찰 대상은 카드 자체다.** 미리보기 칸은 `display: contents`라 상자가 없어서, 거기에 옵서버를 걸면 영영 교차하지 않는다. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

function NowPreview({ slot, seen }: { slot: ArtSlot; seen: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [none, setNone] = useState(false);
  useEffect(() => {
    if (!seen) return;
    const p = previewOf(slot.id);
    if (!p) {
      setNone(true);
      return;
    }
    if (p.kind === "url") {
      setUrl(p.src);
      return;
    }
    const host = ref.current;
    if (!host) return;
    host.replaceChildren(p.c);
    const [w, h] = slot.px;
    const k = Math.min(3, 96 / Math.max(w, h));
    p.c.style.width = `${Math.round(w * k)}px`;
    p.c.style.height = `${Math.round(h * k)}px`;
    return () => host.replaceChildren();
  }, [slot, seen, ref]);
  if (none) return <span className="art-empty">아무것도 안 그려짐</span>;
  if (url) return <Image alt="" loading="lazy" src={url} width={96} height={96} unoptimized />;
  return <div ref={ref} style={{ display: "contents" }} />;
}

type CardProps = { slot: ArtSlot; files: ArtFileInfo[]; stamp: number; onCopy: (text: string, label: string) => void; i: number };

/** 도감 표의 한 줄(2026-09-07) — 모여봐요 동물의 숲 도감 페이지와 **같은 형식**: 그림 · 이름 · 사는 곳 · 때 · 크기 ·
 *  희귀도 · **월별 열두 칸**. 열두 칸이 이 형식의 핵심이다 — "몇 월에 나오나"를 글로 읽는 것과 칸으로 보는 것은
 *  전혀 다른 일이고(“5~9월”은 읽어야 알지만 칸은 한눈에 들어온다), 종을 세로로 쌓았을 때 **달의 띠가 보인다**.
 *  내용은 우리 것이다 — 참고한 것은 표의 생김새뿐(ADR-0019 결정 3). */
const CodexRow = memo(function CodexRow({
  slot,
  entry,
  files,
  stamp,
  onCopy,
  month
}: {
  slot: ArtSlot;
  entry: CodexEntry;
  files: ArtFileInfo[];
  stamp: number;
  onCopy: (t: string, l: string) => void;
  month: number;
}) {
  const want = slotFiles(slot);
  const done = files.length >= want.length;
  const here = entry.months.includes(month);
  return (
    <tr data-state={done ? "done" : files.length ? "partial" : "todo"} data-now={here ? "1" : "0"}>
      <td className="cx-pic">
        <span className="art-cell">
          {files.length ? (
            <Image alt={slot.nameKo} height={40} loading="lazy" src={`${ART_DIR}/${files[0].file}?v=${stamp}`} unoptimized width={40} />
          ) : (
            <NowPreview seen slot={slot} />
          )}
        </span>
      </td>
      <td className="cx-name">
        <strong>{entry.nameKo}</strong>
        <code>{entry.id}</code>
      </td>
      <td className="cx-where">
        {entry.biomes.map((b) => BIOMES[b].nameKo).join("·")}
        <i>{HABITAT_LABEL[entry.habitat]}</i>
      </td>
      <td className="cx-when">{bandsLabel(entry.bands)}</td>
      <td className="cx-size">
        {entry.sizeCm[0]}~{entry.sizeCm[1]}cm
      </td>
      <td className={`cx-tier tier-${entry.tier}`} title={TIER_LABEL[entry.tier]}>
        {TIER_DOTS[entry.tier]}
      </td>
      <td className="cx-months">
        <span className="cx-mgrid">
          {MONTH_NUMS.map((mo) => (
            <i aria-hidden="true" className={entry.months.includes(mo) ? "on" : ""} data-now={mo === month ? "1" : "0"} key={mo} />
          ))}
        </span>
        <em>{monthsLabel(entry.months)}</em>
      </td>
      <td className="cx-do">
        <button className="art-btn small" data-act="art-slot-prompt-copy" onClick={() => onCopy(slotPrompt(slot), `${slot.nameKo} 프롬프트`)} type="button">
          <ClipboardCopy aria-hidden="true" size={12} />
        </button>
      </td>
    </tr>
  );
});

const Card = memo(function Card({ slot, files, stamp, onCopy, i }: CardProps) {
  const { ref, seen } = useInView<HTMLElement>();
  const want = slotFiles(slot);
  const done = files.length >= want.length;
  const partial = files.length > 0 && !done;
  const empty = !done && slot.now === "none";
  const ground = slot.seasons.length === 1 ? `ground-${slot.seasons[0]}` : "";
  // 저장 규격 — 1024의 정수 약수(128·256·512)만 쓴다. `npm run art:normalize`가 같은 수로 줄인다.
  const edge = targetEdge(slot.px);
  const heavy = files.some((f) => Math.max(f.w, f.h) > edge * 1.3 || f.bytes > 160 * 1024);
  // 옛 규격(lanczos3 시절)으로 줄여 둔 파일 — 변이 블록 배수가 아니면 도트가 이미 뭉개졌다는 신호다.
  const block = dotBlock(slot.px, slot.grid);
  const stale = files.some((f) => f.w % block !== 0 && f.h % block !== 0);
  const entry = codexById(slot.id);
  const pf = slot.pilot ? pilotFiles(slot) : [];
  const pfDone = pf.filter((n) => files.some((f) => f.file === n)).length;
  return (
    <article
      className={`art-card${done ? " done" : ""}`}
      data-slot={slot.id}
      ref={ref}
      data-state={done ? "done" : partial ? "partial" : empty ? "empty" : "todo"}
      style={{ "--i": Math.min(i, 24) } as React.CSSProperties}
    >
      <div className="art-card-title">
        <div>
          <strong>{slot.nameKo}</strong> <code>{slot.id}</code>
          {slot.pilot ? (
            <span className="art-pilot" title={`파일럿 배치 — 이번에 만들 ${slot.pilot}장: ${pf.join(", ")}`}>
              파일럿 {pfDone}/{slot.pilot}
            </span>
          ) : null}
        </div>
        <span className={`art-status${done ? " done" : partial ? " partial" : empty ? " empty" : ""}`}>
          {done ? "납품됨" : partial ? `${files.length}/${want.length}` : empty ? "빈 자리" : "대기"}
        </span>
      </div>
      <div className="art-pair">
        <div className="art-pane">
          <span>지금 · {NOW_KO[slot.now]}</span>
          <div className={`art-cell ${ground}`}>
            <NowPreview seen={seen} slot={slot} />
          </div>
        </div>
        <div className="art-pane">
          <span>그림 · PNG</span>
          <div className={`art-cell ${ground}`}>
            {files.length ? (
              <Image alt={slot.nameKo} loading="lazy" src={`${ART_DIR}/${files[0].file}?v=${stamp}`} width={120} height={120} unoptimized />
            ) : (
              <span className="art-empty">
                <ImageIcon aria-hidden="true" size={16} />
                <br />
                {want.join(" · ")}
              </span>
            )}
            {files.length ? (
              <span className="art-files">
                {files.length > 1 ? `${files.length}장 · ` : ""}
                {files[0].w}×{files[0].h} · {kb(files[0].bytes)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {heavy ? (
        <p className="art-heavy" data-art-heavy>
          원본이 크다({files.map((f) => `${f.w}×${f.h} ${kb(f.bytes)}`).join(", ")}) — 저장 목표 {edge}px. <code>npm run art:normalize</code>로 줄인다(화면은 같다).
        </p>
      ) : null}
      {stale && !heavy ? (
        <p className="art-heavy" data-art-stale>
          변이 블록 {block}px의 배수가 아니다 — 옛 규격(lanczos3)으로 줄인 파일이라 도트가 이미 뭉개졌다. 1024 원본에서 다시 뽑아야 한다.
        </p>
      ) : null}
      <div className="art-body">
        <div className="art-meta">
          <span>
            <b>계절</b> {slot.seasons.map((k) => SEASON_KO[k]).join("·")}
          </span>
          <span>
            <b>카메라</b> {VIEW_SHORT[slot.view]}
          </span>
          <span title={`화면 ${slot.px[0]}×${slot.px[1]}px · 1024 캔버스를 ${dotGrid(slot.px, slot.grid)}칸으로 보고 그린다(도트 한 칸 = ${block}×${block}px 블록)`}>
            <b>규격</b> {slot.px[0]}×{slot.px[1]} · {dotGrid(slot.px, slot.grid)}칸 {block}px
          </span>
          {slot.variants && slot.variants > 1 ? (
            <span>
              <b>변형</b> {slot.variants}
            </span>
          ) : null}
          {slot.acnhRef ? (
            <span>
              <b>동숲</b> {slot.acnhRef}
            </span>
          ) : null}
        </div>
        {entry ? (
          // 도감 줄 — 알약 일곱 개를 늘어놓으면 카드가 색종이가 된다(자리 206개 × 7 = 화면이 못 읽힌다).
          // 사실은 많지만 **한 줄**로 읽히게: 사는 곳 → 서식면 → 달 → 때 → 크기, 희귀도만 점으로 앞에 세운다.
          <p className="art-codex" title={`${KIND_LABEL[entry.kind]} · ${TIER_LABEL[entry.tier]}`}>
            <b className={`art-tier tier-${entry.tier}`}>{TIER_DOTS[entry.tier]}</b>
            <span>{entry.biomes.map((b) => BIOMES[b].nameKo).join("·")}</span>
            <span>{HABITAT_LABEL[entry.habitat]}</span>
            <span>{monthsLabel(entry.months)}</span>
            <span>{bandsLabel(entry.bands)}</span>
            <span>
              {entry.sizeCm[0]}~{entry.sizeCm[1]}cm
            </span>
          </p>
        ) : null}
        <p className="art-brief" title={slot.brief}>{slot.brief}</p>
        {entry ? <p className="art-blurb">“{entry.blurb}”</p> : null}
      </div>
      <div className="art-card-foot">
        <code style={{ fontSize: 11, color: "var(--ink-soft, #4a4466)" }}>
          {want.join(", ")} · 저장 {edge}px ÷{sourceRatio(slot.px)}
        </code>
        <button className="art-btn small" data-act="art-slot-prompt-copy" onClick={() => onCopy(slotPrompt(slot), `${slot.nameKo} 프롬프트`)} type="button">
          <ClipboardCopy aria-hidden="true" size={13} /> 프롬프트
        </button>
      </div>
    </article>
  );
});

export function AmbientArtBoard({ present, stamp }: Props) {
  const [season, setSeason] = useState<SeasonKey | "all">("all");
  const [cat, setCat] = useState<ArtCategory | "all">("all");
  const [state, setState] = useState<"all" | "todo" | "done">("all");
  const [nowF, setNowF] = useState<NowFilter>("all");
  const [pilotOnly, setPilotOnly] = useState(false);
  // 생성 차수 — 도감 종에만 있다(1 = 바이옴 정체성부터, 3 = 마지막). 장식 자리는 차수가 없어 "전부"에서만 보인다.
  const [wave, setWave] = useState<"all" | 1 | 2 | 3>("all");
  // 밀도 — 카드(그림을 본다) / 목록(129종을 훑는다). 자리가 206개가 되면서 "훑기"가 별개의 일이 됐다.
  // DOM은 같고 CSS만 바뀐다(`data-density`) — 두 벌을 만들면 둘이 어긋난다.
  const [density, setDensity] = useState<"card" | "list" | "table">("card");
  // 지금 달(KST) — 도감 표에서 "이번 달" 열을 표시한다. 동숲 도감을 볼 때 제일 먼저 찾는 것이 그것이다.
  const nowMonth = useMemo(() => kstToday().m, []);
  const [sort, setSort] = useState<SortKey>("declared");
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q); // 타이핑마다 100장을 다시 거르지 않는다
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // 스티키 도구 줄 — 붙는 순간에만 배경·그림자를 켠다(늘 켜 두면 머리글이 답답하다).
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const onScroll = () => el.setAttribute("data-stuck", el.getBoundingClientRect().top <= 0.5 ? "1" : "0");
    onScroll();
    // 갈래 머리(.art-section h2)가 **도구 줄 바로 아래**에 붙어야 한다 — 상수로 박으면 필터가 한 줄 늘 때마다
    // 머리가 도구 줄 뒤로 숨는다(실제로 58px로 박아 두고 숨었다). 높이를 재서 변수로 넘긴다.
    // 변수는 **보드 뿌리**에 심는다 — 갈래 머리는 도구 줄의 자식이 아니라 형제라, 줄 자신에게 심으면 닿지 않는다.
    const root = el.closest<HTMLElement>("[data-art-board]");
    const setH = () => root?.style.setProperty("--ab-bar-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  // "/"로 검색으로 뛴다 — 자리가 100개라 스크롤보다 이름을 치는 쪽이 빠르다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isDone = useCallback((s: ArtSlot) => (present[s.id]?.length ?? 0) >= slotFiles(s).length, [present]);

  const stats = useMemo(() => {
    let done = 0;
    let p1 = 0;
    let p1done = 0;
    let empty = 0;
    let pilotWant = 0;
    let pilotDone = 0;
    for (const s of ART_SLOTS) {
      const ok = isDone(s);
      if (ok) done++;
      if (!ok && s.now === "none") empty++;
      if (s.phase === 1) {
        p1++;
        if (ok) p1done++;
      }
      if (s.pilot) {
        const want = pilotFiles(s);
        pilotWant += want.length;
        pilotDone += want.filter((n) => (present[s.id] ?? []).some((f) => f.file === n)).length;
      }
    }
    // 도감 세 권 — 종 자리(2차)만 센다. 진행률의 분모가 "그릴 자리 수"라야 도감 화면의 진행률과 같은 뜻이 된다.
    const books = CODEX_KINDS.map((k) => {
      const list = ART_SLOTS.filter((sl) => sl.phase === 2 && sl.category === (k as string));
      return { kind: k, total: list.length, done: list.filter((sl) => isDone(sl)).length };
    });
    return { total: ART_SLOTS.length, done, p1, p1done, empty, pilotWant, pilotDone, books };
  }, [present, isDone]);

  const visible = useMemo(() => {
    const n = dq.trim().toLowerCase();
    const list = ART_SLOTS.filter((s) => {
      if (pilotOnly && !s.pilot) return false;
      if (wave !== "all" && (codexById(s.id)?.wave ?? 0) !== wave) return false;
      if (season !== "all" && !s.seasons.includes(season)) return false;
      if (cat !== "all" && s.category !== cat) return false;
      const ok = isDone(s);
      if (state === "done" && !ok) return false;
      if (state === "todo" && ok) return false;
      if (nowF === "none" && s.now !== "none") return false;
      if (nowF === "sub" && s.now === "none") return false;
      if (n && !s.id.includes(n) && !s.nameKo.includes(dq.trim()) && !s.nameEn.toLowerCase().includes(n)) return false;
      return true;
    });
    if (sort === "big") return [...list].sort((a, b) => Math.max(b.px[0], b.px[1]) - Math.max(a.px[0], a.px[1]));
    if (sort === "empty") return [...list].sort((a, b) => Number(b.now === "none") - Number(a.now === "none"));
    return list;
  }, [season, cat, state, nowF, pilotOnly, wave, sort, dq, isDone]);

  // 카드 100장을 메모이즈하려면 넘기는 함수가 렌더마다 새로 만들어지면 안 된다 — setState·hapticTick만 쓰므로 의존성이 없다.
  const copy = useCallback(async (text: string, label: string) => {
    hapticTick();
    const ok = await copyText(text);
    setToast(ok ? `${label} 복사됨 (${text.length.toLocaleString()}자)` : "복사 실패 — 브라우저가 막았습니다");
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
    if (ok) hapticTick();
  }, []);

  // 아직 안 온 파일들(보이는 자리 기준) — **자리가 아니라 파일** 단위다. 변형이 둘인 자리는 한 장만 와 있을 수 있다
  // (소나무 -1은 배달, -2는 아직). 자리 단위로 다시 부탁하면 이미 합격한 그림을 다시 만들게 된다.
  const missingFiles = useMemo(() => {
    const out: string[] = [];
    for (const s of visible) {
      const have = present[s.id] ?? [];
      for (const f of slotFiles(s)) if (!have.some((p2) => p2.file === f)) out.push(f);
    }
    return out;
  }, [visible, present]);

  // 자리가 206개가 되면서 "1차 / 2차" 두 덩어리로는 못 읽는다 — **갈래별로** 나누고 머리를 스티키로 붙인다.
  // 순서는 화면에서의 층 순서와 같다: 땅에 선 것 → 땅 → 물 → 하늘 → 그 안에 사는 것.
  const groups = useMemo(() => {
    const order: ArtCategory[] = ["tree", "plant", "ground", "water", "prop", "sky", "fish", "bug", "animal"];
    return order
      .map((k) => {
        const list = visible.filter((s2) => s2.category === k);
        const all = ART_SLOTS.filter((s2) => s2.category === k);
        return { key: k, list, done: all.filter((s2) => isDone(s2)).length, total: all.length };
      })
      .filter((g) => g.list.length > 0);
  }, [visible, isDone]);
  const visibleFiles = visible.reduce((n, s) => n + slotFiles(s).length, 0);
  const pilotCount = pilotSlots().reduce((n, s) => n + pilotFiles(s).length, 0);

  return (
    <main className="art-board" data-art-board data-density={density}>
      <header className="art-board-head">
        <div>
          <a className="art-back" href="/studio">
            <ArrowLeft aria-hidden="true" size={12} /> 편집실
          </a>
          <h1>계절 배경 아트 보드</h1>
          <p>
            자리마다 그림 한 장. 만든 PNG를 <code>public/ambient/art/</code>에 표의 id 이름으로 넣으면 장면이 그 그림을 쓴다 — 없으면 지금의
            대체물이 그대로 나온다. 프롬프트는 이 표에서 만들어져 어긋나지 않는다. 생성기 원본은 <b>1024 정사각</b>(그 아래를 못 준다),
            저장은 <code>npm run art:normalize</code>가 <b>1024의 정수 약수</b>(128·256·512)로 <b>nearest 정수배</b> 축소한다 — 카드의
            <b> 격자</b>가 코덱스가 지킬 도트 크기다. (<code>next dev</code>는 새로고침으로 즉시, 운영은 커밋·배포 — 프로덕션 서버는 시작
            때의 <code>public/</code> 목록만 낸다.)
          </p>
        </div>
        <div className="art-board-stats">
          <div className="art-stat">
            <b>
              {stats.pilotDone}
              <i>/{stats.pilotWant}</i>
            </b>
            <span>파일럿 · {stats.pilotWant}장</span>
            <span className="art-bar">
              <i style={{ width: `${Math.round((stats.pilotDone / Math.max(1, stats.pilotWant)) * 100)}%` }} />
            </span>
          </div>
          <div className="art-stat">
            <b>
              {stats.done}
              <i>/{stats.total}</i>
            </b>
            <span>전체 자리</span>
            <span className="art-bar">
              <i style={{ width: `${Math.round((stats.done / Math.max(1, stats.total)) * 100)}%` }} />
            </span>
          </div>
          {stats.books.map((b) => (
            <div className="art-stat" key={b.kind}>
              <b>
                {b.done}
                <i>/{b.total}</i>
              </b>
              <span>도감 · {KIND_LABEL[b.kind]}</span>
              <span className="art-bar">
                <i style={{ width: `${Math.round((b.done / Math.max(1, b.total)) * 100)}%` }} />
              </span>
            </div>
          ))}
          <div className="art-stat">
            <b>{stats.empty}</b>
            <span>빈 자리 · 대체물도 없음</span>
            <span className="art-bar">
              <i className="warn" style={{ width: `${Math.round((stats.empty / Math.max(1, stats.total)) * 100)}%` }} />
            </span>
          </div>
        </div>
      </header>
      <div className="art-board-bar" ref={barRef}>
        <div className="art-board-bar-inner">
          <div className="art-board-actions">
            <button className="art-btn primary" data-act="art-prompt-copy-pilot" onClick={() => void copy(pilotPrompt(), "파일럿 프롬프트")} type="button">
              <ClipboardCopy aria-hidden="true" size={14} /> 파일럿 프롬프트 — {pilotCount}장
            </button>
            <button
              className="art-btn"
              data-act="art-prompt-copy-visible"
              disabled={!visible.length}
              onClick={() => void copy(batchPrompt(visible, `보이는 자리 ${visible.length}개`), "보이는 자리 프롬프트")}
              type="button"
            >
              <ClipboardCopy aria-hidden="true" size={14} /> 보이는 것만 — 자리 {visible.length} · 파일 {visibleFiles}
            </button>
            <button
              className="art-btn"
              data-act="art-prompt-copy-missing"
              disabled={!missingFiles.length}
              onClick={() =>
                void copy(
                  batchPrompt(visible, `아직 안 온 파일 ${missingFiles.length}장`, {
                    files: missingFiles,
                    note: `**이미 배달돼 합격한 파일은 표에 없다.** 화풍의 기준선은 \`public/ambient/art/tree-pine-1.png\` · \`tree-pine-autumn-1.png\` · \`tree-pine-winter-1.png\` 세 장이다 — 새 그림은 이 셋과 나란히 놓아 한 세트로 보여야 한다.`
                  }),
                  "남은 파일 프롬프트"
                )
              }
              type="button"
            >
              <ClipboardCopy aria-hidden="true" size={14} /> 남은 파일만 — {missingFiles.length}장
            </button>
            <button className="art-btn" data-act="art-prompt-copy-1" onClick={() => void copy(codexMasterPrompt(1), "1차 프롬프트")} type="button">
              <ClipboardCopy aria-hidden="true" size={14} /> 1차(초목·지형)
            </button>
            <button className="art-btn" data-act="art-prompt-copy-2" onClick={() => void copy(codexMasterPrompt(2), "2차 프롬프트")} type="button">
              <ClipboardCopy aria-hidden="true" size={14} /> 2차(생물)
            </button>
            <button className="art-btn" data-act="art-prompt-copy-all" onClick={() => void copy(codexMasterPrompt(), "전체 프롬프트")} type="button">
              <ClipboardCopy aria-hidden="true" size={14} /> 전체
            </button>
          </div>
          <div className="art-board-filters" role="group" aria-label="필터">
            <div className="art-seg" role="group" aria-label="보기 밀도">
              <button aria-pressed={density === "card"} className="art-chip" onClick={() => setDensity("card")} type="button">
                <LayoutGrid aria-hidden="true" size={12} /> 카드
              </button>
              <button aria-pressed={density === "list"} className="art-chip" onClick={() => setDensity("list")} type="button">
                <List aria-hidden="true" size={12} /> 목록
              </button>
              <button aria-pressed={density === "table"} className="art-chip" onClick={() => setDensity("table")} type="button">
                <BookOpen aria-hidden="true" size={12} /> 도감
              </button>
            </div>
            <div className="art-seg" role="group" aria-label="계절">
              <button aria-pressed={season === "all"} className="art-chip" onClick={() => setSeason("all")} type="button">
                사철
              </button>
              {SEASONS.map((k) => (
                <button aria-pressed={season === k} className="art-chip" key={k} onClick={() => setSeason(k)} type="button">
                  {SEASON_KO[k]}
                </button>
              ))}
            </div>
            <div className="art-seg" role="group" aria-label="갈래">
              <button aria-pressed={cat === "all"} className="art-chip" onClick={() => setCat("all")} type="button">
                전부
              </button>
              {CATS.map((k) => (
                <button aria-pressed={cat === k} className="art-chip" key={k} onClick={() => setCat(k)} type="button">
                  {CATEGORY_KO[k]}
                </button>
              ))}
            </div>
            <div className="art-seg" role="group" aria-label="생성 차수">
              <button aria-pressed={wave === "all"} className="art-chip" onClick={() => setWave("all")} type="button">
                차수 전부
              </button>
              {WAVES.map((w) => (
                <button aria-pressed={wave === w} className="art-chip" key={w} onClick={() => setWave(w)} type="button">
                  {w}차
                </button>
              ))}
            </div>
            <div className="art-seg" role="group" aria-label="납품 상태">
              <button aria-pressed={state === "all"} className="art-chip" onClick={() => setState("all")} type="button">
                상태 전부
              </button>
              <button aria-pressed={state === "todo"} className="art-chip" onClick={() => setState("todo")} type="button">
                대기
              </button>
              <button aria-pressed={state === "done"} className="art-chip" onClick={() => setState("done")} type="button">
                납품됨
              </button>
            </div>
            <div className="art-seg" role="group" aria-label="지금 화면">
              {NOW_FILTERS.map(({ k, ko }) => (
                <button aria-pressed={nowF === k} className="art-chip" key={k} onClick={() => setNowF(k)} type="button">
                  {ko}
                </button>
              ))}
            </div>
            <div className="art-seg" role="group" aria-label="정렬">
              {SORTS.map(({ k, ko }) => (
                <button aria-pressed={sort === k} className="art-chip" key={k} onClick={() => setSort(k)} type="button">
                  {ko}
                </button>
              ))}
            </div>
            <div className="art-seg" role="group" aria-label="파일럿">
              <button aria-pressed={pilotOnly} className="art-chip" onClick={() => setPilotOnly((v) => !v)} type="button">
                파일럿만
              </button>
            </div>
            <label className="art-search">
              <Search aria-hidden="true" size={13} />
              <input onChange={(e) => setQ(e.target.value)} placeholder="이름·id 찾기 (/)" ref={searchRef} type="search" value={q} />
            </label>
          </div>
        </div>
      </div>
      {groups.map((g) => (
        <section className="art-section" key={g.key}>
          <h2>
            {CATEGORY_KO[g.key]}
            <small>
              {g.list.length}자리{g.list.length !== g.total ? ` / ${g.total}` : ""}
            </small>
            <span className="art-sec-bar" title={`${g.done} / ${g.total} 납품됨`}>
              <i style={{ width: `${Math.round((g.done / Math.max(1, g.total)) * 100)}%` }} />
            </span>
            <em>
              {g.done}/{g.total}
            </em>
          </h2>
          {density === "table" && (g.key === "fish" || g.key === "bug" || g.key === "animal") ? (
            <div className="cx-wrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">그림</th>
                    <th scope="col">이름</th>
                    <th scope="col">사는 곳</th>
                    <th scope="col">때</th>
                    <th scope="col">크기</th>
                    <th scope="col">희귀도</th>
                    <th scope="col">
                      나오는 달
                      <span className="cx-mhead" aria-hidden="true">
                        {MONTH_NUMS.map((mo) => (
                          <i data-now={mo === nowMonth ? "1" : "0"} key={mo}>
                            {mo}
                          </i>
                        ))}
                      </span>
                    </th>
                    <th scope="col">
                      <span className="sr-only">프롬프트</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.list.map((s2) => {
                    const e2 = codexById(s2.id);
                    return e2 ? (
                      <CodexRow entry={e2} files={present[s2.id] ?? []} key={s2.id} month={nowMonth} onCopy={copy} slot={s2} stamp={stamp} />
                    ) : null;
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="art-grid">
              {g.list.map((s, i) => (
                <Card files={present[s.id] ?? []} i={i} key={s.id} onCopy={copy} slot={s} stamp={stamp} />
              ))}
            </div>
          )}
        </section>
      ))}
      {!groups.length ? <p className="art-none">조건에 맞는 자리가 없다. 필터를 풀어 보라.</p> : null}
      {toast ? (
        <div className="art-toast" role="status">
          <Check aria-hidden="true" size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {toast}
        </div>
      ) : null}
    </main>
  );
}
