// 서버 전용 모듈. node:crypto를 쓰므로 클라이언트 번들에 들어가면 빌드가 깨진다(=가드).
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// 비공개 일정 본문 at-rest 암호화. AES-256-GCM.
// 목적: raw DB 접근(Supabase 대시보드·덤프·백업 유출·읽기복제본)으로는 암호문만 보이게 한다.
// 서버는 런타임에 PRIVATE_DATA_ENC_KEY로 복호화한다(운영자 에스크로우 — E2EE 아님).
//
// 키 분실 = 비공개 본문 복구 불가. 운영자가 PRIVATE_DATA_ENC_KEY를 안전히 백업해야 한다.
// passcode와는 무관 — passcode를 잃어도 본문은 이 키로 살아있다.

// 비공개 이벤트의 평문 컬럼에 남기는 중립 플레이스홀더. 누출돼도 무의미한 값.
export const PRIVATE_PLACEHOLDER_TITLE = "비공개";

const VERSION = "v1";
const IV_BYTES = 12; // GCM 권장 nonce 길이
const KEY_BYTES = 32; // AES-256

export type SecretPayload = {
  publicTitle?: string;
  publicDescription?: string;
  privateTitle?: string;
  privateMemo?: string;
  editorNote?: string;
};

let cachedMaster: Buffer | null = null;

// PRIVATE_DATA_ENC_KEY를 base64 32바이트로 읽는다. 없거나 길이가 틀리면 큰 소리로 throw.
// (passcode.ts의 `?? ""` 무음 폴백 안티패턴 금지 — 키 없이 평문 저장되는 일은 절대 없어야 한다.)
// lazy 호출: import 시점이 아니라 암복호 시점에만 검증 → 키 없는 dev/sample 경로가 import만으로 죽지 않음.
function getMasterKey(): Buffer {
  if (cachedMaster) return cachedMaster;
  const raw = process.env.PRIVATE_DATA_ENC_KEY;
  if (!raw) {
    throw new Error(
      "PRIVATE_DATA_ENC_KEY가 설정되지 않았습니다. 비공개 본문 암호화 키가 필요합니다."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `PRIVATE_DATA_ENC_KEY 길이가 잘못됨(${key.length}바이트). base64로 인코딩된 32바이트여야 합니다.`
    );
  }
  cachedMaster = key;
  return key;
}

// 캘린더별 서브키 — 마스터키를 calendarId로 HKDF 파생. calendarId는 암복호 양쪽에서 알고 있어
// 암호문에 박을 필요가 없다. info/salt 상수는 backfill 스크립트와 반드시 동일해야 한다.
function subkeyFor(calendarId: string): Buffer {
  const master = getMasterKey();
  return Buffer.from(
    hkdfSync("sha256", master, Buffer.from(calendarId, "utf8"), "vic-event-secret", KEY_BYTES)
  );
}

// 비공개 본문 5필드를 JSON으로 암호화 → `v1$<iv>$<tag>$<ct>` (각 파트 base64).
export function encryptSecret(payload: SecretPayload, calendarId: string): string {
  const key = subkeyFor(calendarId);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join("$");
}

// 암호문 복호화. 버전/포맷/인증 실패 시 throw(변조 시 GCM auth tag가 막는다).
export function decryptSecret(stored: string, calendarId: string): SecretPayload {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("secret_cipher 포맷이 올바르지 않습니다.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = subkeyFor(calendarId);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as SecretPayload;
}

// 저장된 값이 우리 암호문인지(평문/레거시와 구분). `v1$`로 시작하면 암호문으로 본다.
export function isCiphertext(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(`${VERSION}$`);
}
