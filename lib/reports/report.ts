import { createSupabaseAdminClient } from "@/lib/auth/admin";
import {
  isReportTopic,
  REPORT_MAX_BODY,
  REPORT_MAX_IMAGE_BYTES,
  REPORT_MAX_IMAGES,
  REPORT_RETENTION_DAYS
} from "@/lib/reports/topics";

// 사이트 제보 저장·정리(0167). 서버 전용 — service_role로만 쓰고 읽는다. 제보 창은 /api/report로 보낸다.
// 받는 것: 말머리, 내용, 캡처(최대 10장), 선택 이메일, 보낸 화면 경로, 기기 종류(PC/모바일). IP·브라우저 상세는 저장하지 않는다.

const BUCKET = "site-reports";
// 저장소가 넘치지 않게 거는 전체 상한 — 한 시간에 이보다 많이 들어오면 잠시 받지 않는다(도배 방지).
const HOURLY_CAP = 40;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SubmitResult = { ok: true } | { ok: false; status: number; error: string };

// 이미지 형식은 확장자·선언 대신 파일 앞부분(매직 바이트)으로 확인한다.
function sniffImage(buf: Uint8Array): { ext: "webp" | "png" | "jpg"; mime: string } | null {
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return { ext: "webp", mime: "image/webp" };
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  return null;
}

function cleanPage(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  // 경로만(쿼리·해시·외부 주소 제외) — 자유 입력이 섞이지 않게.
  const path = v.split(/[?#]/)[0].slice(0, 200);
  return /^\/[\w\-/.%]*$/.test(path) ? path : null;
}

export async function submitReport(form: FormData): Promise<SubmitResult> {
  // 봇이 채우는 숨은 칸 — 사람은 비워 둔다. 채워져 있으면 저장하지 않고 성공처럼 답한다.
  if (typeof form.get("website") === "string" && String(form.get("website")).length > 0) return { ok: true };

  const topic = form.get("topic");
  if (!isReportTopic(topic)) return { ok: false, status: 400, error: "말머리를 골라 주세요." };
  const body = typeof form.get("body") === "string" ? String(form.get("body")).trim() : "";
  if (!body) return { ok: false, status: 400, error: "내용을 적어 주세요." };
  if (body.length > REPORT_MAX_BODY) return { ok: false, status: 400, error: `내용은 ${REPORT_MAX_BODY}자까지 보낼 수 있어요.` };
  const rawEmail = typeof form.get("email") === "string" ? String(form.get("email")).trim() : "";
  if (rawEmail && (rawEmail.length > 254 || !EMAIL_RE.test(rawEmail))) {
    return { ok: false, status: 400, error: "이메일 주소를 다시 확인해 주세요." };
  }
  const device = form.get("device") === "mobile" ? "mobile" : form.get("device") === "desktop" ? "desktop" : null;

  const files = form.getAll("images").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (files.length > REPORT_MAX_IMAGES) return { ok: false, status: 400, error: `캡처는 ${REPORT_MAX_IMAGES}장까지 보낼 수 있어요.` };
  const images: { bytes: Uint8Array; ext: string; mime: string }[] = [];
  for (const f of files) {
    if (f.size > REPORT_MAX_IMAGE_BYTES) return { ok: false, status: 400, error: "캡처 한 장이 너무 커요(2MB까지)." };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { ok: false, status: 400, error: "이미지 파일(PNG·JPG·WEBP)만 보낼 수 있어요." };
    images.push({ bytes, ...kind });
  }

  const db = createSupabaseAdminClient();
  if (!db) return { ok: false, status: 503, error: "지금은 제보를 받을 수 없어요. 잠시 뒤 다시 시도해 주세요." };

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("site_report").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= HOURLY_CAP) return { ok: false, status: 429, error: "제보가 몰리고 있어요. 잠시 뒤 다시 보내 주세요." };

  const id = crypto.randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const paths: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const path = `${day}/${id}/${i + 1}.${images[i].ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, images[i].bytes, { contentType: images[i].mime, upsert: false });
    if (error) {
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      return { ok: false, status: 502, error: "캡처를 올리지 못했어요. 잠시 뒤 다시 시도해 주세요." };
    }
    paths.push(path);
  }

  const { error } = await db.from("site_report").insert({
    id,
    topic,
    body,
    reply_email: rawEmail || null,
    page: cleanPage(form.get("page")),
    device,
    images: paths
  });
  if (error) {
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    return { ok: false, status: 502, error: "제보를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
  return { ok: true };
}

export type ReportRow = {
  id: string;
  created_at: string;
  topic: string;
  body: string;
  reply_email: string | null;
  page: string | null;
  device: string | null;
  images: string[];
  done_at: string | null;
  replied_at: string | null;
  seen_at: string | null;
};

/** 제보함 목록 — 캡처는 1시간짜리 서명 주소로. */
export async function listReports(): Promise<(ReportRow & { imageUrls: string[] })[] | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("site_report")
    .select("id, created_at, topic, body, reply_email, page, device, images, done_at, replied_at, seen_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return null;
  const rows = data as ReportRow[];
  const allPaths = rows.flatMap((r) => r.images);
  const signed = new Map<string, string>();
  if (allPaths.length) {
    const { data: urls } = await db.storage.from(BUCKET).createSignedUrls(allPaths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({ ...r, imageUrls: r.images.map((p) => signed.get(p)).filter((u): u is string => Boolean(u)) }));
}

export async function setReportDone(id: string, done: boolean): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;
  const { error } = await db.from("site_report").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  return !error;
}

/** 아직 개발자가 보지 않은 제보 수 — 헤더 제보함 단추의 숫자. */
export async function countUnseenReports(): Promise<number | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  const { count, error } = await db.from("site_report").select("id", { count: "exact", head: true }).is("seen_at", null);
  return error ? null : count ?? 0;
}

/** 제보함을 열면 지금까지 들어온 제보를 '봄'으로. */
export async function markReportsSeen(): Promise<void> {
  const db = createSupabaseAdminClient();
  if (!db) return;
  await db.from("site_report").update({ seen_at: new Date().toISOString() }).is("seen_at", null);
}

/** 답장 받는 주소는 화면이 보낸 값이 아니라 저장된 제보에서 읽는다. */
export async function getReplyEmail(id: string): Promise<string | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;
  const { data } = await db.from("site_report").select("reply_email").eq("id", id).maybeSingle();
  return (data?.reply_email as string | null | undefined) ?? null;
}

/** 답장 메일을 보냈다고 표시(제보함의 답장 창에서 Gmail로 보낸 뒤). */
export async function setReportReplied(id: string, replied: boolean): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;
  const { error } = await db.from("site_report").update({ replied_at: replied ? new Date().toISOString() : null }).eq("id", id);
  return !error;
}

export async function deleteReport(id: string): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return false;
  const { data } = await db.from("site_report").select("images").eq("id", id).maybeSingle();
  const paths = (data?.images as string[] | undefined) ?? [];
  if (paths.length) {
    const { error } = await db.storage.from(BUCKET).remove(paths);
    if (error) return false;
  }
  const { error } = await db.from("site_report").delete().eq("id", id);
  return !error;
}

/** 처리 완료 후 보관 기간이 지난 제보를 파일까지 지운다 — 시간별 예약 작업이 부른다. */
export async function purgeExpiredReports(): Promise<{ deleted: number } | { error: string }> {
  const db = createSupabaseAdminClient();
  if (!db) return { error: "no-db" };
  const cutoff = new Date(Date.now() - REPORT_RETENTION_DAYS * 86400_000).toISOString();
  const { data, error } = await db.from("site_report").select("id, images").lt("done_at", cutoff).limit(50);
  if (error) return { error: error.message };
  let deleted = 0;
  for (const r of (data ?? []) as { id: string; images: string[] }[]) {
    if (r.images.length) {
      const { error: rmErr } = await db.storage.from(BUCKET).remove(r.images);
      if (rmErr) continue; // 파일을 못 지웠으면 행도 남겨 다음 시간에 다시 시도
    }
    const { error: delErr } = await db.from("site_report").delete().eq("id", r.id);
    if (!delErr) deleted++;
  }
  return { deleted };
}
