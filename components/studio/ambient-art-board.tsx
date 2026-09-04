"use client";

// 앰비언트 아트 보드(2026-09-04) — 계절 배경의 모든 그림 자리(매니페스트)를 한 화면에서 관리한다: 지금 화면이 쓰는 대체물(코드 도형·
// 이모지·실루엣) ↔ 납품된 PNG(`public/ambient/art/<id>.png`), 자리 규격(계절·카메라·크기·변형), 코덱스 프롬프트 복사(전체·1차·2차·
// 자리별). 파일을 폴더에 넣고 새로고침하면 상태가 바뀐다(서버가 폴더를 읽는다). 개발자 전용(라우트가 막는다).

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Check, ClipboardCopy, Image as ImageIcon } from "lucide-react";
import "./ambient-art-board.css";
import {
  ART_DIR,
  ART_SLOTS,
  CATEGORY_KO,
  codexMasterPrompt,
  NOW_KO,
  SEASON_KO,
  slotFiles,
  slotPrompt,
  VIEW_SHORT,
  type ArtCategory,
  type ArtSlot
} from "@/components/shared/ambient/art/manifest";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { previewOf } from "@/components/shared/ambient/art/preview";
import { hapticTick } from "@/lib/ui/haptics";

type Props = {
  /** id → 폴더에 실제로 있는 파일들(서버가 읽음) */
  present: Record<string, string[]>;
  /** 파일 갱신 시각(캐시 무효화용) */
  stamp: number;
};

const SEASONS: SeasonKey[] = ["spring", "summer", "autumn", "winter"];
const CATS: ArtCategory[] = ["tree", "plant", "ground", "water", "prop", "fish", "bug", "animal"];

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

function NowPreview({ slot }: { slot: ArtSlot }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [none, setNone] = useState(false);
  useEffect(() => {
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
  }, [slot]);
  if (none) return <span className="art-empty">화면에 없음</span>;
  if (url) return <Image alt="" src={url} width={96} height={96} unoptimized />;
  return <div ref={ref} style={{ display: "contents" }} />;
}

function Card({ slot, files, stamp, onCopy }: { slot: ArtSlot; files: string[]; stamp: number; onCopy: (t: string) => void }) {
  const want = slotFiles(slot);
  const done = files.length >= want.length;
  const partial = files.length > 0 && !done;
  const ground = slot.seasons.length === 1 ? `ground-${slot.seasons[0]}` : "";
  return (
    <article className={`art-card${done ? " done" : ""}`} data-slot={slot.id} data-state={done ? "done" : partial ? "partial" : "todo"}>
      <div className="art-card-title">
        <div>
          <strong>{slot.nameKo}</strong> <code>{slot.id}</code>
        </div>
        <span className={`art-status${done ? " done" : partial ? " partial" : ""}`}>{done ? "납품됨" : partial ? `${files.length}/${want.length}` : "대기"}</span>
      </div>
      <div className="art-pair">
        <div className="art-pane">
          <span>지금 · {NOW_KO[slot.now]}</span>
          <div className={`art-cell ${ground}`}>
            <NowPreview slot={slot} />
          </div>
        </div>
        <div className="art-pane">
          <span>그림 · PNG</span>
          <div className={`art-cell ${ground}`}>
            {files.length ? (
              <Image alt={slot.nameKo} src={`${ART_DIR}/${files[0]}?v=${stamp}`} width={120} height={120} unoptimized />
            ) : (
              <span className="art-empty">
                <ImageIcon aria-hidden="true" size={16} />
                <br />
                {want.join(" · ")}
              </span>
            )}
            {files.length > 1 ? <span className="art-files">{files.length}장</span> : null}
          </div>
        </div>
      </div>
      <div>
        <div className="art-meta">
          <span>
            <b>계절</b> {slot.seasons.map((k) => SEASON_KO[k]).join("·")}
          </span>
          <span>
            <b>카메라</b> {VIEW_SHORT[slot.view]}
          </span>
          <span>
            <b>크기</b> {slot.px[0]}×{slot.px[1]}
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
        <p className="art-brief">{slot.brief}</p>
      </div>
      <div className="art-card-foot">
        <code style={{ fontSize: 11, color: "var(--ink-soft, #4a4466)" }}>{want.join(", ")}</code>
        <button className="art-btn small" data-act="art-slot-prompt-copy" onClick={() => onCopy(slotPrompt(slot))} type="button">
          <ClipboardCopy aria-hidden="true" size={13} /> 프롬프트
        </button>
      </div>
    </article>
  );
}

export function AmbientArtBoard({ present, stamp }: Props) {
  const [season, setSeason] = useState<SeasonKey | "all">("all");
  const [cat, setCat] = useState<ArtCategory | "all">("all");
  const [state, setState] = useState<"all" | "todo" | "done">("all");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const stats = useMemo(() => {
    let done = 0;
    let p1 = 0;
    let p1done = 0;
    for (const s of ART_SLOTS) {
      const ok = (present[s.id]?.length ?? 0) >= slotFiles(s).length;
      if (ok) done++;
      if (s.phase === 1) {
        p1++;
        if (ok) p1done++;
      }
    }
    return { total: ART_SLOTS.length, done, p1, p1done };
  }, [present]);

  const visible = useMemo(
    () =>
      ART_SLOTS.filter((s) => {
        if (season !== "all" && !s.seasons.includes(season)) return false;
        if (cat !== "all" && s.category !== cat) return false;
        const ok = (present[s.id]?.length ?? 0) >= slotFiles(s).length;
        if (state === "done" && !ok) return false;
        if (state === "todo" && ok) return false;
        return true;
      }),
    [season, cat, state, present]
  );

  const say = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };
  const copy = async (text: string, label: string) => {
    hapticTick();
    const ok = await copyText(text);
    say(ok ? `${label} 복사됨 (${text.length.toLocaleString()}자)` : "복사 실패 — 브라우저가 막았습니다");
    if (ok) hapticTick();
  };

  const phase1 = visible.filter((s) => s.phase === 1);
  const phase2 = visible.filter((s) => s.phase === 2);

  return (
    <main className="art-board" data-art-board>
      <header className="art-board-head">
        <div>
          <a className="art-back" href="/studio">
            <ArrowLeft aria-hidden="true" size={12} /> 편집실
          </a>
          <h1>계절 배경 아트 보드</h1>
          <p>
            자리마다 그림 한 장. 만든 PNG를 <code>public/ambient/art/</code>에 표의 id 이름으로 넣으면 장면이 그 그림을 쓴다 — 없으면 지금의
            대체물이 그대로 나온다. 프롬프트는 이 표에서 만들어져 어긋나지 않는다. (<code>next dev</code>는 새로고침으로 즉시, 운영은 커밋·배포 —
            프로덕션 서버는 시작 때의 <code>public/</code> 목록만 낸다.)
          </p>
        </div>
        <div className="art-board-stats">
          <div className="art-stat">
            <b>
              {stats.p1done}/{stats.p1}
            </b>
            <span>1차 · 초목·지형</span>
          </div>
          <div className="art-stat">
            <b>
              {stats.done}/{stats.total}
            </b>
            <span>전체 자리</span>
          </div>
        </div>
      </header>
      <div className="art-board-actions">
        <button className="art-btn primary" data-act="art-prompt-copy-1" onClick={() => copy(codexMasterPrompt(1), "1차 프롬프트")} type="button">
          <ClipboardCopy aria-hidden="true" size={14} /> 코덱스 프롬프트 — 1차(초목·지형)
        </button>
        <button className="art-btn" data-act="art-prompt-copy-2" onClick={() => copy(codexMasterPrompt(2), "2차 프롬프트")} type="button">
          <ClipboardCopy aria-hidden="true" size={14} /> 2차(생물)
        </button>
        <button className="art-btn" data-act="art-prompt-copy-all" onClick={() => copy(codexMasterPrompt(), "전체 프롬프트")} type="button">
          <ClipboardCopy aria-hidden="true" size={14} /> 전체
        </button>
      </div>
      <div className="art-board-filters" role="group" aria-label="필터">
        <button aria-pressed={season === "all"} className="art-chip" onClick={() => setSeason("all")} type="button">
          사철
        </button>
        {SEASONS.map((k) => (
          <button aria-pressed={season === k} className="art-chip" key={k} onClick={() => setSeason(k)} type="button">
            {SEASON_KO[k]}
          </button>
        ))}
        <span className="art-chip-sep" aria-hidden="true" />
        <button aria-pressed={cat === "all"} className="art-chip" onClick={() => setCat("all")} type="button">
          전부
        </button>
        {CATS.map((k) => (
          <button aria-pressed={cat === k} className="art-chip" key={k} onClick={() => setCat(k)} type="button">
            {CATEGORY_KO[k]}
          </button>
        ))}
        <span className="art-chip-sep" aria-hidden="true" />
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
      {phase1.length ? (
        <section className="art-section">
          <h2>
            1차 — 나무·초목·지형·물 <small>{phase1.length}자리</small>
          </h2>
          <div className="art-grid">
            {phase1.map((s) => (
              <Card files={present[s.id] ?? []} key={s.id} onCopy={(t) => copy(t, `${s.nameKo} 프롬프트`)} slot={s} stamp={stamp} />
            ))}
          </div>
        </section>
      ) : null}
      {phase2.length ? (
        <section className="art-section">
          <h2>
            2차 — 생물(종 레지스트리) <small>{phase2.length}자리 · 이어서 디자인</small>
          </h2>
          <div className="art-grid">
            {phase2.map((s) => (
              <Card files={present[s.id] ?? []} key={s.id} onCopy={(t) => copy(t, `${s.nameKo} 프롬프트`)} slot={s} stamp={stamp} />
            ))}
          </div>
        </section>
      ) : null}
      {toast ? (
        <div className="art-toast" role="status">
          <Check aria-hidden="true" size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {toast}
        </div>
      ) : null}
    </main>
  );
}
