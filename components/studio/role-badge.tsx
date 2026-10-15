"use client";

// Web keeps its quiet role label; mobile opens the same settings window.

import { SettingsButton } from "@/components/shared/settings-button";
import type { MembershipRole } from "@/lib/domain/schedule-types";

type RoleDisplay = { badgeLabel: string; label: string };

type Props = {
  role: MembershipRole; // 배지 색 클래스(actor.role — 미리보기와 무관하게 실제 역할)
  roleDisplay: RoleDisplay;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  // 웹 헤더: 설정 팝오버 없이 역할 라벨만.
  quiet?: boolean;
  /**
   * 이 세션의 마지막 저장 시각(KST "HH:MM"). 있으면 **역할 이름 대신** 이 자리에 시각을 쓴다
   * (2026-09-05 소유자: 역할은 계정마다 하나뿐이라 늘 같은 글자였고, 방금 저장이 언제였는지가
   * 훨씬 자주 필요하다). 역할은 배지 색과 aria-label/title로 계속 남는다.
   */
  savedAt?: string | null;
};

export function RoleBadge({ role, roleDisplay, settingsOpen, onOpenSettings, quiet = false, savedAt }: Props) {
  if (quiet) {
    return (
      <div className="actor-badge-wrap">
        <span
          aria-label={savedAt ? `${roleDisplay.label} · 마지막 저장 ${savedAt}` : `역할: ${roleDisplay.label}`}
          className={`actor-badge quiet ${role}${savedAt ? " saved-at" : ""}`}
          title={savedAt ? `${roleDisplay.label} · 마지막 저장 ${savedAt} KST` : roleDisplay.label}
        >
          <strong>{savedAt ?? roleDisplay.badgeLabel}</strong>
        </span>
      </div>
    );
  }
  return (
    <div className="actor-badge-wrap">
      <span className="sr-only">역할: {roleDisplay.label}</span>
      <SettingsButton onClick={onOpenSettings} open={settingsOpen} dataAct="역할 권한 보기" />
    </div>
  );
}
