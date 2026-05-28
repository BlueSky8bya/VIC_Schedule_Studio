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

export function TrustedMembersPanel() {
  const [members, setMembers] = useState<TrustedMember[]>([]);
  const [email, setEmail] = useState("");
  // 한 계정에 매니저·작업자 둘 다 가능 — 추가 시 어느 역할(들)로 시작할지.
  const [addManager, setAddManager] = useState(true);
  const [addWorker, setAddWorker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 첫 조회 전엔 "없어요" 대신 로딩 표시
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listTrustedMembersAction()
      .then((r) => {
        if (r.ok) setMembers(r.members);
        else setError(r.error);
      })
      .finally(() => setLoading(false));
  }, []);

  function add() {
    setError(null);
    if (!addManager && !addWorker) {
      setError("매니저·작업자 중 하나 이상을 선택하세요.");
      return;
    }
    startTransition(async () => {
      const r = await setTrustedMemberRolesAction(email, addManager, addWorker);
      if (r.ok) {
        setMembers(r.members);
        setEmail("");
      } else {
        setError(r.error);
      }
    });
  }

  // 기존 멤버의 매니저/작업자 역할을 켜고 끈다(둘 다 끄려 하면 막는다).
  function setRoles(member: TrustedMember, isManager: boolean, isWorker: boolean) {
    setError(null);
    if (!isManager && !isWorker) {
      setError("멤버는 적어도 한 역할이 필요해요. 빼려면 삭제하세요.");
      return;
    }
    startTransition(async () => {
      const r = await setTrustedMemberRolesAction(member.email, isManager, isWorker);
      if (r.ok) setMembers(r.members);
      else setError(r.error);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await removeTrustedMemberAction(id);
      if (r.ok) setMembers(r.members);
      else setError(r.error);
    });
  }

  return (
    <div className="members-panel">
      <p className="members-hint">
        구글 이메일을 등록하면 해당 인원은 비공개 레이어를 열고 달력을 꾸밀 수 있어요. 일정 편집은
        토리님만 가능합니다.
      </p>

      <div className="members-add">
        <input
          onChange={(e) => setEmail(e.target.value)}
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
              onClick={() => setAddManager((v) => !v)}
              type="button"
            >
              매니저
            </button>
            <button
              aria-pressed={addWorker}
              className={addWorker ? "active" : ""}
              onClick={() => setAddWorker((v) => !v)}
              type="button"
            >
              작업자
            </button>
          </div>
          <button
            className="button primary"
            disabled={!email || pending}
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
          return (
          <li key={m.id}>
            <span
              className="member-avatar"
              aria-hidden="true"
              style={{ background: avatar.gradient }}
            >
              {avatar.emoji}
            </span>
            <div className="member-info">
              <strong>{m.email}</strong>
              {/* 역할 토글 — 켜진 역할은 색 태그처럼 보이고, 누르면 즉시 켜고/끈다. */}
              <div className="member-role-toggles" role="group" aria-label="역할">
                <button
                  aria-pressed={m.isManager}
                  className={`member-role-toggle manager ${m.isManager ? "on" : ""}`}
                  disabled={pending}
                  onClick={() => setRoles(m, !m.isManager, m.isWorker)}
                  type="button"
                >
                  매니저
                </button>
                <button
                  aria-pressed={m.isWorker}
                  className={`member-role-toggle worker ${m.isWorker ? "on" : ""}`}
                  disabled={pending}
                  onClick={() => setRoles(m, m.isManager, !m.isWorker)}
                  type="button"
                >
                  작업자
                </button>
              </div>
            </div>
            <button
              aria-label="삭제"
              className="member-remove"
              disabled={pending}
              onClick={() => remove(m.id)}
              title="삭제"
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
