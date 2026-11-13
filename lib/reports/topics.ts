// 사이트 제보 말머리·한도 — 제보 창(클라이언트)·저장(서버)·제보함·개인정보처리방침이 같이 쓰는 값.
export const REPORT_TOPICS = [
  { value: "bug", label: "버그", hint: "어떤 화면에서 무엇을 눌렀을 때 어떻게 됐는지 적어 주세요." },
  { value: "schedule", label: "일정 오류", hint: "어느 날짜의 어떤 일정이 틀렸는지, 맞는 내용은 무엇인지 적어 주세요." },
  { value: "idea", label: "아이디어", hint: "있으면 좋겠는 기능이나 바뀌면 좋겠는 점을 자유롭게 적어 주세요." },
  { value: "etc", label: "기타", hint: "그 밖에 전하고 싶은 말을 적어 주세요." }
] as const;

export type ReportTopic = (typeof REPORT_TOPICS)[number]["value"];

export const REPORT_MAX_BODY = 4000;
export const REPORT_MAX_IMAGES = 10; // 0168과 같은 값
export const REPORT_MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 저장소 버킷 한도와 같다(0167)
export const REPORT_RETENTION_DAYS = 90; // 처리 완료 후 보관 기간 — 개인정보처리방침에 적힌 값

export function isReportTopic(v: unknown): v is ReportTopic {
  return typeof v === "string" && REPORT_TOPICS.some((t) => t.value === v);
}

export function topicLabel(v: string): string {
  return REPORT_TOPICS.find((t) => t.value === v)?.label ?? v;
}
