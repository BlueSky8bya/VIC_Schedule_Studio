import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { normalizeEmail } from "@/lib/auth/config";
import { canEditSchedule } from "@/lib/permissions/roles";

export async function POST(request: Request) {
  const actor = await resolveCurrentActor("vic");

  if (!canEditSchedule(actor.role)) {
    return NextResponse.json({ error: "Owner or developer only" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role key is not configured." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const trustedRole = String(formData.get("trustedRole") ?? "manager");

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (trustedRole !== "manager" && trustedRole !== "worker") {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { data: calendar, error: calendarError } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", "vic")
    .maybeSingle();

  if (calendarError || !calendar) {
    return NextResponse.json(
      { error: "Calendar slug 'vic' was not found." },
      { status: 404 }
    );
  }

  const { error } = await supabase.from("trusted_members").upsert(
    {
      calendar_id: calendar.id,
      can_view_embargo: true,
      can_view_work: true,
      display_name: displayName,
      email,
      is_active: true,
      trusted_role: trustedRole,
      // 이중 역할 플래그도 함께 맞춘다(이 경로는 단일 역할 추가 — 모달 패널에서 두 역할 토글 가능).
      is_manager: trustedRole === "manager",
      is_worker: trustedRole === "worker",
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "calendar_id,email"
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/studio/trusted-members", request.url), {
    status: 303
  });
}
