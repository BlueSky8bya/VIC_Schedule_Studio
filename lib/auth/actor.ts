import { cache } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { isOwnerEmail, normalizeEmail } from "@/lib/auth/config";
import { getCurrentSupabaseUser } from "@/lib/auth/server";
import type { User } from "@supabase/supabase-js";

// 역할 판정 결과. (신뢰 멤버/매니저 판정은 2026-09-04 ADR-0018로 철수 — trusted_members 조회 없음.)
export type CurrentActor = {
  email: string | null;
  isAuthenticated: boolean;
  role: MembershipRole;
  /**
   * 역할을 **확정하지 못한 채** 최소 권한으로 떨어졌는지(2026-09-05).
   *
   * 개발자 판정은 platform_admins 조회다. 조회가 실패하면 권한은 당연히 닫아야 하지만(fail closed),
   * 그렇다고 "이 사람은 시청자다"라고 **기록**하면 안 된다 — 소유자가 사용량 화면에서 "시청자가
   * 누를 수 없는 버튼을 시청자가 눌렀다"를 본 원인이 이것이다. 권한 판단은 role을 그대로 쓰고,
   * 행동 기록만 이 표시를 보고 'unknown'으로 남긴다(lib/activity/record.ts).
   */
  roleUncertain?: boolean;
};

export const anonymousActor: CurrentActor = {
  email: null,
  isAuthenticated: false,
  role: "viewer"
};

// 한 요청 안에서 페이지와 여러 로더가 각자 actor를 물어봐도 getUser·역할 조회를
// 한 번만 하도록 React cache로 묶는다(중복 네트워크 왕복 제거).
export const resolveCurrentActor = cache(_resolveCurrentActor);

async function _resolveCurrentActor(calendarSlug = "vic"): Promise<CurrentActor> {
  void calendarSlug; // (캘린더별 신뢰 멤버 조회가 빠져 지금은 쓰지 않는다 — 호출부 시그니처 호환)
  const user = await getCurrentSupabaseUser();
  const email = normalizeEmail(user?.email);

  if (!email) {
    return anonymousActor;
  }

  if (!isGoogleAuthenticatedUser(user)) {
    return {
      email,
      isAuthenticated: true,
      role: "viewer"
    };
  }

  // 관리자(owner)를 가장 먼저 확인 — isOwnerEmail은 env 비교라 DB 왕복이 0이다. 가장 흔한
  // /studio 사용자(관리자)가 platform_admins 조회 없이 즉시 풀리게 해 actor 지연을 줄인다.
  // (관리자 계정과 개발자 계정은 서로 다른 사람이라 우선순위를 바꿔도 권한이 겹치지 않는다.)
  if (isOwnerEmail(email)) {
    return {
      email,
      isAuthenticated: true,
      role: "owner"
    };
  }

  // 플랫폼 개발자 — 본인이 소유하지 않은 캘린더에서도 가로지르는 유지보수 권한을 갖는다.
  const dev = await isPlatformDeveloper(email);
  if (dev === true) {
    return {
      email,
      isAuthenticated: true,
      role: "developer"
    };
  }

  return {
    email,
    isAuthenticated: true,
    role: "viewer",
    // 조회가 실패했다면 '시청자'는 판정이 아니라 **최소 권한**일 뿐이다. 기록은 그렇게 남긴다.
    roleUncertain: dev === "unknown"
  };
}

function isGoogleAuthenticatedUser(user: User | null) {
  if (!user) {
    return false;
  }

  if (user.app_metadata.provider === "google") {
    return true;
  }

  return user.identities?.some((identity) => identity.provider === "google") ?? false;
}

/**
 * 개발자인가 — true / false / "unknown"(조회 자체가 실패).
 *
 * 예전엔 `!error && Boolean(data)`로 오류를 곧장 false(=시청자)로 접었다. 권한 면에서는 맞지만
 * (모르면 안 준다) 행동 기록에는 거짓 사실이 남는다. 세 번째 값으로 갈라 호출부가 고르게 한다.
 */
async function isPlatformDeveloper(email: string): Promise<boolean | "unknown"> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return "unknown";
  }

  const { data, error } = await supabase
    .from("platform_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (error) return "unknown";
  return Boolean(data);
}
