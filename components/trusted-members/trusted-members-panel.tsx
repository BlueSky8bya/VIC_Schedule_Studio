"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

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
  listTrustedMembersAction,
  removeTrustedMemberAction,
  setTrustedMemberRolesAction,
  type TrustedMember
} from "@/lib/trusted-members/actions";
import { hapticDelete, hapticTick } from "@/lib/ui/haptics";

export function TrustedMembersPanel() {
  const [members, setMembers] = useState<TrustedMember[]>([]);
  const [email, setEmail] = useState("");
  // 한 계정에 매니저·작업자 둘 다 가능 — 추가 시 어느 역할(들)로 시작할지.
  const [addManager, setAddManager] = useState(true);
  const [addWorker, setAddWorker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 첫 조회 전엔 "없어요" 대신 로딩 표시
  // 체감 성능: 모든 동작을 화면에 먼저 반영하고(낙관적) 서버와 조용히 맞춘다. 동기화 중인
  // 이메일엔 작은 점, 빠지는 행엔 접힘 애니메이션 — "내가 누른 게 바로 반영된다"는 유대감.
  const [syncing, setSyncing] = useState<Set<string>>(() => new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

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

  function add() {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("이메일을 입력하세요.");
      return;
    }
    if (!addManager && !addWorker) {
      setError("매니저·작업자 중 하나 이상을 선택하세요.");
      return;
    }
    hapticTick();
    const snapshot = members;
    const optimistic: TrustedMember = {
      id: `temp-${cleanEmail}`,
      email: cleanEmail,
      displayName: null,
      trustedRole: addManager ? "manager" : "worker",
      isManager: addManager,
      isWorker: addWorker,
      isActive: true
    };
    // 이미 있는 이메일이면 역할만 갱신(중복 행 방지), 아니면 맨 아래에 바로 추가.
    setMembers((prev) =>
      prev.some((m) => m.email === cleanEmail)
        ? prev.map((m) => (m.email === cleanEmail ? { ...m, ...optimistic, id: m.id } : m))
        : [...prev, optimistic]
    );
    markSync(cleanEmail, true);
    setEmail("");
    startTransition(async () => {
      const r = await setTrustedMemberRolesAction(cleanEmail, addManager, addWorker);
      markSync(cleanEmail, false);
      if (r.ok) {
        setMembers(r.members);
        hapticTick();
      }
      else {
        setMembers(snapshot);
        setError(r.error);
      }
    });
  }

  // 역할 토글 — 칩이 즉시 바뀌고(낙관적), 뒤에서 서버와 맞춘다. 둘 다 끄려 하면 막는다.
  function setRoles(member: TrustedMember, isManager: boolean, isWorker: boolean) {
    hapticTick();
    setError(null);
    if (!isManager && !isWorker) {
      setError("멤버는 적어도 한 역할이 필요해요. 빼려면 삭제하세요.");
      return;
    }
    const snapshot = members;
    setMembers((prev) =>
      prev.map((m) =>
        m.id === member.id
          ? { ...m, isManager, isWorker, trustedRole: isManager ? "manager" : "worker" }
          : m
      )
    );
    markSync(member.email, true);
    startTransition(async () => {
      const r = await setTrustedMemberRolesAction(member.email, isManager, isWorker);
      markSync(member.email, false);
      if (r.ok) {
        setMembers(r.members);
        hapticTick();
      }
      else {
        setMembers(snapshot);
        setError(r.error);
      }
    });
  }

  // 삭제 — 행을 접히는 애니메이션으로 보내고(바로 사라지는 느낌), 서버 확정 후 목록에서 뺀다.
  // 실패하면 접힘을 풀어 행이 되살아난다.
  function remove(member: TrustedMember) {
    // 아직 서버 동기화 전(임시 id)인 멤버는 그 id로 지울 수 없다(uuid 아님 → 오류). 동기화가
    // 끝나 실제 id가 잡힌 뒤에만 삭제한다(버튼도 동기화 중엔 비활성).
    if (member.id.startsWith("temp-")) {
      return;
    }
    if (!window.confirm(`${member.email} 멤버를 삭제할까요?`)) {
      return;
    }
    setError(null);
    setRemovingIds((prev) => new Set(prev).add(member.id));
    startTransition(async () => {
      const r = await removeTrustedMemberAction(member.id);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
      if (r.ok) {
        setMembers(r.members);
        hapticDelete();
      }
      else setError(r.error);
    });
  }

  return (
    <div className="members-panel">
      <details className="members-perms">
        <summary>역할별 권한 보기</summary>
        {/* 모바일 범례 — 좁은 화면에서는 머리글을 한 글자로 줄인다(가로 스크롤 없이 한눈에).
            줄인 글자가 무엇인지 여기서 한 줄로 말해 준다. 웹에서는 숨긴다(머리글이 이미 온전). */}
        <p className="perm-legend" aria-hidden="true">
          <span className="pl-owner">관</span> 관리자 · <span className="pl-dev">개</span> 개발자 ·{" "}
          <span className="pl-manager">매</span> 매니저 · <span className="pl-worker">작</span> 작업자
        </p>
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
              <th scope="col" aria-label="작업자">
                <span className="perm-role-full">작업자</span>
                <span className="perm-role-short">작</span>
              </th>
            </tr>
          </thead>
          {/* 행 순서 = '데칼코마니'(상하 대칭). 중앙(엠바고)을 축으로 위/아래 4행이 각 열의 ✓/✕
              패턴까지 완전히 거울처럼 맞는다(같은 권한 패턴끼리 짝을 지어 배치). 매니저·작업자 열이
              위아래로 대칭 무늬를 이룬다. 의미가 아니라 '보기 좋은 대칭'을 위한 정렬. */}
          <tbody>
            <tr>
              <th scope="row">일정 편집</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
              <td className="no">✕</td>
            </tr>
            <tr>
              <th scope="row">업 도움 기간·링크 수정</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
            </tr>
            <tr>
              <th scope="row">작업자 일정 보기</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
              <td className="yes">✓</td>
            </tr>
            <tr>
              <th scope="row">달력 꾸미기</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
            </tr>
            <tr>
              <th scope="row">엠바고 일정 보기</th>
              <td className="yes">✓</td>
              <td className="no">✕</td>
              <td className="no">✕</td>
              <td className="no">✕</td>
            </tr>
            <tr>
              <th scope="row">달력 이미지 캡쳐</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
            </tr>
            <tr>
              <th scope="row">이모지 추가·삭제</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
              <td className="yes">✓</td>
            </tr>
            <tr>
              <th scope="row">생성된 일정 태그 수정</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
            </tr>
            <tr>
              <th scope="row">태그·멤버·비번 관리</th>
              <td className="yes">✓</td>
              <td className="yes">✓</td>
              <td className="no">✕</td>
              <td className="no">✕</td>
            </tr>
          </tbody>
        </table>
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
          {/* 다중 선택 — 한 계정에 매니저·작업자 둘 다 줄 수 있다. */}
          <div className="role-segment" role="group" aria-label="역할(복수 선택 가능)">
            <button
              aria-pressed={addManager}
              className={addManager ? "active" : ""}
              onClick={() => {
                hapticTick();
                setAddManager((v) => !v);
              }}
              type="button"
            >
              매니저
            </button>
            <button
              aria-pressed={addWorker}
              className={addWorker ? "active" : ""}
              onClick={() => {
                hapticTick();
                setAddWorker((v) => !v);
              }}
              type="button"
            >
              작업자
            </button>
          </div>
          <button
            className="button primary"
            data-act="member-add"
            disabled={!email.trim()}
            onClick={add}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            추가
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
          const isRemoving = removingIds.has(m.id);
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
              <span className="member-status">{m.isActive ? "활성" : "비활성"}</span>
            </div>
            {/* 역할 토글 — 켜진 역할은 색 태그처럼 보이고, 누르면 즉시 켜고/끈다(낙관적). */}
            <div className="member-role-toggles" role="group" aria-label="역할">
              <button
                aria-pressed={m.isManager}
                className={`member-role-toggle manager ${m.isManager ? "on" : ""}`}
                disabled={isSyncing || isRemoving}
                onClick={() => setRoles(m, !m.isManager, m.isWorker)}
                type="button"
               data-act="member-role-toggle">
                매니저
              </button>
              <button
                aria-pressed={m.isWorker}
                className={`member-role-toggle worker ${m.isWorker ? "on" : ""}`}
                disabled={isSyncing || isRemoving}
                onClick={() => setRoles(m, m.isManager, !m.isWorker)}
                type="button"
               data-act="member-role-toggle">
                작업자
              </button>
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
