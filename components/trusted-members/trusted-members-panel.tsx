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
  addTrustedMemberAction,
  listTrustedMembersAction,
  removeTrustedMemberAction,
  type TrustedMember
} from "@/lib/trusted-members/actions";

export function TrustedMembersPanel() {
  const [members, setMembers] = useState<TrustedMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "worker">("manager");
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
    startTransition(async () => {
      const r = await addTrustedMemberAction(email, role);
      if (r.ok) {
        setMembers(r.members);
        setEmail("");
      } else {
        setError(r.error);
      }
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
        구글 이메일을 등록하면 그 사람이 비공개 레이어를 열고 달력을 꾸밀 수 있어요. 일정 편집은
        소유자만 가능합니다.
      </p>

      <div className="members-add">
        <input
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@gmail.com"
          type="email"
          value={email}
        />
        <div className="members-add-controls">
          <div className="role-segment" role="group" aria-label="역할">
            <button
              className={role === "manager" ? "active" : ""}
              onClick={() => setRole("manager")}
              type="button"
            >
              매니저
            </button>
            <button
              className={role === "worker" ? "active" : ""}
              onClick={() => setRole("worker")}
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
              <span className={`member-role ${m.trustedRole}`}>
                {m.trustedRole === "manager" ? "매니저" : "작업자"}
              </span>
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
