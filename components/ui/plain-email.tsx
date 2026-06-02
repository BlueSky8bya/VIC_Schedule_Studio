// 화면에 표시하는 이메일 — 모바일 브라우저(삼성 인터넷·일부 인앱 웹뷰 등 format-detection을
// 무시하는 환경)가 이메일 텍스트를 자동으로 mailto 링크로 바꿔, 탭하면 메일 작성창이 뜨던 문제 방지.
// '@'를 별도 <span>으로 끊어 텍스트 노드를 셋으로 쪼개면 자동 링크 감지기가 이메일 토큰을 매칭하지
// 못한다(보이는 문자열·선택·복사는 그대로). 데스크톱 title 툴팁도 유지.
export function PlainEmail({
  value,
  className,
  title
}: {
  value: string;
  className?: string;
  title?: string;
}) {
  const at = value.indexOf("@");
  if (at < 0) {
    return (
      <span className={className} title={title}>
        {value}
      </span>
    );
  }
  return (
    <span className={className} title={title}>
      {value.slice(0, at)}
      <span>@</span>
      {value.slice(at + 1)}
    </span>
  );
}
