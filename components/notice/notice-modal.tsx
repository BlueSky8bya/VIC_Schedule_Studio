"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

// 숲(SOOP) 공지 작성 페이지. 새 탭으로 열어 붙여넣는다. 공지 종류마다 글 작성 위치가 다르다.
const SOOP_WRITE_URL_BANGON = "https://www.sooplive.com/station/toryvac/post/write/117337785"; // 뱅온
const SOOP_WRITE_URL_UP = "https://www.sooplive.com/station/toryvac/post/write/117377779"; // 업 도움
// 본문 맨 끝에 붙이는 이모티콘(숲 스티커). 공지 종류마다 다르다.
const EMOTICON_URL = "https://stimg.sooplive.com/NORMAL_BBS/1/26636711/15676a0ac2a5d4955.gif"; // 뱅온
const UP_EMOTICON_URL =
  "https://ogqmarket.img.sooplive.com/sticker/647d872091c8b/23_160.png?version=1"; // 업 도움

// 자동 입력 북마클릿: SOOP 작성 페이지에서 실행하면 클립보드(JSON: title/html/text)를 읽어
// 제목과 본문 에디터에 채운다. SOOP 에디터가 iframe 안에 있을 수 있어 같은 출처(iframe) 문서까지
// 함께 뒤지고, 제목/본문 셀렉터도 여러 후보를 시도한다. 본문은 paste 이벤트를 흉내 내 HTML(가운데
// 정렬·이모티콘 포함)을 넣는다(실패 시 execCommand→innerHTML 폴백). 그래도 못 찾으면 실제 DOM 구조를
// 진단 텍스트로 클립보드에 복사해 개발자가 한 번에 고칠 수 있게 한다.
const BOOKMARKLET =
  "javascript:(async()=>{try{" +
  "var d=JSON.parse(await navigator.clipboard.readText());" +
  "var docs=[document];try{document.querySelectorAll('iframe,frame').forEach(function(f){try{if(f.contentDocument)docs.push(f.contentDocument);}catch(e){}});}catch(e){}" +
  "var tOk=false,bOk=false;" +
  "for(var i=0;i<docs.length;i++){var doc=docs[i];var win=doc.defaultView||window;" +
  "if(!tOk){var ti=doc.querySelector('[class*=\"PostTitle\"] input,[class*=\"PostTitle\"] textarea')||doc.querySelector('input[placeholder*=\"제목\"],textarea[placeholder*=\"제목\"]');" +
  "if(ti){try{var sv=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ti),'value').set;sv.call(ti,d.title);}catch(e){ti.value=d.title;}ti.dispatchEvent(new Event('input',{bubbles:true}));ti.dispatchEvent(new Event('change',{bubbles:true}));tOk=true;}" +
  "else{var tc=doc.querySelector('[class*=\"PostTitle\"] [contenteditable]');if(tc){tc.focus();doc.execCommand('selectAll',false,null);doc.execCommand('insertText',false,d.title);tOk=true;}}}" +
  "if(!bOk){var be=doc.querySelector('.soop-editor-content')||doc.querySelector('.cke_editable')||doc.querySelector('.ck-editor__editable')||doc.querySelector('[contenteditable=\"true\"]')||((doc.body&&doc.body.isContentEditable)?doc.body:null);" +
  "if(be){var filled=function(){return be.textContent.replace(/\\s/g,'').length>=2;};be.focus();var did=false;" +
  "var ed=be.ckeditorInstance||(be.closest?((be.closest('.ck-editor__editable')||{}).ckeditorInstance):null);if(ed&&ed.setData){try{ed.setData(d.html);did=true;}catch(e){}}" +
  "if(!did){try{var CK=win.CKEDITOR||(win.parent&&win.parent.CKEDITOR)||(win.top&&win.top.CKEDITOR);if(CK&&CK.instances){for(var k in CK.instances){try{CK.instances[k].setData(d.html);did=true;}catch(e){}}}}catch(e){}}" +
  "if(!did){var sel=win.getSelection();var rg=doc.createRange();rg.selectNodeContents(be);sel.removeAllRanges();sel.addRange(rg);try{doc.execCommand('selectAll',false,null);}catch(e){}try{doc.execCommand('insertHTML',false,d.html);}catch(e){}if(filled())did=true;}" +
  "if(!did){var dt=new DataTransfer();dt.setData('text/html',d.html);if(d.text)dt.setData('text/plain',d.text);var pe=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});be.dispatchEvent(pe);if(filled())did=true;}" +
  "if(!did){be.innerHTML=d.html;be.dispatchEvent(new Event('input',{bubbles:true}));}" +
  "if(did||filled())bOk=true;}}}" +
  "if(tOk&&bOk)return;" +
  "var L=['[VIC진단] title='+tOk+' body='+bOk+' docs='+docs.length,location.href];" +
  "for(var j=0;j<docs.length;j++){try{var dd=docs[j];var ce=dd.querySelectorAll('[contenteditable]');var ip=dd.querySelectorAll('input,textarea');L.push('doc'+j+' CE='+ce.length+' INP='+ip.length);" +
  "for(var a=0;a<ce.length&&a<4;a++)L.push(' CE'+a+' <'+ce[a].tagName+' class=\"'+ce[a].className+'\">'+(ce[a].ckeditorInstance?' [CKE5]':''));" +
  "for(var b=0;b<ip.length&&b<6;b++)L.push(' INP'+b+' <'+ip[b].tagName+' ph=\"'+(ip[b].placeholder||'')+'\" class=\"'+ip[b].className+'\">');}catch(e){L.push('doc'+j+' (접근불가)');}}" +
  "var rep=L.join('\\n');try{await navigator.clipboard.writeText(rep);}catch(e){}" +
  "alert('입력칸을 일부/전부 못 찾았어요.\\n진단 정보를 클립보드에 복사했으니 개발자에게 붙여넣어 주세요.\\n\\n'+rep);" +
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
  // 이 날짜의 업 도움 일정 값이 있으면 업 공지 칸을 미리 채운다(두 번 일 안 하게).
  initialUpLink?: string;
  initialUpTarget?: string; // 업 도움 일정의 제목 → 업 공지 제목(대상)
};

// "YYYY-MM-DD" → "YY년 M월 d일" (월·일은 0 없이, 연도는 두 자리).
function formatNoticeDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(y).slice(2)}년 ${m}월 ${d}일`;
}

export function NoticeModal({
  dateKey,
  onClose,
  mobile = false,
  initialUpLink = "",
  initialUpTarget = ""
}: NoticeModalProps) {
  // 공지 종류 — 뱅온 공지 / 업 도움 공지(탭 전환).
  const [kind, setKind] = useState<"bangon" | "up">("bangon");
  const [ampm, setAmpm] = useState<"오전" | "오후">("오후");
  const [time, setTime] = useState(""); // 예: "4시", "5시반"
  const [brief, setBrief] = useState(""); // 방송 내용(간략)
  const [detail, setDetail] = useState(""); // 자세한 내용
  // 업 도움 공지 입력
  const [upTarget, setUpTarget] = useState(initialUpTarget); // 제목(예: 연초록님 황제 배생아 대회)
  const [upLink, setUpLink] = useState(initialUpLink); // UP 게시글 링크(본문에 3번 자동 반복)
  const [upComment, setUpComment] = useState(""); // 자유 멘트(여러 줄)
  const [copied, setCopied] = useState<"title" | "body" | "payload" | "mark" | null>(null);

  const isUp = kind === "up";
  const shownTime = time.trim() || "N시";
  // 빈 줄은 공백(nbsp)으로 채워야 SOOP 에디터에 붙여넣을 때 빈 줄이 그대로 남는다(빈 문자열은 합쳐져 사라짐).
  const NB = " ";
  // 템플릿대로 본문을 조립한다. 빈 줄 간격(들여쓰기)은 스펙대로 2·1·2·1줄. 이모티콘은 사용자가 직접 추가.
  const bangonTitle = `${formatNoticeDate(dateKey)} - ${shownTime} 뱅온!`;
  const bangonBody = [
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

  // ── 업 도움 공지 템플릿 ── 링크 3회 반복 + 자유 멘트, 가운데 정렬, 끝 이모티콘.
  const upTitle = `UP 부탁드립니다!! - ${upTarget.trim() || "[대상/이벤트]"}`;
  const upLinkVal = upLink.trim() || "(UP 게시글 링크)";
  const upCommentLines = upComment.trim() ? upComment.split("\n") : ["(하고 싶은 말 — 자유)"];
  const upBody = [upLinkVal, upLinkVal, upLinkVal, NB, NB, ...upCommentLines, NB].join("\n");

  const title = isUp ? upTitle : bangonTitle;
  const body = isUp ? upBody : bangonBody;
  const emoticonUrl = isUp ? UP_EMOTICON_URL : EMOTICON_URL;
  const soopWriteUrl = isUp ? SOOP_WRITE_URL_UP : SOOP_WRITE_URL_BANGON;
  // 북마크 추천 이름(공지 종류별).
  const bookmarkName = isUp ? "VIC 업공지" : "VIC 뱅온공지";

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
  // URL만 있는 줄은 진짜 링크(<a>)로 만든다. 단순 텍스트로 넣으면 SOOP 에디터에서 자동
  // 링크가 안 걸려 클릭이 안 되기 때문(앵커로 넣으면 붙여넣어도 그대로 링크가 유지된다).
  const lineToHtml = (line: string) => {
    const t = line.trim();
    if (!t) return "&nbsp;";
    if (/^https?:\/\/\S+$/.test(t)) {
      const safe = escapeHtml(t);
      return `<a href="${safe}">${safe}</a>`;
    }
    return escapeHtml(t);
  };
  const bodyHtml =
    body
      .split("\n")
      .map((line) => `<p style="text-align:center;">${lineToHtml(line)}</p>`)
      .join("") +
    `<p style="text-align:center;"><img src="${emoticonUrl}" alt="" /></p>`;
  // 북마클릿이 읽을 자동입력 페이로드(제목 + 본문 HTML).
  const autofillPayload = JSON.stringify({ title, html: bodyHtml, text: body });

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
      <div className="notice-tabs" role="group" aria-label="공지 종류">
        <button className={!isUp ? "active" : ""} onClick={() => setKind("bangon")} type="button">
          뱅온 공지
        </button>
        <button className={isUp ? "active" : ""} onClick={() => setKind("up")} type="button">
          업 도움 공지
        </button>
      </div>
      <p className="notice-hint">
        <strong>{isUp ? "대상·링크·할 말만" : "시간이랑 내용만"}</strong> 적으면 공지 완성!
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
        {isUp ? (
          <>
            <div className="notice-field">
              <span className="notice-label">제목</span>
              <input
                onChange={(e) => setUpTarget(e.target.value)}
                placeholder="예: 연초록님 황제 배생아 대회"
                type="text"
                value={upTarget}
              />
            </div>
            <div className="notice-field">
              <span className="notice-label">업 도움 링크 (본문에 3번 들어감)</span>
              <input
                inputMode="url"
                onChange={(e) => setUpLink(e.target.value)}
                placeholder="예: https://www.sooplive.com/station/.../post/..."
                type="url"
                value={upLink}
              />
            </div>
            <div className="notice-field">
              <span className="notice-label">하고 싶은 말 (자유)</span>
              <textarea
                onChange={(e) => setUpComment(e.target.value)}
                placeholder="예: 신청할 자신감이 생겼는데 up 눌러주셔야겠죠 하하"
                rows={3}
                value={upComment}
              />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* 완성 미리보기(읽기 전용) — 실제로 올라갈 모습 */}
      <div className="notice-preview">
        <span className="notice-label">완성 미리보기</span>
        <div className="notice-preview-title">{title}</div>
        <pre className="notice-preview-body">{body}</pre>
        <div className="notice-emoticon center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="맨 끝 이모티콘" src={emoticonUrl} />
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
              아래 순서대로 <strong>복사 → 페이지 열기 → 붙여넣기</strong>
            </p>
            <ol className="notice-steps3">
              <li>
                <span className="notice-step-num">1</span>
                <button className="button primary" onClick={() => copy("title", title)} type="button">
                  <Copy aria-hidden="true" size={14} />
                  {copied === "title" ? "제목 복사됨!" : "제목 복사"}
                </button>
              </li>
              <li>
                <span className="notice-step-num">2</span>
                <a className="button" href={soopWriteUrl} rel="noopener noreferrer" target="_blank">
                  <ExternalLink aria-hidden="true" size={14} />
                  숲 공지 페이지 열기
                </a>
              </li>
              <li>
                <span className="notice-step-num">3</span>
                <button className="button primary" onClick={copyBodyRich} type="button">
                  <Copy aria-hidden="true" size={14} />
                  {copied === "body" ? "본문 복사됨!" : "본문 복사"}
                </button>
              </li>
            </ol>
            <p className="notice-method-desc">
              💡 첫 붙여넣기 뒤엔 화면 아래{" "}
              <strong>
                탭 버튼
                <Copy aria-hidden="true" size={13} style={{ verticalAlign: "-2px", margin: "0 2px" }} />
              </strong>
              으로 이 창과 숲을 오가며 붙여넣으세요. (뒤로가기 ✕)
            </p>
            {isUp ? (
              <p className="notice-method-desc">
                ※ 모바일은 <strong>링크가 자동 적용 안 돼요.</strong> 붙여넣은 뒤 링크 줄을 눌러 직접
                적용해 주세요.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="notice-method recommended">
            <header className="notice-method-head">
              <strong>북마클릿 자동 입력</strong>
              <span className="notice-method-tag hot">추천 · 클릭 3번</span>
            </header>
            <p className="notice-method-desc">
              처음 <strong>한 번만</strong> 북마크를 만들어두면,{" "}
              <strong>복사 → 페이지 열기 → 북마크 실행</strong> 세 번이면 끝입니다! 제목·본문은
              물론 <strong>가운데정렬이랑 이모티콘까지</strong> 알아서 쏙 들어갑니다.
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
                  저장해주세요.
                </li>
                <li>
                  방금 만든 북마크에 <strong>마우스 우클릭 → “수정..”</strong> 누르기. (북마크바가 안 보이면 Ctrl+Shift+B)
                </li>
                <li>
                  <strong>이름</strong>은 <strong>“{bookmarkName}”</strong>으로 바꾸시고,{" "}
                  <strong>URL 칸</strong>의 내용을 전부 지운 뒤 <strong>①에서 복사한 코드를
                  붙여넣고 저장해주세요!</strong>
                </li>
              </ol>
              <strong style={{ display: "block", marginTop: "12px" }}>
                이제 이 “{bookmarkName}” 북마크가 자동입력 버튼이 됐습니다 &lt;😎
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
                <a className="button" href={soopWriteUrl} rel="noopener noreferrer" target="_blank">
                  <ExternalLink aria-hidden="true" size={14} />
                  숲 공지 페이지 열기
                </a>
              </li>
              <li>
                <span className="notice-step-num">3</span>
                <span className="notice-step-text">“{bookmarkName}” 북마크 클릭 → 끝! ✨</span>
              </li>
            </ol>
          </section>
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
