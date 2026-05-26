"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

// 숲(SOOP) 공지 작성 페이지. 새 탭으로 열어 붙여넣는다.
// TODO: 테스트 끝나면 토리님 방송국으로 교체 → https://www.sooplive.com/station/toryvac/post/write/117337785
const SOOP_WRITE_URL = "https://www.sooplive.com/station/tim917799/post/write/121444601";
// 본문 맨 끝에 항상 붙이는 이모티콘(숲 스티커).
const EMOTICON_URL = "https://stimg.sooplive.com/NORMAL_BBS/1/26636711/15676a0ac2a5d4955.gif";

// 자동 입력 북마클릿: SOOP 작성 페이지에서 클릭하면 클립보드(JSON: title/body)를 읽어
// 제목 입력칸과 본문 에디터에 채워 넣는다. (다른 사이트라 우리 페이지가 직접 못 하므로 북마클릿 방식)
// 셀렉터는 추정치 — 실제 작성 페이지 구조에 맞게 다듬을 수 있다.
const BOOKMARKLET =
  'javascript:(async()=>{try{var d=JSON.parse(await navigator.clipboard.readText());' +
  'var t=document.querySelector(\'textarea[placeholder*="제목"],input[placeholder*="제목"],[class*="Subject"] textarea,[class*="Subject"] input\');' +
  "if(t){var s=Object.getOwnPropertyDescriptor(t.constructor.prototype,'value').set;s.call(t,d.title);t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));}" +
  'var done=false,C=window.CKEDITOR;' +
  'if(C&&C.instances){var k=Object.keys(C.instances)[0];if(k){C.instances[k].setData(d.html);done=true;}}' +
  "if(!done){var f=document.querySelector('iframe.cke_wysiwyg_frame,.cke_contents iframe');if(f&&f.contentDocument&&f.contentDocument.body){f.contentDocument.body.innerHTML=d.html;done=true;}}" +
  "if(!t&&!done){alert('입력칸을 못 찾았어요. 작성 페이지에서 눌렀는지 확인해 주세요.');}" +
  "}catch(x){alert('자동입력 실패: '+(x&&x.message?x.message:x));}})()";

// 모바일 브라우저(삼성 인터넷 등)는 북마크 URL에 공백을 거부한다("URL에는 공백을 포함할 수 없습니다").
// 공백만 %20으로 인코딩하면 저장이 되고, 실행 시 브라우저가 javascript: URL을 디코딩해 원래대로
// 동작한다(코드에 '%' 리터럴이 없어 인코딩 충돌도 없다). 데스크톱에서도 동일하게 동작.
const BOOKMARKLET_SAFE = BOOKMARKLET.replace(/ /g, "%20");

type NoticeModalProps = {
  dateKey: string; // 선택한 날짜 YYYY-MM-DD
  onClose: () => void;
  // 모바일: 직접 붙여넣기(방법 1)는 너무 번거로워 빼고, 북마클릿 자동 입력만 안내한다.
  mobile?: boolean;
};

// "YYYY-MM-DD" → "YY년 M월 d일" (월·일은 0 없이, 연도는 두 자리).
function formatNoticeDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(y).slice(2)}년 ${m}월 ${d}일`;
}

export function NoticeModal({ dateKey, onClose, mobile = false }: NoticeModalProps) {
  const [ampm, setAmpm] = useState<"오전" | "오후">("오후");
  const [time, setTime] = useState(""); // 예: "4시", "5시반"
  const [brief, setBrief] = useState(""); // 방송 내용(간략)
  const [detail, setDetail] = useState(""); // 자세한 내용
  const [copied, setCopied] = useState<"title" | "body" | "payload" | "mark" | null>(null);

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

  async function copy(kind: "title" | "body" | "payload" | "mark", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // 클립보드 권한이 없으면 무시(사용자가 직접 선택 복사 가능).
    }
  }
  // 자동 입력용 본문 HTML — CKEditor에 넣을 가운데 정렬 <p>들 + 맨 끝 이모티콘 이미지.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml =
    body
      .split("\n")
      .map(
        (line) =>
          `<p style="text-align:center;">${line.trim() ? escapeHtml(line) : "&nbsp;"}</p>`
      )
      .join("") +
    `<p style="text-align:center;"><img src="${EMOTICON_URL}" alt="" /></p>`;
  // 북마클릿이 읽을 자동입력 페이로드(제목 + 본문 HTML).
  const autofillPayload = JSON.stringify({ title, html: bodyHtml });

  // 모바일 붙여넣기용: 본문을 서식(가운데정렬·이모티콘) 포함 HTML로 클립보드에 넣는다.
  // 에디터가 HTML 붙여넣기를 받으면 정렬·이모티콘까지 한 번에 들어간다(안 받으면 글자는 그대로).
  async function copyBodyRich() {
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([bodyHtml], { type: "text/html" }),
            "text/plain": new Blob([body], { type: "text/plain" })
          })
        ]);
      } else {
        await navigator.clipboard.writeText(body);
      }
      setCopied("body");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      try {
        await navigator.clipboard.writeText(body);
        setCopied("body");
        window.setTimeout(() => setCopied(null), 1500);
      } catch {
        // 클립보드 권한 없음 — 미리보기에서 직접 선택 복사 가능.
      }
    }
  }

  return (
    <div className="notice-modal">
      <p className="notice-hint">
        <strong>시간이랑 내용만</strong> 적으면 공지 완성!
        {mobile ? (
          <>
            {" "}그 다음 아래 <strong>복사 → 붙여넣기</strong> 순서대로만 하면 숲에 올라갑니다.
          </>
        ) : (
          <>
            {" "}그 다음 아래 <strong>두 방법 중 편한 걸</strong>로 숲에 올리면 됩니다.
          </>
        )}
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

      {/* 완성 미리보기(읽기 전용) — 실제로 올라갈 모습 */}
      <div className="notice-preview">
        <span className="notice-label">완성 미리보기</span>
        <div className="notice-preview-title">{title}</div>
        <pre className="notice-preview-body">{body}</pre>
        <div className="notice-emoticon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="맨 끝 이모티콘" src={EMOTICON_URL} />
          <div className="notice-emoticon-text">
            <span> ← 맨 끝 이모티콘 — 방법 1은 직접 추가, 방법 2는 자동</span>
          </div>
        </div>
      </div>

      {/* 숲에 올리는 방법 안내. 모바일은 복사→붙여넣기(브라우저가 북마클릿을 막아 자동입력 불가),
          웹은 직접 붙여넣기 + 북마클릿 자동 입력. */}
      <div className="notice-methods">
        {mobile ? (
          <section className="notice-method recommended">
            <header className="notice-method-head">
              <strong>복사해서 붙여넣기</strong>
              <span className="notice-method-tag hot">모바일</span>
            </header>
            <p className="notice-method-desc">
              아래 순서대로 <strong>복사 → 페이지 열기 → 붙여넣기</strong>만 하면 돼요. (모바일
              브라우저는 보안상 자동입력 북마클릿을 막아서, 붙여넣기로 올립니다.)
            </p>
            <ol className="notice-steps3">
              <li>
                <span className="notice-step-num">1</span>
                <button
                  className="button primary"
                  onClick={() => copy("title", title)}
                  type="button"
                >
                  <Copy aria-hidden="true" size={14} />
                  {copied === "title" ? "제목 복사됨!" : "제목 복사"}
                </button>
              </li>
              <li>
                <span className="notice-step-num">2</span>
                <a className="button" href={SOOP_WRITE_URL} rel="noopener noreferrer" target="_blank">
                  <ExternalLink aria-hidden="true" size={14} />
                  숲 공지 페이지 열기 → 제목칸에 붙여넣기
                </a>
              </li>
              <li>
                <span className="notice-step-num">3</span>
                <button className="button primary" onClick={copyBodyRich} type="button">
                  <Copy aria-hidden="true" size={14} />
                  {copied === "body" ? "본문 복사됨!" : "본문 복사 (서식 포함)"}
                </button>
              </li>
              <li>
                <span className="notice-step-num">4</span>
                <span className="notice-step-text">본문칸에 붙여넣기 → 끝! ✨</span>
              </li>
            </ol>
            <p className="notice-method-desc">
              혹시 <strong>가운데 정렬이나 이모티콘이 안 따라오면</strong>, 본문을 붙여넣은 뒤
              직접 가운데 정렬하고 위 미리보기의 <strong>맨 끝 이모티콘</strong>만 추가해 주세요!
            </p>
          </section>
        ) : (
          <>
            <section className="notice-method">
              <header className="notice-method-head">
                <span className="notice-method-no">방법 1</span>
                <strong>직접 붙여넣기</strong>
                <span className="notice-method-tag">비추천</span>
              </header>
              <p className="notice-method-desc">
                제목이랑 본문을 따로 복사해서 숲에 붙여넣는 방법. 매번 두 번 붙여넣고
                가운데정렬·이모티콘도 직접 해야 해서 살짝 번거로워요!
              </p>
              <div className="notice-method-actions">
                <button className="button" onClick={() => copy("title", title)} type="button">
                  <Copy aria-hidden="true" size={14} />
                  {copied === "title" ? "복사됨" : "제목 복사"}
                </button>
                <button className="button" onClick={() => copy("body", body)} type="button">
                  <Copy aria-hidden="true" size={14} />
                  {copied === "body" ? "복사됨" : "본문 복사"}
                </button>
                <a className="button" href={SOOP_WRITE_URL} rel="noopener noreferrer" target="_blank">
                  <ExternalLink aria-hidden="true" size={14} />
                  숲 공지 페이지 열기
                </a>
              </div>
            </section>

            <section className="notice-method recommended">
              <header className="notice-method-head">
                <span className="notice-method-no auto">방법 2</span>
                <strong>자동 입력</strong>
                <span className="notice-method-tag hot">추천 · 클릭 3번</span>
              </header>
              <p className="notice-method-desc">
                처음 <strong>딱 한 번만</strong> 북마크를 만들어두면, 그 다음부터는{" "}
                <strong>복사 → 페이지 열기 → 북마크 실행</strong> 세 번이면 끝입니다. 제목·본문은
                물론 <strong>가운데정렬이랑 이모티콘까지</strong> 알아서 쏙 들어갑니다!
              </p>

              <details className="notice-setup">
                <summary>🔧 맨 처음 딱 한 번만: 북마크 만들기 (자세히)</summary>
                <ol className="notice-autofill-steps">
                  <li>
                    먼저 아래 코드를 복사해주세요!
                    <div className="notice-autofill-row">
                      <button className="button" onClick={() => copy("mark", BOOKMARKLET_SAFE)} type="button">
                        <Copy aria-hidden="true" size={13} />
                        {copied === "mark" ? "복사됨!" : "① 북마클릿 코드 복사"}
                      </button>
                    </div>
                  </li>
                  <li>
                    브라우저 <strong>주소창 오른쪽 끝의 별표(☆)</strong>를 눌러 북마크를 하나
                    저장해주세요. (지금 이 페이지 그대로 해주셔도 됩니다!)
                  </li>
                  <li>
                    방금 만든 북마크에 <strong>마우스 우클릭 → “수정...”</strong> 누르기. (북마크바가 안 보이면 Ctrl+Shift+B로 켜주세요)
                  </li>
                  <li>
                    <strong>이름</strong>은 원하시는 걸로 바꾸시고<strong>(예: VIC 자동공지)</strong>,{" "}
                    <strong>URL 칸</strong>의 내용을 전부 지운 뒤 <strong>①에서 복사한 코드를
                    붙여넣어주세요!</strong> → 그리고 저장
                  </li>
                </ol>
                <strong style={{ display: "block", marginTop: "12px" }}>
                  이제 이 “자동공지” 북마크가 자동입력 버튼이 됐습니다 &lt;😎
                </strong>
              </details>

              <ol className="notice-steps3">
                <li>
                  <span className="notice-step-num">1</span>
                  <button
                    className="button primary"
                    onClick={() => copy("payload", autofillPayload)}
                    type="button"
                  >
                    <Copy aria-hidden="true" size={14} />
                    {copied === "payload" ? "복사됨!" : "제목+본문 한 번에 복사"}
                  </button>
                </li>
                <li>
                  <span className="notice-step-num">2</span>
                  <a className="button" href={SOOP_WRITE_URL} rel="noopener noreferrer" target="_blank">
                    <ExternalLink aria-hidden="true" size={14} />
                    숲 공지 페이지 열기
                  </a>
                </li>
                <li>
                  <span className="notice-step-num">3</span>
                  <span className="notice-step-text">“자동공지” 북마크 클릭 → 끝! ✨</span>
                </li>
              </ol>
            </section>
          </>
        )}
      </div>

      <div className="notice-actions">
        <button className="button" onClick={onClose} type="button">
          닫기
        </button>
      </div>
    </div>
  );
}
