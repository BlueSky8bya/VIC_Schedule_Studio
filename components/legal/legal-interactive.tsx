"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Bug, Check, Copy, Heart, Lightbulb, Mail as MailIcon, Send, Settings, ShieldCheck, X } from "lucide-react";
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

// ── 문의 ──
// 문의 창은 메일 앱을 열어 줄 뿐 사이트에 아무것도 저장하지 않는다(개인정보처리방침 '문의' 항목과 같은 경계).
type Topic = "bug" | "idea" | "privacy";
const TOPICS: { value: Topic; label: string; icon: ReactNode; subject: string; hint: string }[] = [
  { value: "bug", label: "버그 제보", icon: <Bug size={16} />, subject: "[버그 제보]", hint: "어떤 화면에서, 무엇을 눌렀을 때, 어떻게 됐는지 적어 주세요. 사용하는 기기(PC·폰)도 알려 주시면 빨라요." },
  { value: "idea", label: "아이디어", icon: <Lightbulb size={16} />, subject: "[아이디어]", hint: "있으면 좋겠는 기능이나 바뀌면 좋겠는 점을 자유롭게 적어 주세요." },
  { value: "privacy", label: "개인정보 요청", icon: <ShieldCheck size={16} />, subject: "[개인정보 요청]", hint: "열람·정정·삭제·처리 정지 중 원하는 것을 적고, 로그인에 쓴 계정 이메일로 보내 주세요." }
];

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

/** 문의 창을 여는 단추. variant: side = 목차 아래 프로필 카드, banner = 본문 홍보 띠의 큰 버튼. */
export function ContactButton({ variant, initialTopic = "bug" }: { variant: "side" | "banner"; initialTopic?: Topic }) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId(); // 문의 창이 한 페이지에 둘(목차 카드·홍보 띠) — id가 겹치지 않게
  const titleId = `${uid}-title`;
  const textId = `${uid}-text`;
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const current = TOPICS.find((t) => t.value === topic) ?? TOPICS[0];
  const mailto = `mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(`${current.subject} 빅토리 방송 일정표`)}&body=${encodeURIComponent(text)}`;

  const open = () => {
    setCopied(false);
    ref.current?.showModal();
  };

  return (
    <>
      {variant === "side" ? (
        <button className={styles.contactSide} data-act="legal-contact-open" onClick={open} type="button">
          <span className={styles.avatarRing}>
            <ContactAvatar />
          </span>
          <span className={styles.contactSideText}>
            <strong>문의하기</strong>
            <span>버그·아이디어 보내기</span>
          </span>
          <MailIcon aria-hidden="true" className={styles.contactSideIcon} size={16} />
        </button>
      ) : (
        <button className={styles.bannerButton} data-act="legal-contact-banner" onClick={open} type="button">
          <Send aria-hidden="true" size={16} />
          메일로 보내기
        </button>
      )}
      <dialog
        aria-labelledby={titleId}
        className={styles.dialog}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close(); // 바깥(배경)을 누르면 닫는다
        }}
        ref={ref}
      >
        <div className={styles.dialogCard}>
          <header className={styles.dialogHead}>
            <ContactAvatar size={48} />
            <div>
              <h2 id={titleId}>운영자에게 문의</h2>
              <p>{LEGAL_CONTACT_EMAIL}</p>
            </div>
            <button aria-label="닫기" className={styles.dialogClose} data-act="legal-contact-close" onClick={() => ref.current?.close()} type="button">
              <X size={18} />
            </button>
          </header>
          <div className={styles.topics} role="radiogroup" aria-label="문의 종류">
            {TOPICS.map((t) => (
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
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <label className={styles.dialogLabel} htmlFor={textId}>
            {current.hint}
          </label>
          <textarea
            className={styles.dialogText}
            id={textId}
            onChange={(e) => setText(e.target.value)}
            placeholder="내용을 적으면 메일 본문에 그대로 들어가요."
            rows={6}
            value={text}
          />
          <p className={styles.dialogNote}>보내기를 누르면 이용하시는 메일 앱이 열립니다. 이 창에 적은 내용은 사이트에 저장되지 않습니다.</p>
          <div className={styles.dialogActions}>
            <button
              className={styles.ghostButton}
              data-act="legal-contact-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(LEGAL_CONTACT_EMAIL);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              type="button"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "주소 복사됨" : "주소 복사"}
            </button>
            <a className={styles.bannerButton} data-act="legal-contact-send" href={mailto} onClick={() => ref.current?.close()}>
              <Send aria-hidden="true" size={16} />
              메일 앱으로 보내기
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
