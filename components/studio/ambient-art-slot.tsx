"use client";

// 자리 상세(2026-09-08, PLAN-20260908-009 P3) — **한 자리의 변형 전부를 한 화면에서 관리한다.**
// 소유자: "변형들도 한 번 해당 엔티티 버튼 누르면 같이 관리할 수 있는 라우팅."
//
// 목록(보드)이 답하는 질문은 "무엇이 남았나"이고, 이 화면이 답하는 질문은 **"이 자리는 지금 어떤 상태인가"**다:
//  ① 변형 칸이 몇 개이고 그중 몇 장이 왔는가(빈 칸이 눈에 보여야 한다 — 숫자 "3/8"보다 빈 칸 다섯 개가 빠르다)
//  ② 그 자리의 규격(크기·비·격자·블록·가로 도트·한 화면 동시)이 **한눈에** — 코덱스에 부탁할 때 필요한 수가 전부 여기
//  ③ 왜 변형이 이만큼인가(한 화면 동시 개수에서 나온 값이라는 근거)
//  ④ 프롬프트 복사 — 자리 전체 / 아직 안 온 파일만
//
// 디자인은 스튜디오 토큰(금생수 ADR-0016)만 쓴다 — 새 팔레트를 만들지 않는다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";
import { ArrowLeft, Check, ClipboardCopy, Ruler } from "lucide-react";
import "./ambient-art-board.css";
import {
  ART_DIR,
  ART_SLOTS,
  batchPrompt,
  CATEGORY_KO,
  dotBlock,
  dotGrid,
  dotsAcross,
  isFiller,
  NOW_KO,
  ratioOf,
  recommendedVariants,
  SEASON_KO,
  slotFiles,
  slotPrompt,
  sourceRatio,
  targetEdge,
  viewTagOf,
  type ArtFileInfo
} from "@/components/shared/ambient/art/manifest";
import { previewOf } from "@/components/shared/ambient/art/preview";
import { hapticTick } from "@/lib/ui/haptics";

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))}KB`;

/** 브리프는 코덱스 프롬프트용 텍스트라 `**굵게**`가 섞여 있다. 화면에는 별표가 아니라 굵은 글씨로 보여야 한다
 *  (2026-09-08 실측: 상세 화면에 `**변형 8개는…**`이 그대로 찍혔다). 굵게 하나만 처리한다 — 브리프에 다른 마크업은 쓰지 않는다. */
function RichBrief({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
      )}
    </>
  );
}

/** 대체물 미리보기 — 파일이 아직 없는 칸에 "지금 화면에 그려지는 것"을 보여 준다. */
function Fallback({ slotId, px }: { slotId: string; px: readonly [number, number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [none, setNone] = useState(false);
  useEffect(() => {
    const p = previewOf(slotId);
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
    const k = Math.min(3, 88 / Math.max(px[0], px[1]));
    p.c.style.width = `${Math.round(px[0] * k)}px`;
    p.c.style.height = `${Math.round(px[1] * k)}px`;
    return () => host.replaceChildren();
  }, [slotId, px]);
  if (none) return <span className="art-empty">아무것도 안 그려짐</span>;
  if (url) return <Image alt="" src={url} width={88} height={88} unoptimized />;
  return <div ref={ref} style={{ display: "contents" }} />;
}

export function AmbientArtSlotView({ slotId, files, stamp }: { slotId: string; files: ArtFileInfo[]; stamp: number }) {
  const slot = useMemo(() => ART_SLOTS.find((s) => s.id === slotId)!, [slotId]);
  const want = useMemo(() => slotFiles(slot), [slot]);
  const byName = useMemo(() => new Map(files.map((f) => [f.file, f])), [files]);
  const [toast, setToast] = useState<string | null>(null);
  const copy = useCallback(async (text: string, label: string) => {
    hapticTick();
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} 복사됨`);
    } catch {
      setToast("복사 실패 — 브라우저가 막았다");
    }
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const missing = want.filter((f) => !byName.has(f));
  const done = want.length - missing.length;
  const need = slot.perScreen ? recommendedVariants(slot.perScreen, isFiller(slot)) : null;
  const block = dotBlock(slot.px, slot.grid);

  // 이웃 자리(같은 범주) — 상세에서 상세로 바로 건너뛴다. 목록으로 나갔다 들어오는 왕복을 줄인다(HCI).
  const siblings = useMemo(() => ART_SLOTS.filter((s) => s.category === slot.category && s.phase === slot.phase), [slot]);
  const at = siblings.findIndex((s) => s.id === slot.id);

  return (
    <div className="artslot">
      <header className="artslot-top">
        <Link className="art-btn small" data-act="art-slot-back" href="/studio/ambient-art">
          <ArrowLeft aria-hidden="true" size={14} /> 자리 목록
        </Link>
        <div className="artslot-title">
          <h1>{slot.nameKo}</h1>
          <span className="artslot-id">{slot.id}</span>
        </div>
        <div className="artslot-progress" data-state={missing.length ? (done ? "partial" : "todo") : "done"}>
          <strong>{done}</strong>
          <span>/ {want.length}</span>
        </div>
      </header>

      {/* ── 변형 칸: 빈 칸이 눈에 보여야 한다. 숫자보다 빈 자리 다섯 개가 빠르다. */}
      <section className="artslot-grid" aria-label="변형">
        {want.map((f) => {
          const info = byName.get(f);
          return (
            <article key={f} className="artslot-cell" data-state={info ? "done" : "todo"}>
              <div className="artslot-thumb">
                {info ? <Image alt={f} src={`${ART_DIR}/${f}?v=${stamp}`} width={88} height={88} unoptimized /> : <span className="artslot-blank" aria-hidden="true" />}
              </div>
              <div className="artslot-cellmeta">
                <code>{f}</code>
                {info ? (
                  <span>
                    {info.w}×{info.h} · {kb(info.bytes)}
                  </span>
                ) : (
                  <span className="artslot-todo">아직 — 지금은 대체물</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* ── 규격: 코덱스에 부탁할 때 필요한 수가 전부 여기 있어야 한다. */}
      <section className="artslot-spec" aria-label="규격">
        <h2>
          <Ruler aria-hidden="true" size={14} /> 규격
        </h2>
        <dl>
          <div>
            <dt>화면 크기</dt>
            <dd>
              {slot.px[0]}×{slot.px[1]} <em>({ratioOf(slot.px)})</em>
            </dd>
          </div>
          <div>
            <dt>카메라</dt>
            <dd>{viewTagOf(slot)}</dd>
          </div>
          <div>
            <dt>도트 격자</dt>
            <dd>
              {dotGrid(slot.px, slot.grid)}칸 <em>(블록 {block}px)</em>
            </dd>
          </div>
          <div>
            <dt>가로 도트</dt>
            <dd>{dotsAcross(slot.px, slot.grid)}칸</dd>
          </div>
          <div>
            <dt>저장</dt>
            <dd>
              1024 → {targetEdge(slot.px)} <em>(÷{sourceRatio(slot.px)})</em>
            </dd>
          </div>
          <div>
            <dt>계절</dt>
            <dd>{slot.seasons.map((k) => SEASON_KO[k]).join("·")}</dd>
          </div>
          <div>
            <dt>범주</dt>
            <dd>{CATEGORY_KO[slot.category]}</dd>
          </div>
          <div className="artslot-nowcell">
            <dt>지금 화면</dt>
            <dd>
              <span className="artslot-nowart">
                <Fallback slotId={slot.id} px={slot.px} />
              </span>
              <em>{NOW_KO[slot.now]}</em>
            </dd>
          </div>
        </dl>
        {slot.perScreen ? (
          <p className="artslot-why">
            한 화면에 최대 <strong>{slot.perScreen}개</strong>가 동시에 놓인다 → 변형 <strong>{need}개</strong> 이상이 필요하다
            {slot.variants && need && slot.variants < need ? <span className="artslot-warn"> · 지금 {slot.variants}개, 모자란다</span> : null}
            <em> 한 변형이 두 번까지만 보이게 하는 값이다. 엔진이 좌우로 뒤집으므로 플립은 변형으로 치지 않는다.</em>
          </p>
        ) : null}
      </section>

      <section className="artslot-brief" aria-label="그릴 것">
        <h2>그릴 것</h2>
        <p>
          <RichBrief text={slot.brief} />
        </p>
      </section>

      <div className="artslot-actions">
        <button className="art-btn primary" data-act="art-slot-prompt-copy" onClick={() => void copy(slotPrompt(slot), `${slot.nameKo} 프롬프트`)} type="button">
          <ClipboardCopy aria-hidden="true" size={14} /> 이 자리 프롬프트
        </button>
        <button
          className="art-btn"
          data-act="art-slot-prompt-missing"
          disabled={!missing.length}
          onClick={() => void copy(batchPrompt([slot], `${slot.nameKo} — 아직 안 온 ${missing.length}장`, { files: missing }), "남은 파일 프롬프트")}
          type="button"
        >
          <ClipboardCopy aria-hidden="true" size={14} /> 남은 {missing.length}장만
        </button>
      </div>

      {siblings.length > 1 ? (
        <nav className="artslot-siblings" aria-label="같은 범주">
          {siblings.map((s, i) => (
            <Link key={s.id} data-act="art-slot-sibling" data-here={i === at ? "1" : "0"} href={`/studio/ambient-art/${s.id}` as Route}>
              {s.nameKo}
            </Link>
          ))}
        </nav>
      ) : null}

      {toast ? (
        <div className="art-toast" role="status">
          <Check aria-hidden="true" size={14} /> {toast}
        </div>
      ) : null}
    </div>
  );
}
