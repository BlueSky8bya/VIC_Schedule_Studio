"use client";

// P2-ARCH-1 3단계: 편집실의 '전역 직렬 쓰기 큐'를 studio-shell에서 훅으로 분리(동작 변화 0).
// - 모든 중대한 쓰기는 enqueueWrite를 거쳐 '제출한 순서대로' 서버에 반영된다(전역 체인).
//   앞 작업이 실패해도 체인은 끊기지 않는다. 낙관적 화면 갱신은 즉시, 서버 전송만 직렬화.
// - temp id → 실제 id 해석(resolveEventId), 진행 중 약속 집합(inflight), 저장 상태 칩
//   (idle/saving/saved+KST/failed, 최소 노출 시간) 로직을 그대로 옮겼다.
// - 이동 저장 체인(movePersistChainRef)은 별도 관심사라 셸이 소유하고 flush에만 넘긴다.

import { useRef, useState, type MutableRefObject } from "react";
import { nowKstHm } from "@/lib/calendar/month";
import { postStudioWrite, type StudioWriteResult } from "@/lib/studio/editor-model";

export type SaveState = "idle" | "saving" | "saved" | "failed";

export function useStudioWriteQueue(
  movePersistChainRef: MutableRefObject<Promise<void>>,
  // 진행 중 쓰기(inflight)가 0이 되는 순간마다 부른다 — 셸이 '실패한 이동의 서버 재동기화'처럼
  // "큐가 완전히 빈 뒤에만 할 수 있는 일"을 여기에 건다(ref로 받아 최신 클로저를 쓴다).
  onDrainRef?: MutableRefObject<(() => void) | null>
) {
  // #10 저장 신뢰: 모든 쓰기가 studioWrite를 거치므로 거기서 상태를 잡아 헤더 칩에 보여준다.
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedKst, setLastSavedKst] = useState<string | null>(null);
  const savingCountRef = useRef(0); // 동시 진행 쓰기 수 — 0이 될 때 최종 상태 확정
  const savingSinceRef = useRef(0); // 저장 묶음 시작 시각('저장 중' 최소 노출)
  const savedTimerRef = useRef<number | null>(null);
  const editedSinceSyncRef = useRef(false); // 마지막 서버 새로고침 이후 편집이 있었나
  // 진행 중인 모든 중대한 쓰기(save/delete/tags/reorder/support/link)의 약속 집합.
  const inflightWritesRef = useRef<Set<Promise<StudioWriteResult>>>(new Set());
  // 새 일정 저장 진행 중인 임시 id → 실제 id 약속.
  const pendingSavesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  // 저장 끝난 temp → 실제 id 매핑(영구) — 저장 직후 삭제해도 실제 id로 해석되게.
  const tempToRealRef = useRef<Map<string, string>>(new Map());
  // 전역 직렬 쓰기 체인.
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  // temp id면 저장 약속을 기다려 실제 id로, 실패면 null. 실제 id는 그대로.
  async function resolveEventId(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    if (!id.startsWith("temp-")) {
      return id;
    }
    const known = tempToRealRef.current.get(id);
    if (known) return known;
    const p = pendingSavesRef.current.get(id);
    return p ? await p : null;
  }

  // 모든 중대한 쓰기는 이 래퍼를 거친다. task를 '제출한 순서대로' 직렬 실행한다(전역 체인).
  function enqueueWrite(
    task: () => Promise<StudioWriteResult | null>
  ): Promise<StudioWriteResult> {
    if (savingCountRef.current === 0) {
      savingSinceRef.current = Date.now();
    }
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    savingCountRef.current += 1;
    editedSinceSyncRef.current = true;
    // 'saving'을 setTimeout(0)으로 트랜지션 밖에서 칠한다 — startTransition 안에서 불려도
    // '저장 중'이 확실히 보이게.
    window.setTimeout(() => {
      if (savingCountRef.current > 0) setSaveState("saving");
    }, 0);
    const p: Promise<StudioWriteResult> = writeChainRef.current.then(async () => {
      const r = await task();
      return r ?? { ok: true, id: "" };
    });
    writeChainRef.current = p.then(
      () => undefined,
      () => undefined
    );
    inflightWritesRef.current.add(p);
    // 낙관적 저장은 너무 빨라 '저장 중'이 안 보일 수 있다 → 최소 ~700ms 노출.
    const settleSaved = () => {
      if (savingCountRef.current !== 0) return;
      const elapsed = Date.now() - savingSinceRef.current;
      if (elapsed >= 700) {
        setSaveState("saved");
      } else {
        savedTimerRef.current = window.setTimeout(() => {
          if (savingCountRef.current === 0) setSaveState("saved");
        }, 700 - elapsed);
      }
    };
    void p
      .then(
        (r) => {
          savingCountRef.current = Math.max(0, savingCountRef.current - 1);
          if (!r.ok) {
            setSaveState("failed");
          } else {
            setLastSavedKst(nowKstHm());
            if (savingCountRef.current === 0) settleSaved();
          }
        },
        () => {
          savingCountRef.current = Math.max(0, savingCountRef.current - 1);
          setSaveState("failed");
        }
      )
      .finally(() => {
        inflightWritesRef.current.delete(p);
        if (inflightWritesRef.current.size === 0) onDrainRef?.current?.();
      });
    return p;
  }

  // op/payload가 고정된(temp id 해석이 필요 없는) 일반 쓰기 — 그대로 큐에 올린다.
  function studioWrite(op: string, payload: unknown): Promise<StudioWriteResult> {
    return enqueueWrite(() => postStudioWrite(op, payload));
  }

  // 진행 중인 모든 쓰기(이동 큐 + inflight 집합)가 서버에 반영될 때까지 기다린다.
  async function flushPendingWrites() {
    for (let i = 0; i < 6; i++) {
      try {
        await movePersistChainRef.current;
      } catch {
        /* 개별 실패는 무시 — 목적은 '대기'다 */
      }
      if (inflightWritesRef.current.size === 0) break;
      await Promise.allSettled([...inflightWritesRef.current]);
    }
  }

  // Ctrl+S로 저장할 카드가 없을 때(이미 다 저장됨) — 저장중→저장됨을 잠깐 보여 확인시킨다.
  function flashSavedChip(): void {
    if (savingCountRef.current > 0) return;
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    setSaveState("saving");
    savedTimerRef.current = window.setTimeout(() => {
      if (savingCountRef.current === 0) {
        setSaveState("saved");
        setLastSavedKst(nowKstHm());
      }
      savedTimerRef.current = null;
    }, 600);
  }

  return {
    saveState,
    lastSavedKst,
    savingCountRef,
    editedSinceSyncRef,
    inflightWritesRef,
    pendingSavesRef,
    tempToRealRef,
    resolveEventId,
    enqueueWrite,
    studioWrite,
    flushPendingWrites,
    flashSavedChip
  };
}
