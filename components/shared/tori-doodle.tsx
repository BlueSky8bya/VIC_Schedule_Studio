// 토리님 손그림(2026-11-13 소유자 제공, public/tori/doodle.webp) — 바깥 노란 바탕만 투명하게 빼고 몸 안 노랑은 남겼다.
// 그림의 무게중심이 정사각 캔버스 정가운데(256/512)에 오게 잘랐다 — 넣는 자리마다 가운데 정렬만 하면 캐릭터가 가운데 온다.
// 심심한 빈 자리(방송 미리보기 대기, 빈 목록, 없는 페이지, 제보 완료)에 쓴다. 모두 장식이라 대체 글은 비워 둔다.
const LINE = "#471e18"; // 손그림 선 색(원본에서 잰 값 rgb 71,30,24)
const SCREEN = "#ffc864"; // 손그림 원래 바탕색

export function ToriDoodle({ size = 96, className }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" aria-hidden="true" className={className} draggable={false} height={size} src="/tori/doodle.webp" width={size} />;
}

/** 손그림 선과 같은 굵은 갈색 선으로 그린 TV — 화면 안에 손그림. 방송 미리보기 카드가 이미지를 기다리는 동안.
 *  clipPath(id 참조)는 쓰지 않는다 — 같은 화면에 숨은 사본이 있으면 url(#id)가 숨은 쪽을 가리켜 그림이 사라졌다.
 *  손그림의 실제 선은 화면 사각형 안에 들어오게 크기·위치를 맞췄다(바깥은 투명). */
export function ToriTv({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 200 172">
      {/* 안테나 */}
      <path d="M78 40 L58 10 M122 40 L142 12" fill="none" stroke={LINE} strokeLinecap="round" strokeWidth="5" />
      <circle cx="58" cy="10" fill={LINE} r="6" />
      <circle cx="142" cy="12" fill={LINE} r="6" />
      {/* 몸통 */}
      <rect fill="#fff4dc" height="124" rx="26" stroke={LINE} strokeWidth="5" width="186" x="7" y="38" />
      {/* 화면 + 손그림 */}
      <rect fill={SCREEN} height="96" rx="16" width="132" x="22" y="52" />
      <image height="106" href="/tori/doodle.webp" preserveAspectRatio="xMidYMid meet" width="106" x="35" y="47" />
      <rect fill="none" height="96" rx="16" stroke={LINE} strokeWidth="4.5" width="132" x="22" y="52" />
      {/* 손잡이 둘 */}
      <circle cx="174" cy="80" fill="#ffb07a" r="8" stroke={LINE} strokeWidth="4" />
      <circle cx="174" cy="112" fill="#ffb07a" r="8" stroke={LINE} strokeWidth="4" />
      {/* 다리 */}
      <path d="M44 162 L36 170 M156 162 L164 170" fill="none" stroke={LINE} strokeLinecap="round" strokeWidth="5" />
    </svg>
  );
}
