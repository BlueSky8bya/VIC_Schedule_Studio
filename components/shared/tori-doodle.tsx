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
 *  손그림은 SVG <image>가 아니라 그 위에 겹친 평범한 <img>다 — 운영 화면에서 SVG <image>가 같은 주소를 끝내 불러오지
 *  않아 TV가 비어 보였다(2026-11-13 소유자 "손그림 티비에 안 나와", 주소만 바꾸면 뜸 — 실측). 위치는 TV 화면 칸 기준 %:
 *  화면 가운데 (88, 100) / 판 (200 × 172), 그림 한 변 106. */
export function ToriTv({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={className} style={{ position: "relative", display: "inline-block", aspectRatio: "200 / 172" }}>
      <svg style={{ display: "block", width: "100%", height: "100%" }} viewBox="0 0 200 172">
        {/* 안테나 */}
        <path d="M78 40 L58 10 M122 40 L142 12" fill="none" stroke={LINE} strokeLinecap="round" strokeWidth="5" />
        <circle cx="58" cy="10" fill={LINE} r="6" />
        <circle cx="142" cy="12" fill={LINE} r="6" />
        {/* 몸통 */}
        <rect fill="#fff4dc" height="124" rx="26" stroke={LINE} strokeWidth="5" width="186" x="7" y="38" />
        {/* 화면 */}
        <rect fill={SCREEN} height="96" rx="16" stroke={LINE} strokeWidth="4.5" width="132" x="22" y="52" />
        {/* 손잡이 둘 */}
        <circle cx="174" cy="80" fill="#ffb07a" r="8" stroke={LINE} strokeWidth="4" />
        <circle cx="174" cy="112" fill="#ffb07a" r="8" stroke={LINE} strokeWidth="4" />
        {/* 다리 */}
        <path d="M44 162 L36 170 M156 162 L164 170" fill="none" stroke={LINE} strokeLinecap="round" strokeWidth="5" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        draggable={false}
        src="/tori/doodle.webp"
        style={{ position: "absolute", left: `${(35 / 200) * 100}%`, top: `${(47 / 172) * 100}%`, width: `${(106 / 200) * 100}%`, height: "auto" }}
      />
    </span>
  );
}
