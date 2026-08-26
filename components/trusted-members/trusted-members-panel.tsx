"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// #4: 이메일로부터 결정적으로 고르는 다양한 프로필(이모지 + 그라데이션).
const AVATAR_EMOJIS = [
  "🐰", "🐱", "🐶", "🐻", "🐼", "🦊", "🐯", "🐨", "🐸", "🐧",
  "🦁", "🐹", "🐮", "🦄", "🐙", "🐳", "🦉", "🐝", "🦋", "🐢"
];
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#6366f1,#0f8b8d)",
  "linear-gradient(135deg,#f472b6,#fb7185)",
  "linear-gradient(135deg,#fbbf24,#f97316)",
  "linear-gradient(135deg,#34d399,#0ea5a4)",
  "linear-gradient(135deg,#60a5fa,#6366f1)",
  "linear-gradient(135deg,#a78bfa,#ec4899)",
  "linear-gradient(135deg,#22d3ee,#3b82f6)",
  "linear-gradient(135deg,#f87171,#fbbf24)"
];
function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}
function avatarFor(email: string) {
  const h = hashString(email.toLowerCase());
  return {
    emoji: AVATAR_EMOJIS[h % AVATAR_EMOJIS.length],
    gradient: AVATAR_GRADIENTS[(h >> 5) % AVATAR_GRADIENTS.length]
  };
}
import {
  addTrustedManagerAction,
  listTrustedMembersAction,
  removeTrustedMemberAction,
  type TrustedMember
} from "@/lib/trusted-members/actions";
import { hapticDelete, hapticTick } from "@/lib/ui/haptics";

// 신뢰 멤버 = 매니저 한 종류(2026-08-27, ADR-0015 — 작업자 역할·달력 꾸미기 철수). 역할 토글이
// 없어져 패널은 '이메일 추가 → 목록 → 삭제'만 남는다.
export function TrustedMembersPanel() {
  const [members, setMembers] = useState<TrustedMember[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 첫 조회 전엔 "없어요" 대신 로딩 표시
  // 체감 성능: 모든 동작을 화면에 먼저 반영하고(낙관적) 서버와 조용히 맞춘다. 동기화 중인
  // 이메일엔 작은 점, 빠지는 행엔 접힘 애니메이션 — "내가 누른 게 바로 반영된다"는 유대감.
  const [syncing, setSyncing] = useState<Set<string>>(() => new Set());
  // 삭제 중 표시는 이메일로 키운다 — id는 낙관적 temp→실제로 바뀌므로 id 키는 중간에 어긋난다.
  const [removingEmails, setRemovingEmails] = useState<Set<string>>(() => new Set());
  // 모든 쓰기(추가·삭제)는 한 줄로 직렬화한다 — 동시에 두 요청이 나가면 각 응답의 전체 목록
  // (setMembers(r.members))이 서로를 덮어써 '나중 응답이 진실'이 되는 경주가 생긴다. 실패해도
  // 다음 작업은 이어간다(then(run, run)).
  const opChainRef = useRef<Promise<void>>(Promise.resolve());
  // 최신 목록을 큐 안에서 읽기 위한 거울(렌더 클로저의 낡은 members를 잡지 않으려고).
  const membersRef = useRef<TrustedMember[]>([]);
  membersRef.current = members;

  function enqueue(run: () => Promise<void>) {
    const task = () => run().catch(() => undefined);
    opChainRef.current = opChainRef.current.then(task, task);
  }

  useEffect(() => {
    listTrustedMembersAction()
      .then((r) => {
        if (r.ok) setMembers(r.members);
        else setError(r.error);
      })
      .finally(() => setLoading(false));
  }, []);

  function markSync(memberEmail: string, on: boolean) {
    setSyncing((prev) => {
      const next = new Set(prev);
      if (on) next.add(memberEmail);
      else next.delete(memberEmail);
      return next;
    });
  }

  // 실패 시 되돌리기 = 렌더 시점 스냅샷 복원이 아니라 서버 진실 재조회. 스냅샷 복원은 그 사이
  // 성공한 다른 쓰기까지 되감고, temp- 행을 영구히 남기는 문제가 있었다. 재조회마저 실패하면
  // 이 작업의 변경만 함수형으로 되돌린다(fallback).
  async function recoverAfterFailure(fallback: (cur: TrustedMember[]) => TrustedMember[]) {
    const r = await listTrustedMembersAction().catch(() => null);
    if (r && r.ok) commitMembers(r.members);
    else commitMembers(fallback(membersRef.current));
  }

  // 서버가 준 전체 목록을 확정한다. 다음 큐 작업이 렌더 전에 곧장 이어질 수 있으므로 거울(ref)도
  // 같은 순간 갱신해 큐 안에서 항상 최신 목록을 읽게 한다.
  function commitMembers(next: TrustedMember[]) {
    membersRef.current = next;
    setMembers(next);
  }

  function add() {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("이메일을 입력하세요.");
      return;
    }
    hapticTick();
    const optimistic: TrustedMember = {
      id: `temp-${cleanEmail}`,
      email: cleanEmail,
      displayName: null,
      isActive: true
    };
    // 이미 있는 이메일이면 활성으로 되살림(중복 행 방지, id·표시명은 유지), 아니면 맨 아래에 바로 추가.
    // 되돌리기용으로 '이 작업 전' 그 이메일 행을 함수형 업데이트 안에서 잡아둔다(낡은 클로저 X).
    let before: TrustedMember | undefined;
    setMembers((prev) => {
      before = prev.find((m) => m.email === cleanEmail);
      return before
        ? prev.map((m) => (m.email === cleanEmail ? { ...m, isActive: true } : m))
        : [...prev, optimistic];
    });
    markSync(cleanEmail, true);
    setEmail("");
    enqueue(async () => {
      const r = await addTrustedManagerAction(cleanEmail);
      markSync(cleanEmail, false);
      if (r.ok) {
        commitMembers(r.members);
        hapticTick();
      } else {
        setError(r.error);
        const prevRow = before;
        await recoverAfterFailure((cur) =>
          prevRow
            ? cur.map((m) => (m.email === cleanEmail ? prevRow : m))
            : cur.filter((m) => m.email !== cleanEmail)
        );
      }
    });
  }

  // 삭제 — 행을 접히는 애니메이션으로 보내고(바로 사라지는 느낌), 서버 확정 후 목록에서 뺀다.
  // 실패하면 접힘을 풀어 행이 되살아난다.
  function remove(member: TrustedMember) {
    if (!window.confirm(`${member.email} 멤버를 삭제할까요?`)) {
      return;
    }
    setError(null);
    const targetEmail = member.email;
    setRemovingEmails((prev) => new Set(prev).add(targetEmail));
    enqueue(async () => {
      // 직렬 큐라 여기 도착했을 땐 앞선 추가가 끝나 있다 — 임시 id 대신 '지금' 목록에서 이메일로
      // 실제 id를 찾는다. 추가가 실패해 행이 이미 사라졌다면(또는 여전히 temp면) 지울 게 없으니
      // 조용히 접힘만 풀고 끝낸다(추가 실패 에러가 이미 떠 있다).
      const live = membersRef.current.find((m) => m.email === targetEmail);
      const clearRemoving = () =>
        setRemovingEmails((prev) => {
          const next = new Set(prev);
          next.delete(targetEmail);
          return next;
        });
      if (!live || live.id.startsWith("temp-")) {
        clearRemoving();
        return;
      }
      const r = await removeTrustedMemberAction(live.id);
      clearRemoving();
      if (r.ok) {
        commitMembers(r.members);
        hapticDelete();
      } else {
        setError(r.error);
        // 삭제는 낙관적으로 목록에서 빼지 않았으므로(접힘 표시만) 목록 되돌릴 게 없다.
        // 다만 서버 상태가 어긋났을 수 있어 진실을 한 번 맞춘다.
        await recoverAfterFailure((cur) => cur);
      }
    });
  }

  return (
    <div className="members-panel">
      <details className="members-perms">
        <summary>역할별 권한 보기</summary>
        <table className="perm-table">
          <thead>
            <tr>
              <th scope="col">권한</th>
              {/* 화면 폭에 따라 '관리자'↔'관'을 바꿔 보여준다. 읽어 주는 이름(aria-label)은
                  항상 온전한 역할명이라 스크린리더는 축약과 무관하다. */}
              <th scope="col" aria-label="관리자">
                <span className="perm-role-full">관리자</span>
                <span className="perm-role-short">관</span>
              </th>
              <th scope="col" aria-label="개발자">
                <span className="perm-role-full">개발자</span>
                <span className="perm-role-short">개</span>
              </th>
              <th scope="col" aria-label="매니저">
                <span className="perm-role-full">매니저</span>
                <span className="perm-role-short">매</span>
              </th>
            </tr>
          </thead>
          {/* (작업자 열·꾸미기/캡쳐/이모지/비공개 보기 행은 2026-08-27 기능·역할 철수로 제거.) */}
          <tbody>
            <tr>
              <th scope="row">일정 편집</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
            </tr>
            <tr>
              <th scope="row">업 도움 기간·링크 수정</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
            </tr>
            <tr>
              <th scope="row">생성된 일정 태그 수정</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
            </tr>
            <tr>
              <th scope="row">태그·멤버·비번 관리</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
            </tr>
          </tbody>
        </table>
        {/* 모바일 범례 — 좁은 화면에서는 머리글을 한 글자로 줄인다(가로 스크롤 없이 한눈에).
            줄인 글자가 무엇인지 여기서 한 줄로 말해 준다. 웹에서는 숨긴다(머리글이 이미 온전). */}
        <p className="perm-legend" aria-hidden="true">
          <b className="pl-item">
            <span className="pl-owner">관</span> 관리자
          </b>
          <b className="pl-item">
            <span className="pl-dev">개</span> 개발자
          </b>
          <b className="pl-item">
            <span className="pl-manager">매</span> 매니저
          </b>
        </p>
      </details>

      <div className="members-add">
        <input
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            // 이메일 치고 Enter로도 바로 추가(추가 버튼과 동일 조건).
            if (e.key === "Enter" && email.trim()) {
              e.preventDefault();
              add();
            }
          }}
          placeholder="example@gmail.com"
          type="email"
          value={email}
        />
        <div className="members-add-controls">
          <button
            className="button primary"
            data-act="member-add"
            disabled={!email.trim()}
            onClick={add}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            매니저 추가
          </button>
        </div>
      </div>

      {error ? <div className="auth-warning">{error}</div> : null}

      <ul className="members-list">
        {loading ? (
          <li className="members-empty">
            <Users aria-hidden="true" size={22} />
            불러오는 중…
          </li>
        ) : members.length === 0 ? (
          <li className="members-empty">
            <Users aria-hidden="true" size={22} />
            아직 등록된 사람이 없어요.
          </li>
        ) : null}
        {members.map((m) => {
          const avatar = avatarFor(m.email);
          const isSyncing = syncing.has(m.email);
          const isRemoving = removingEmails.has(m.email);
          return (
          <li
            className={`member-row${m.isActive ? " is-active" : " is-inactive"}${isRemoving ? " removing" : ""}${isSyncing ? " syncing" : ""}`}
            key={m.email}
          >
            <span
              className="member-avatar"
              aria-hidden="true"
              style={{ background: avatar.gradient }}
            >
              {avatar.emoji}
            </span>
            <div className="member-info">
              <strong>
                {m.email}
                {/* 동기화 중 작은 점 — "저장되고 있다"는 신호(차단하지 않음). */}
                {isSyncing ? <span className="member-sync-dot" title="저장 중…" aria-hidden="true" /> : null}
              </strong>
              <span className="member-status">{m.isActive ? "매니저 · 활성" : "매니저 · 비활성"}</span>
            </div>
            <button
              aria-label="삭제"
              className="member-remove"
              disabled={isRemoving || isSyncing}
              onClick={() => remove(m)}
              title="삭제"
              type="button"
             data-act="삭제">
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
