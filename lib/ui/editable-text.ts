"use client";

// contenteditable 한 칸을 "여러 줄 순수 텍스트"로 다루는 함수들(편집실 내용칸, 2026-09-17).
//  · 정규형: 첫 줄은 맨 텍스트, 다음 줄부터 <div>(빈 줄은 <div><br></div>) — CSS(첫 줄 굵게)가 한 규칙으로 맞는다.
//  · 읽기: innerText를 믿지 않고 DOM을 직접 걷는다. Chrome은 첫 줄(맨 텍스트) 끝에서 Enter를 치면 굵기를 이으려
//    <b>를 넣고 뒤 줄들을 중첩 <div>로 감싸며 <br>을 남기는데(2026-10-14 실측: 게임<div><b>abc<br></b><div>와우</div>…),
//    innerText는 그 <br>에서 빈 줄을 하나 더 만든다 → 저장 후 다시 열면 줄 사이가 벌어졌다.
//  · 정규화: 입력마다 구조가 정규형이 아니면(<b>·<span style>·중첩 div) 다시 쓰고 커서를 같은 글자 자리로 돌린다.
const BLOCK_TAGS = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"]);

// 줄 끝 <br>(뒤에 같은 블록 안 내용이 없음)인가 — Chrome이 줄을 지키려 남기는 자리표시라 줄바꿈으로 세지 않는다.
function isTrailingBr(br: Node, root: HTMLElement): boolean {
  let n: Node = br;
  while (n !== root) {
    for (let s = n.nextSibling; s; s = s.nextSibling) {
      if (s.nodeType === Node.ELEMENT_NODE || (s.nodeValue ?? "") !== "") return false;
    }
    const parent = n.parentNode;
    if (!parent || (parent.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((parent as Element).tagName))) return true;
    n = parent;
  }
  return true;
}

// raw = 끝 빈 줄까지 그대로(정규화 비교용), text = 끝 개행을 걷은 값(폼 값).
function serialize(el: HTMLElement, caretNode?: Node | null, caretOffset = 0) {
  let out = "";
  let atLineStart = true; // 지금 줄에 아직 아무것도 없다
  let pending = false; // 블록이 닫혀 줄이 끝났다 — 다음 내용이 올 때만 \n을 쓴다(끝 블록이 빈 줄을 덧붙이지 않게)
  let caret: number | null = null;
  const flush = () => {
    if (!pending) return;
    out += "\n";
    pending = false;
    atLineStart = true;
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue ?? "";
      if (t || node === caretNode) flush();
      if (node === caretNode) caret = out.length + caretOffset;
      if (t) {
        out += t;
        atLineStart = false;
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName;
    if (tag === "BR") {
      flush();
      if (!isTrailingBr(node, el)) {
        out += "\n";
        atLineStart = true;
      } else if (atLineStart) {
        atLineStart = false; // 빈 줄 <div><br></div>: 줄이 '있다'로 표시만
      }
      return;
    }
    const block = node !== el && BLOCK_TAGS.has(tag);
    if (block) {
      flush();
      if (!atLineStart) {
        out += "\n";
        atLineStart = true;
      }
    }
    node.childNodes.forEach((child, i) => {
      if (node === caretNode && i === caretOffset) {
        flush();
        caret = out.length;
      }
      visit(child);
    });
    if (node === caretNode && caretOffset >= node.childNodes.length) caret = out.length;
    if (block && !atLineStart) pending = true;
  };
  visit(el);
  // NBSP(U+00A0)는 코드포인트로 만든다 — 리터럴로 두면 no-irregular-whitespace 린트에 걸린다(2026-09-17 Vercel 빌드 실패).
  const nbsp = new RegExp(String.fromCharCode(160), "g");
  const raw = out.replace(nbsp, " ").replace(/\r/g, "");
  const text = raw.replace(/\n+$/, "");
  return { raw, text, caret: caret === null ? null : Math.min(caret, raw.length) };
}

export function readEditableText(el: HTMLElement): string {
  return serialize(el).text;
}

export function writeEditableText(el: HTMLElement, text: string): void {
  el.textContent = "";
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (i === 0) {
      if (line) el.appendChild(document.createTextNode(line));
      return;
    }
    const div = document.createElement("div");
    if (line) div.textContent = line;
    else div.appendChild(document.createElement("br"));
    el.appendChild(div);
  });
}

function canonicalHtml(text: string): string {
  const probe = document.createElement("div");
  writeEditableText(probe, text);
  return probe.innerHTML;
}

// 글자 자리(줄을 \n으로 이은 텍스트 기준) → 정규형 DOM 위 커서.
function placeCaret(el: HTMLElement, text: string, offset: number): void {
  const before = text.slice(0, offset).split("\n");
  const line = before.length - 1;
  const col = before[line].length;
  let container: Node = el;
  let pos = 0;
  if (line === 0) {
    const first = el.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) [container, pos] = [first, col];
  } else {
    const div = el.querySelectorAll(":scope > div")[line - 1];
    if (div) {
      const t = div.firstChild;
      if (t && t.nodeType === Node.TEXT_NODE) [container, pos] = [t, col];
      else [container, pos] = [div, 0];
    }
  }
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(container, pos);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// 입력 직후 호출 — 정규형이면 아무것도 안 하고(타이핑 중 DOM을 건드리지 않는다), 아니면 다시 써서 커서를 복원한다.
// 값(텍스트)을 돌려준다. IME 조합 중엔 부르지 말 것(조합이 끊긴다).
export function normalizeEditableText(el: HTMLElement): string {
  const sel = window.getSelection();
  const inside = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode);
  const { raw, text, caret } = serialize(el, inside ? sel!.anchorNode : null, inside ? sel!.anchorOffset : 0);
  if (el.innerHTML === canonicalHtml(raw)) return text;
  writeEditableText(el, raw);
  if (inside && caret !== null) placeCaret(el, raw, caret);
  return text;
}
