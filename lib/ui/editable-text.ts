"use client";

// contenteditable 한 칸을 "여러 줄 순수 텍스트"로 다루는 두 함수(편집실 내용칸, 2026-09-17).
//  · 읽기: innerText(브라우저가 <div>/<br> 줄을 \n으로 펴 준다)에서 NBSP·끝 개행만 정리.
//  · 쓰기: 첫 줄은 맨 텍스트, 다음 줄부터 <div> — Chrome이 Enter로 만드는 구조와 같아 CSS(첫 줄 굵게)가 한 규칙으로 맞는다.
export function readEditableText(el: HTMLElement): string {
  return el.innerText.replace(/ /g, " ").replace(/\r/g, "").replace(/\n+$/, "");
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
