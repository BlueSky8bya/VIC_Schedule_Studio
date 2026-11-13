"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Bug, CalendarX, Check, Heart, ImagePlus, Lightbulb, Mail as MailIcon, MessageCircle, Send, Settings, X } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { REPORT_MAX_BODY, REPORT_MAX_IMAGE_BYTES, REPORT_MAX_IMAGES, REPORT_RETENTION_DAYS, REPORT_TOPICS, type ReportTopic } from "@/lib/reports/topics";
import { setThemeMode, themeMode, type ThemeMode } from "@/lib/ui/theme";
import { CONTACT_AVATAR, LEGAL_CONTACT_EMAIL } from "./contact";
import styles from "./legal-doc.module.css";

// 문서 페이지의 '움직이는' 조각들. 문서 본문은 서버 컴포넌트이고, 누를 수 있는 것만 여기 모은다.

/** 하트 예시 — 눌러 보는 체험용. 서버에 아무것도 보내지 않는다. */
export function HeartDemo() {
  const [on, setOn] = useState(false);
  return (
    <div className={styles.mockCard}>
      <span className={styles.mockBar} />
      <span className={styles.mockText}>
        <b>21시 합방</b>
        <i>{on ? "기기 번호·일정·시각이 저장된 상태" : "아직 아무것도 저장되지 않은 상태"}</i>
      </span>
      <button
        aria-label={on ? "하트 취소(예시)" : "하트 누르기(예시)"}
        aria-pressed={on}
        className={`${styles.mockHeart}${on ? ` ${styles.mockHeartOn}` : ""}`}
        data-act="legal-demo-heart"
        onClick={() => setOn((v) => !v)}
        type="button"
      >
        <Heart fill={on ? "currentColor" : "none"} size={15} />
      </button>
    </div>
  );
}

/** 화면 모드 — 실제 설정과 같은 값(저장소 vic.dark)을 바꾼다. 이 기기의 브라우저에만 저장된다. */
export function ThemeDemo() {
  const [mode, setMode] = useState<ThemeMode | null>(null);
  useEffect(() => setMode(themeMode()), []);
  const options: { value: ThemeMode; label: string }[] = [
    { value: "light", label: "밝게" },
    { value: "dark", label: "어둡게" },
    { value: "system", label: "자동" }
  ];
  return (
    <div className={styles.mockRow}>
      <span aria-hidden="true" className={styles.mockGear}>
        <Settings size={16} />
      </span>
      <span className={styles.mockLabel}>화면 모드</span>
      <span className={styles.mockSeg} role="radiogroup" aria-label="화면 모드">
        {options.map((o) => (
          <button
            aria-checked={mode === o.value}
            className={mode === o.value ? styles.mockSegOn : undefined}
            data-act="legal-demo-theme"
            data-act-opt={o.value}
            key={o.value}
            onClick={() => {
              setThemeMode(o.value);
              setMode(o.value);
            }}
            role="radio"
            type="button"
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}

/** 실제 Google 로그인 — 일정표의 로그인과 같은 경로. 로그인 후 이 문서로 돌아온다. */
export function GoogleLoginDemo({ next }: { next: string }) {
  return (
    <form action="/api/auth/login" method="post">
      <input name="next" type="hidden" value={next} />
      <button className={styles.mockGoogle} data-act="legal-demo-login" type="submit">
        <GoogleMark />
        Google로 로그인
      </button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="16" viewBox="0 0 48 48" width="16">
      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
      <path d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" fill="#FF3D00" />
      <path d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 36.9 26.9 38 24 38c-6 0-10.7-3.9-12.5-9.3l-6.9 5.3C7.9 41.6 15.3 46 24 46z" fill="#4CAF50" />
      <path d="M44.5 20H24v8.5h11.8c-1 2.8-2.9 5.1-5.3 6.6l6.5 5.5C40.9 44.4 46 38 46 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
    </svg>
  );
}

// ── 사이트 제보 ──
// 말머리·내용·캡처(최대 4장)·선택 이메일을 /api/report로 보낸다(lib/reports/report.ts가 검증·저장, 개발자 제보함에 쌓인다).
// 캡처는 보내기 전에 브라우저에서 긴 변 1600px·webp로 줄인다(저장소 한도 2MB, 올리는 시간도 짧게).
const MAX_SIDE = 1600;

async function shrinkImage(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", q));
      if (blob && blob.size <= REPORT_MAX_IMAGE_BYTES) return blob;
    }
    return null;
  } catch {
    return null;
  }
}

type Shot = { id: string; blob: Blob; url: string };

export function ContactAvatar({ size = 44 }: { size?: number }) {
  return CONTACT_AVATAR ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={styles.avatar} height={size} src={CONTACT_AVATAR} width={size} />
  ) : (
    <span aria-hidden="true" className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      3B
    </span>
  );
}

/** 제보 창을 여는 단추. variant: side = 목차 아래 프로필 카드, banner = 본문 홍보 띠의 큰 버튼. */
export function ContactButton({ variant, initialTopic = "bug" }: { variant: "side" | "banner"; initialTopic?: ReportTopic }) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId(); // 제보 창이 한 페이지에 둘(목차 카드·홍보 띠) — id가 겹치지 않게
  const [topic, setTopic] = useState<ReportTopic>(initialTopic);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const current = REPORT_TOPICS.find((t) => t.value === topic) ?? REPORT_TOPICS[0];

  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.url)), [shots]);

  const addFiles = async (files: Iterable<File>) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    const room = REPORT_MAX_IMAGES - shots.length;
    if (list.length === 0) return;
    if (room <= 0) {
      setMessage(`캡처는 ${REPORT_MAX_IMAGES}장까지 붙일 수 있어요.`);
      return;
    }
    const added: Shot[] = [];
    for (const f of list.slice(0, room)) {
      const blob = await shrinkImage(f);
      if (blob) added.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
    }
    setMessage(list.length > room ? `캡처는 ${REPORT_MAX_IMAGES}장까지예요. 앞의 ${room}장만 붙였어요.` : added.length < Math.min(list.length, room) ? "읽지 못한 이미지가 있어요." : "");
    setShots((s) => [...s, ...added]);
  };

  const open = () => {
    if (state === "sent") {
      setState("idle");
      setText("");
      setShots([]);
    }
    setMessage("");
    ref.current?.showModal();
  };

  const send = async () => {
    if (!text.trim()) {
      setMessage("내용을 적어 주세요.");
      return;
    }
    setState("sending");
    setMessage("");
    const form = new FormData();
    form.set("topic", topic);
    form.set("body", text.trim());
    if (email.trim()) form.set("email", email.trim());
    form.set("page", window.location.pathname);
    form.set("device", window.matchMedia("(max-width: 640px)").matches ? "mobile" : "desktop");
    form.set("website", (document.getElementById(`${uid}-hp`) as HTMLInputElement | null)?.value ?? "");
    shots.forEach((s, i) => form.append("images", s.blob, `shot-${i + 1}.webp`));
    try {
      const res = await fetch("/api/report", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setState("sent");
        return;
      }
      setState("error");
      setMessage(data?.error ?? "보내지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } catch {
      setState("error");
      setMessage("연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <>
      {variant === "side" ? (
        <button className={styles.contactSide} data-act="legal-contact-open" onClick={open} type="button">
          <span className={styles.avatarRing}>
            <ContactAvatar />
          </span>
          <span className={styles.contactSideText}>
            <strong>사이트 제보</strong>
            <span>버그·아이디어 보내기</span>
          </span>
          <MailIcon aria-hidden="true" className={styles.contactSideIcon} size={16} />
        </button>
      ) : (
        <button className={styles.bannerButton} data-act="legal-contact-banner" onClick={open} type="button">
          <Send aria-hidden="true" size={16} />
          제보하기
        </button>
      )}
      <dialog
        aria-labelledby={`${uid}-title`}
        className={styles.dialog}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close(); // 바깥(배경)을 누르면 닫는다
        }}
        ref={ref}
      >
        <div
          className={styles.dialogCard}
          onPaste={(e) => {
            const files = [...e.clipboardData.files];
            if (files.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
        >
          <header className={styles.dialogHead}>
            <ContactAvatar size={48} />
            <div>
              <h2 id={`${uid}-title`}>사이트 제보</h2>
              <p>개발자에게 바로 전달됩니다</p>
            </div>
            <button aria-label="닫기" className={styles.dialogClose} data-act="legal-contact-close" onClick={() => ref.current?.close()} type="button">
              <X size={18} />
            </button>
          </header>

          {state === "sent" ? (
            <div className={styles.sent} role="status">
              <span className={styles.sentIcon}>
                <Check size={26} />
              </span>
              <strong>보냈어요. 고맙습니다!</strong>
              <span>{email.trim() ? "답이 필요하면 적어 주신 메일로 연락드릴게요." : "꼼꼼히 읽고 반영할게요."}</span>
              <button className={styles.bannerButton} data-act="legal-contact-done" onClick={() => ref.current?.close()} type="button">
                닫기
              </button>
            </div>
          ) : (
            <>
              <div aria-label="말머리" className={styles.topics} role="radiogroup">
                {REPORT_TOPICS.map((t) => (
                  <button
                    aria-checked={topic === t.value}
                    className={topic === t.value ? styles.topicOn : undefined}
                    data-act="legal-contact-topic"
                    data-act-opt={t.value}
                    key={t.value}
                    onClick={() => setTopic(t.value)}
                    role="radio"
                    type="button"
                  >
                    {TOPIC_ICON[t.value]}
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                aria-label="제보 내용"
                className={styles.dialogText}
                maxLength={REPORT_MAX_BODY}
                onChange={(e) => setText(e.target.value)}
                placeholder={current.hint}
                rows={6}
                value={text}
              />
              <div
                className={`${styles.drop}${dragOver ? ` ${styles.dropOver}` : ""}`}
                data-act="legal-contact-attach"
                onClick={() => fileRef.current?.click()}
                onDragLeave={() => setDragOver(false)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void addFiles(e.dataTransfer.files);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <ImagePlus aria-hidden="true" size={20} />
                <strong>화면 캡처가 있으면 붙여넣거나(Ctrl+V) 눌러서 추가</strong>
                <span>선택 · 최대 {REPORT_MAX_IMAGES}장</span>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  multiple
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                  ref={fileRef}
                  type="file"
                />
              </div>
              {shots.length ? (
                <ul className={styles.shots}>
                  {shots.map((s, i) => (
                    <li key={s.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={`첨부한 캡처 ${i + 1}`} src={s.url} />
                      <button
                        aria-label={`캡처 ${i + 1} 빼기`}
                        data-act="legal-contact-unattach"
                        onClick={() => setShots((all) => all.filter((x) => x.id !== s.id))}
                        type="button"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className={styles.emailRow}>
                <span>답장 받을 이메일 (선택)</span>
                <input
                  autoComplete="email"
                  className={styles.emailInput}
                  inputMode="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="비워 두면 답장 없이 보내요"
                  type="email"
                  value={email}
                />
              </label>
              {/* 봇 거르기 — 사람에게는 보이지 않는 칸 */}
              <input aria-hidden="true" autoComplete="off" className={styles.hp} id={`${uid}-hp`} name="website" tabIndex={-1} type="text" />
              <p className={styles.dialogNote}>
                제보는 처리 완료 후 {REPORT_RETENTION_DAYS}일 뒤 캡처와 함께 지워집니다. 캡처에 다른 사람의 개인정보가 보이지 않게 해 주세요.
                개인정보 열람·삭제 요청은 <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>로 보내 주세요.
              </p>
              {message ? (
                <p className={styles.formMsg} role={state === "error" ? "alert" : "status"}>
                  {message}
                </p>
              ) : null}
              <button className={styles.sendButton} data-act="legal-contact-send" disabled={state === "sending"} onClick={send} type="button">
                {state === "sending" ? <LoadingSpinner small /> : <Send aria-hidden="true" size={16} />}
                {state === "sending" ? "보내는 중…" : "보내기"}
              </button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

const TOPIC_ICON: Record<ReportTopic, ReactNode> = {
  bug: <Bug size={15} />,
  schedule: <CalendarX size={15} />,
  idea: <Lightbulb size={15} />,
  etc: <MessageCircle size={15} />
};
