import { cache } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { isOwnerEmail, normalizeEmail } from "@/lib/auth/config";
import { getCurrentSupabaseUser } from "@/lib/auth/server";
import type { User } from "@supabase/supabase-js";

export type CurrentActor = {
  email: string | null;
  isAuthenticated: boolean;
  role: MembershipRole;
  trustedRole: "manager" | "worker" | null;
};

export const anonymousActor: CurrentActor = {
  email: null,
  isAuthenticated: false,
  role: "viewer",
  trustedRole: null
};

// 한 요청 안에서 페이지와 여러 로더가 각자 actor를 물어봐도 getUser·역할 조회를
// 한 번만 하도록 React cache로 묶는다(중복 네트워크 왕복 제거).
export const resolveCurrentActor = cache(_resolveCurrentActor);

async function _resolveCurrentActor(calendarSlug = "vic"): Promise<CurrentActor> {
  const user = await getCurrentSupabaseUser();
  const email = normalizeEmail(user?.email);

  if (!email) {
    return anonymousActor;
  }

  if (!isGoogleAuthenticatedUser(user)) {
    return {
      email,
      isAuthenticated: true,
      role: "viewer",
      trustedRole: null
    };
  }

  // 플랫폼 개발자를 가장 먼저 확인해, 본인이 소유하지 않은 캘린더에서도
  // 캘린더를 가로지르는 유지보수 권한을 갖도록 한다.
  if (await isPlatformDeveloper(email)) {
    return {
      email,
      isAuthenticated: true,
      role: "developer",
      trustedRole: null
    };
  }

  if (isOwnerEmail(email)) {
    return {
      email,
      isAuthenticated: true,
      role: "owner",
      trustedRole: null
    };
  }

  const trustedRole = await findTrustedRole(calendarSlug, email);

  if (trustedRole) {
    return {
      email,
      isAuthenticated: true,
      role: trustedRole,
      trustedRole
    };
  }

  return {
    email,
    isAuthenticated: true,
    role: "viewer",
    trustedRole: null
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

async function findTrustedRole(calendarSlug: string, email: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("trusted_members")
    .select("trusted_role, calendars!inner(slug)")
    .eq("email", email)
    .eq("is_active", true)
    .eq("calendars.slug", calendarSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.trusted_role === "manager" || data.trusted_role === "worker"
    ? data.trusted_role
    : null;
}
