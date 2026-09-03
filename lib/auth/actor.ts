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
  if (await isPlatformDeveloper(email)) {
    return {
      email,
      isAuthenticated: true,
      role: "developer"
    };
  }

  return {
    email,
    isAuthenticated: true,
    role: "viewer"
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

async function isPlatformDeveloper(email: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("platform_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  return !error && Boolean(data);
}
