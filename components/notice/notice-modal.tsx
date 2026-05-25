"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

// 숲(SOOP) 공지 작성 페이지(토리님 방송국). 새 탭으로 열어 붙여넣는다.
const SOOP_WRITE_URL = "https://www.sooplive.com/station/tim917799/post/write/121444601";
// 본문 맨 끝에 항상 붙이는 이모티콘(숲 스티커).
const EMOTICON_URL = "https://stimg.sooplive.com/NORMAL_BBS/1/26636711/15676a0ac2a5d4955.gif";

type NoticeModalProps = {
  dateKey: string; // 선택한 날짜 YYYY-MM-DD
  onClose: () => void;
};

// "YYYY-MM-DD" → "YY년 M월 d일" (월·일은 0 없이, 연도는 두 자리).
function formatNoticeDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(y).slice(2)}년 ${m}월 ${d}일`;
}

export function NoticeModal({ dateKey, onClose }: NoticeModalProps) {
  const [ampm, setAmpm] = useState<"오전" | "오후">("오후");
  const [time, setTime] = useState(""); // 예: "4시", "5시반"
  const [brief, setBrief] = useState(""); // 방송 내용(간략)
  const [detail, setDetail] = useState(""); // 자세한 내용
  const [copied, setCopied] = useState<"title" | "body" | null>(null);

  const shownTime = time.trim() || "N시";
  const title = `${formatNoticeDate(dateKey)} - ${shownTime} 뱅온!`;
  // 빈 줄은 공백(nbsp)으로 채워야 SOOP 에디터에 붙여넣을 때 빈 줄이 그대로 남는다(빈 문자열은 합쳐져 사라짐).
  const NB = " ";
  // 템플릿대로 본문을 조립한다. 빈 줄 간격(들여쓰기)은 스펙대로 2·1·2·1줄. 이모티콘은 사용자가 직접 추가.
  const body = [
    "안녕하세요 빅토리입니다~!!",
    NB,
    NB,
    "오늘의 뱅온 시간은~!",
    `${ampm} ${shownTime}에`,
    "키겠습니다!",
    NB,
    "방송 내용은~!",
    brief.trim() || "(방송 내용 간단하게)",
    "합니다!",
    NB,
    NB,
    detail.trim() || "(조금 자세한 내용)",
    "좀따 만나요~!!",
    NB
  ].join("\n");

  async function copy(kind: "title" | "body", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // 클립보드 권한이 없으면 무시(사용자가 직접 선택 복사 가능).
    }
  }

  return (
    <div className="notice-modal">
      <p className="notice-hint">
        날짜·템플릿이 자동으로 채워져 있어요. 시간·내용만 적고 <strong>복사</strong> 후{" "}
        <strong>숲 공지 페이지</strong>에 붙여넣으세요.
      </p>

      <div className="notice-fields">
        <div className="notice-field">
          <span className="notice-label">뱅온 시간</span>
          <div className="notice-time-row">
            <div className="ampm-segment" role="group" aria-label="오전/오후">
              <button
                className={ampm === "오전" ? "active" : ""}
                onClick={() => setAmpm("오전")}
                type="button"
              >
                오전
              </button>
              <button
                className={ampm === "오후" ? "active" : ""}
                onClick={() => setAmpm("오후")}
                type="button"
              >
                오후
              </button>
            </div>
            <input
              aria-label="시간"
              onChange={(e) => setTime(e.target.value)}
              placeholder="예: 4시 / 5시반"
              type="text"
              value={time}
            />
          </div>
        </div>

        <div className="notice-field">
          <span className="notice-label">방송 내용 (간략)</span>
          <input
            onChange={(e) => setBrief(e.target.value)}
            placeholder="예: 명조 2장 8막 ~ 2장 9막 보기!"
            type="text"
            value={brief}
          />
        </div>

        <div className="notice-field">
          <span className="notice-label">자세한 내용</span>
          <textarea
            onChange={(e) => setDetail(e.target.value)}
            placeholder="예: 오늘 빅밥은 파스타! 맛있네요 냠냠~ 준비해서 키도록 하겠습니당!!"
            rows={3}
            value={detail}
          />
        </div>
      </div>

      <div className="notice-preview">
        <div className="notice-preview-head">
          <span className="notice-label">제목</span>
          <button className="button" onClick={() => copy("title", title)} type="button">
            <Copy aria-hidden="true" size={14} />
            {copied === "title" ? "복사됨" : "제목 복사"}
          </button>
        </div>
        <div className="notice-preview-title">{title}</div>

        <div className="notice-preview-head">
          <span className="notice-label">본문</span>
          <button className="button" onClick={() => copy("body", body)} type="button">
            <Copy aria-hidden="true" size={14} />
            {copied === "body" ? "복사됨" : "본문 복사"}
          </button>
        </div>
        <pre className="notice-preview-body">{body}</pre>

        <div className="notice-emoticon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="마지막에 붙일 이모티콘" src={EMOTICON_URL} />
          <div className="notice-emoticon-text">
            <span>{"<- 이 이모티콘은 복사 안됨. 직접 추가 바람!"}</span>
          </div>
        </div>
      </div>

      <div className="notice-actions">
        <a
          className="button primary"
          href={SOOP_WRITE_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" size={15} />
          숲 공지 페이지 열기
        </a>
        <button className="button" onClick={onClose} type="button">
          닫기
        </button>
      </div>
    </div>
  );
}
