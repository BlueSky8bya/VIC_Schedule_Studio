"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, BookA, Check, EyeOff, Search } from "lucide-react";
import "./search-dictionary-board.css";
import {
  ignoreDictionaryTermAction,
  saveDictionaryNoteAction,
  type DictionaryDraftRow
} from "@/lib/search/dictionary-actions";
import { hapticTick } from "@/lib/ui/haptics";

// 은어 사전 초안 보드(0090) — 개발자 전용. 아트 보드와 같은 문법(큰 여백·한 겹 카드·헤어라인·낮고 넓은 그림자).
// 한 줄 = 채팅에서 새로 배운 말. [뜻 = ○○] 저장 → 동의어(syn) 양방향 등록 → 검색이 그 말을 곧바로 알아듣는다.
// [무시] → 다시 안 보인다. 숫자(방송 수·횟수)는 개발자 화면이라 보인다(시청자 화면엔 절대 안 나간다).

export function SearchDictionaryBoard({ rows, error }: { rows: DictionaryDraftRow[]; error: string | null }) {
  const [list, setList] = useState(rows);
  const [filter, setFilter] = useState("");
  const [meaning, setMeaning] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(error);
  const [pending, startTransition] = useTransition();
  const shown = useMemo(() => {
    const f = filter.trim();
    return f ? list.filter((r) => r.term.includes(f) || r.samples.some((s) => s.includes(f))) : list;
  }, [list, filter]);

  const save = (term: string) => {
    const m = (meaning[term] ?? "").trim();
    if (!m) return;
    hapticTick();
    startTransition(async () => {
      const r = await saveDictionaryNoteAction(term, m);
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setList((prev) => prev.filter((x) => x.term !== term));
      setMsg(`'${term}' = '${m}' 저장 — 검색이 바로 알아듣습니다.`);
    });
  };
  const ignore = (term: string) => {
    hapticTick();
    startTransition(async () => {
      const r = await ignoreDictionaryTermAction(term);
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setList((prev) => prev.filter((x) => x.term !== term));
    });
  };

  return (
    <main className="dict-board">
      <header className="dict-head">
        <Link className="dict-back" href="/studio">
          <ArrowLeft aria-hidden="true" size={16} />
          편집실
        </Link>
        <h1>
          <BookA aria-hidden="true" size={20} />
          은어 사전 초안
        </h1>
        <p className="dict-sub">
          다시보기 채팅에서 새로 배운 말 중 사전·인물·제목에 없는 것. 뜻(검색에 쓰일 말)을 달면 동의어로 들어가고, 무시하면 다시 안 보입니다.
          채팅 원문은 저장하지 않아 여기서도 볼 수 없습니다.
        </p>
        <label className="dict-filter">
          <Search aria-hidden="true" size={15} />
          <input onChange={(e) => setFilter(e.target.value)} placeholder="단어·방송 제목 거르기" type="search" value={filter} />
        </label>
        {msg ? <p className="dict-msg" role="status">{msg}</p> : null}
      </header>
      {shown.length === 0 ? (
        <p className="dict-empty">{list.length === 0 ? "새로 배운 말이 없습니다 — 채팅 수집이 더 쌓이면 나타납니다." : "거른 결과가 없습니다."}</p>
      ) : (
        <ul className="dict-list">
          {shown.map((r) => (
            <li className="dict-row" key={r.term}>
              <div className="dict-term">
                <b>{r.term}</b>
                <span className="dict-meta">
                  방송 {r.vods}개 · {r.total}회 · {r.firstDay ?? "?"} ~ {r.lastDay ?? "?"}
                </span>
                {r.samples.length ? <span className="dict-samples">{r.samples.join(" / ")}</span> : null}
              </div>
              <form
                className="dict-act"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(r.term);
                }}
              >
                <input
                  aria-label={`${r.term}의 뜻`}
                  onChange={(e) => setMeaning((m) => ({ ...m, [r.term]: e.target.value }))}
                  placeholder="뜻 = 검색에 쓰일 말"
                  value={meaning[r.term] ?? ""}
                />
                <button className="dict-btn dict-save" data-act="dict-note-save" disabled={pending || !(meaning[r.term] ?? "").trim()} type="submit">
                  <Check aria-hidden="true" size={14} />
                  저장
                </button>
                <button className="dict-btn dict-ignore" data-act="dict-ignore" disabled={pending} onClick={() => ignore(r.term)} type="button">
                  <EyeOff aria-hidden="true" size={14} />
                  무시
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
