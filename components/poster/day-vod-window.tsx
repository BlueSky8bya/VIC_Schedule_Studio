"use client";

// 날짜 다시보기 창/페이지(2026-09-17 페이지 승격) — **한 구현**: 시청자 화면은 /replay/<날짜> 페이지(variant="page"),
// 편집실 미리보기·fixture·/onair는 같은 컴포넌트를 창(variant="modal")으로 띄운다(G-18). 플레이어(숲 임베드 iframe
// API)·부 탭·머리줄·가로 띠·챕터 레일·키보드가 전부 여기 있다. 히스토리 스택·본문 스크롤 잠금은 껍데기(포스터/페이지) 몫.
import { ExternalLink, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDayMark } from "@/lib/calendar/holidays";
import { hapticTick } from "@/lib/ui/haptics";
import { VodChapters, type VodChaptersApi } from "@/components/poster/vod-chapters";
import "./public-poster.css";
import "./poster-metal-water.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export type DayVod = {
  titleNo: number;
  title: string;
  durationMs: number;
  chapters?: number;
  timelineBy?: string;
  thumbQuery?: string;
  host?: string; // 합방 게스트 출연분(0075) — 호스트 닉. 칩·창에 "합방 · ○○" 배지
  hostId?: string; // 호스트 숲 아이디 — 칩이 방송국 링크가 된다(2026-09-17)
};

// 숲 임베드 iframe API의 Pload 명령 — PonReady를 받은 플레이어에게 재생 설정을 통째로 넘긴다.
// autoPlay:false = 초기화만(지정 포스터+▶ 대기 — 실측: 이 상태의 ▶ 클릭은 엄격 차단 브라우저에서도
// 소리 켠 재생). autoPlay:true + mutePlay:false = 음소거로 시동 걸고 스스로 소리를 켜는 공식 경로.
// (채팅·추천·광고성 부가 UI는 전부 끔 — 미리보기 띠는 영상만.)
function buildDayVodPload(
  titleNo: number,
  sec: number,
  autoPlay: boolean,
  mutePlay = false
): Record<string, unknown> {
  return {
    cmd: "Pload",
    id: titleNo,
    autoPlay,
    mutePlay,
    showChat: false,
    isViewCnt: true,
    isRecommendShow: false,
    isEndRecommendShow: false,
    startVideoSeconds: sec,
    endVideoSeconds: 0
  };
}

// ── 소리 켠 자동재생 차단 기억(2026-09-03) ──────────────────────────────────
// 차단 브라우저(MEI 낮은 크롬 등)에선 재생 전 챕터 점프의 1차 '소리 켠 autoPlay' 시도가 아무
// 이벤트 없이 죽고, 감시 타이머가 끝나야 음소거로 굴러갔다(실측 3.7초 — 사용자 "체감 3초").
// 한 번 차단이 확인되면 기억해 두고 다음 점프부터 곧장 음소거 시동(+Punmute)으로 간다.
// 소리 시도가 실제로 굴러가면 즉시 지운다(자가 교정). 3일 TTL — MEI가 자라 허용으로 바뀌면
// 다시 시도해 본다. 저장소가 막힌 환경(프라이빗 등)에선 세션 메모리만.
const VOD_SOUND_BLOCKED_KEY = "vic.vod.soundAutoplayBlocked";
const VOD_SOUND_BLOCKED_TTL_MS = 3 * 24 * 60 * 60 * 1000;
// 소리 시도 감시창 — 대기 슬롯이 이미 로드돼 있어 Pload→첫 미디어 이벤트가 ≈0.1초(실측 83ms)라
// 1.5초면 넉넉하다(예전 3초는 iframe 로드까지 품은 값).
const VOD_SOUND_WATCHDOG_MS = 1_500;
// 창이 떠 있는 동안 ←/→ 한 번의 탐색 폭(초).
const VOD_KEY_SEEK_SEC = 10;
// (2026-09-03 철회: '재생 중 Pplay로 소리 켜기'(M 음소거 토글·차단 폴백 자동 unmute·인계 승격) —
//  Pplay는 시작 직후엔 0초 정지 리셋, 재생 중엔 위치 튐이라 플레이어 상태에 민감했고, Space·M·챕터
//  연타에서 승격·타이머가 겹쳐 고장났다(사용자 신고 "혼자 멈춤"·"연타에 고장"). 믿을 수 있는 원시
//  동작만 남긴다: 새 iframe 첫 Pload(자동재생) · 재생 중 PseekTo · Ppause · 정지 중 Pplay(제자리 재개).
//  소리 켜기/끄기는 플레이어 안 볼륨 버튼(프레임 내 제스처)이 담당.)
// Space 연타 억제(ms) — 정지/재개 명령이 플레이어 이벤트보다 빨리 겹치지 않게.
const VOD_SPACE_MIN_GAP_MS = 250;
// '자리잡음' 기준: 첫 timeUpdate 뒤 이만큼 지나야 제어 명령(Ppause/Pplay/PseekTo)을 보낸다.
// 시동 직후의 명령은 플레이어를 0초 정지로 리셋하거나 명령 채널을 죽인다(실측: Pplay 0.4초 리셋,
// Ppause 0.3초 → 정지 후 무반응). 그 전의 챕터 클릭은 재시동(새 첫 Pload)으로, Space는 무시.
const VOD_SETTLE_MS = 800;
// 슬롯 식별자(`${titleNo}:${slot}`) — 같은 방송의 주/대기 iframe을 가르는 키(모듈 함수: 훅 deps 밖).
function dayVodSlotKey(titleNo: number, slot: "a" | "b"): string {
  return `${titleNo}:${slot}`;
}
let vodSoundBlockedCache: boolean | null = null;
function isVodSoundAutoplayBlocked(): boolean {
  if (vodSoundBlockedCache !== null) return vodSoundBlockedCache;
  let blocked = false;
  try {
    const raw = window.localStorage.getItem(VOD_SOUND_BLOCKED_KEY);
    const at = raw ? Number(raw) : Number.NaN;
    blocked = Number.isFinite(at) && Date.now() - at < VOD_SOUND_BLOCKED_TTL_MS;
  } catch {
    /* 저장소 불가 — 세션 메모리만 */
  }
  vodSoundBlockedCache = blocked;
  return blocked;
}
function rememberVodSoundAutoplay(blocked: boolean) {
  vodSoundBlockedCache = blocked;
  try {
    if (blocked) window.localStorage.setItem(VOD_SOUND_BLOCKED_KEY, String(Date.now()));
    else window.localStorage.removeItem(VOD_SOUND_BLOCKED_KEY);
  } catch {
    /* 저장소 불가 — 무시 */
  }
}


function formatShortDate(value: string) {
  const [, month, day] = value.split("-");

  return `${Number(month)}.${Number(day)}`;
}

// 다시보기 길이(ms) → "5시간 12분" / "45분". 초는 버린다 — 칩에서 초 단위는 소음이다.
export function formatVodDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return "";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function DayVodWindow({
  dateKey,
  vods,
  slug,
  side,
  variant,
  initialPart,
  initialSec,
  onClose
}: {
  dateKey: string;
  vods: DayVod[];
  slug: string;
  side: "left" | "right"; // 챕터 레일 자리 = 사이드 패널 쪽(vic_avatar_side)
  variant: "modal" | "page";
  initialPart?: number; // 페이지 ?part=N — 처음 보여줄 방송(1부터)
  initialSec?: number; // 페이지 ?t=초 / 검색 챕터 — 열리자마자 그 시각부터(챕터 점프와 같은 경로)
  onClose: () => void;
}) {
  // 날짜 칸 다시보기 '창'(PC) — 일정 카드가 없는 날(특히 2024~25, 일정 시스템 이전)도
  // 칸 배경 클릭으로 그 날 다시보기에 들어가는 유일한 통로다(2026-08-31 사용자 요청).
  // 팝오버가 아니라 화면 중앙의 작은 창: 썸네일 미리보기 + 제목 + 챕터를 한 자리에서.
  // 모바일 아젠다는 일정 없는 날 줄에 칩·챕터를 인라인으로 그려 창이 필요 없다.
  // 무대 단일화(2026-09-17 대개편 1번): 하루에 방송이 여럿이어도 플레이어는 **하나**, 위 탭(1부·2부…)으로 바꾼다.
  // 예전엔 방송마다 블록(플레이어 2 iframe + 챕터)을 세로로 쌓아 어느 걸 보는지 헷갈리고 iframe이 2N개였다.
  // null = 그 날 첫 방송. 바꿀 때 떠나는 방송의 플레이어 상태는 비우고(clearDayVodTitle), 재생 중이었으면 지점을
  // 기억해(dayVodResumeRef) 돌아오면 거기서 이어 튼다.
  const initialSel = initialPart && vods[initialPart - 1] ? vods[initialPart - 1].titleNo : null;
  const [dayVodSel, setDayVodSel] = useState<number | null>(initialSel);
  const dayVodSelRef = useRef<number | null>(null);
  dayVodSelRef.current = dayVodSel;
  const dayVodResumeRef = useRef(new Map<number, number>());
  const dayVodEndedRef = useRef(new Set<number>()); // 끝남 → 다음 영상 자동 전환은 방송당 한 번
  // 단축키 안내(2번): 상시 노출 대신 ? 버튼 뒤로(자동 펼침 없음).
  const [dayVodKeysOpen, setDayVodKeysOpen] = useState(false);
  // 가로 타임라인 띠(4번)의 자리(플레이어 아래) — VodChapters가 포털로 그린다.
  const [dayVodStripHost, setDayVodStripHost] = useState<HTMLDivElement | null>(null);
  // 키보드 → 챕터(7번): ↑/↓·[/]·C는 레일 컴포넌트가 등록한 API로 간다.
  const dayVodChapterApiRef = useRef<VodChaptersApi | null>(null);
  const registerDayVodChapterApi = useCallback((api: VodChaptersApi | null) => {
    dayVodChapterApiRef.current = api;
  }, []);
  // 창 안 인라인 플레이어 — 숲 임베드 iframe API(?fromApi=1, 2026-09-01 번들 분석+실측 확정):
  //  · 창이 열리면 모든 VOD의 iframe을 바로 깔고, PonReady가 오면 Pload{autoPlay:false}로
  //    초기화만 해둔다(무음·무재생, 지정 포스터+▶ 상태). 시청자의 첫 클릭이 곧 플레이어 안
  //    ▶ 클릭 = 프레임 안 제스처라 어떤 브라우저에서도 클릭 1번에 소리 켠 재생이 된다.
  //    (URL 파라미터 mutePlay=false만으론 재생 시도조차 안 하고, 프레임 밖 클릭으로 소리 켠
  //    시작은 브라우저가 원천 차단 — 둘 다 실측. 이 배치가 유일한 1클릭 경로.)
  //  · 챕터 점프: 미디어가 굴러간 적 있으면 PseekTo — iframe 리로드가 없어 광고도 다시 안 돈다.
  //    ⚠ seconds는 반드시 {time, seekType} 객체 — 숫자를 주면 플레이어 내부 리듀서가
  //    payload.time=undefined로 읽어 0초로 튄다(2026-09-01 사용자 신고 재현+수정).
  //    아직이면 Pload{autoPlay:true,startVideoSeconds} — 허용 브라우저는 그 초부터 즉시 소리 켠
  //    재생, 차단 브라우저는 그 지점 포스터+▶ 하나.
  const [dayVodJump, setDayVodJump] = useState<{ titleNo: number; sec: number } | null>(null);
  // 재생이 실제로 시작된 방송들 — 이때에야 스냅샷 커버를 걷는다. 그 전까지는 토리님이 지정한
  // 썸네일이 계속 보인다(클릭은 통과라 1클릭 재생은 그대로 — 2026-09-01 사용자 절충).
  const [dayVodLive, setDayVodLive] = useState<ReadonlySet<number>>(new Set());
  // 플레이어 슬롯 2개(a/b) — 2026-09-03. 하나는 화면의 '주(active)' 플레이어, 다른 하나는 숨겨
  // 둔 '대기(standby)' **순정** 플레이어(PonReady만 받고 Pload는 안 보냄). 플레이어는 iframe
  // 수명당 '첫 Pload'에서만 autoPlay를 존중한다(실측: 초기화 뒤의 2차 Pload·Pplay·PseekTo·
  // 음소거 Pload·Punmute·URL autoPlay 파라미터 전부 무반응). 그래서 재생 전 챕터 점프는 대기
  // 슬롯에 첫 Pload{autoPlay:true, startVideoSeconds}를 쏘고 그 자리에서 주로 승격한다 —
  // 예전엔 주 iframe을 재마운트해 로드(≈0.3초, 차단 폴백까지 3.7초)를 기다렸다. 물러난 주
  // 슬롯은 gen을 올려 리로드 → 새 대기가 된다(항상 데워진 순정 플레이어 하나가 대기).
  // ⚠ DOM 순서는 a, b 고정 — 키드 자식을 재배치하면 iframe이 리로드된다. 보이기만 CSS로.
  type VodSlot = "a" | "b";
  const [dayVodSlots, setDayVodSlots] = useState<
    Record<number, { active: VodSlot; genA: number; genB: number }>
  >({});
  const dayVodActiveRef = useRef(new Map<number, VodSlot>()); // 핸들러용 거울(클로저 고정 회피)
  // slotKey(`${titleNo}:${slot}`) 기준 — 같은 방송의 두 슬롯이 같은 id로 말하므로 보낸 창
  // (e.source)과 iframe을 대조해 슬롯을 가른다.
  const dayVodFramesRef = useRef(new Map<string, HTMLIFrameElement>());
  const dayVodApisRef = useRef(new Map<string, (msg: Record<string, unknown>) => void>());
  const dayVodPendingRef = useRef(new Map<string, number>()); // 준비되면 이 초부터 재생
  const dayVodMutedRef = useRef(new Set<string>()); // 이번 시동은 음소거
  const dayVodSoundTryRef = useRef(new Set<string>()); // 소리 켠 autoPlay 시도 중(굴러가면 허용 증명)
  const dayVodAliveRef = useRef(new Set<number>());
  const dayVodPausedRef = useRef(new Set<number>());
  const dayVodTimeRef = useRef(new Map<number, number>()); // 최근 timeUpdate currentTime(←/→ 상대 탐색)
  // 숲 플레이어로 나가는 링크 — 인라인 재생 중이면 그 지점(change_second)부터. 3초 미만이면 처음부터(붙이지 않는다).
  const vodWatchUrl = (titleNo: number) => {
    const base = `https://vod.sooplive.co.kr/player/${titleNo}`;
    const sec = Math.floor(dayVodTimeRef.current.get(titleNo) ?? 0);
    return sec >= 3 ? `${base}?change_second=${sec}` : base;
  };
  // 재생 위치 구독(2026-09-03) — 챕터 레일이 현재 챕터를 따라가게 currentTime을 흘려준다.
  // setState로 포스터 전체를 초당 4번 다시 그리지 않고, 레일만 자기 상태(현재 챕터 idx가
  // 바뀔 때만)로 갱신하도록 콜백 구독 방식.
  const dayVodTimeSubsRef = useRef(new Map<number, Set<(sec: number) => void>>());
  const notifyDayVodTime = (titleNo: number, sec: number) => {
    dayVodTimeRef.current.set(titleNo, sec);
    const subs = dayVodTimeSubsRef.current.get(titleNo);
    if (subs) for (const cb of subs) cb(sec);
  };
  const subscribeDayVodTime = useCallback((titleNo: number, cb: (sec: number) => void) => {
    let subs = dayVodTimeSubsRef.current.get(titleNo);
    if (!subs) {
      subs = new Set();
      dayVodTimeSubsRef.current.set(titleNo, subs);
    }
    subs.add(cb);
    const known = dayVodTimeRef.current.get(titleNo);
    if (known !== undefined) cb(known); // 늦게 구독해도 현재 위치부터
    return () => {
      subs.delete(cb);
    };
  }, []);
  const dayVodFocusRef = useRef<number | null>(null); // 키보드가 조종할 방송(마지막 점프/재생)
  const dayVodKeySeekAtRef = useRef(0); // ←/→ 연타 속도 제한
  // 시동 진행 중 표시(방송별, 시작 시각) — 첫 Pload를 보냈지만 아직 미디어 이벤트가 없는 구간.
  // 이 구간의 Space 연타는 무시한다(누를 때마다 승격=리로드가 반복돼 영영 안 굴러가던 고장).
  const dayVodStartingAtRef = useRef(new Map<number, number>());
  const dayVodSettledAtRef = useRef(new Map<number, number>()); // 현재 슬롯의 첫 timeUpdate 시각
  const dayVodSeekAtRef = useRef(new Map<number, number>()); // 마지막 PseekTo 시각(정지/재개 금지 창)
  const dayVodSettled = (titleNo: number) => {
    const at = dayVodSettledAtRef.current.get(titleNo);
    return at !== undefined && performance.now() - at > VOD_SETTLE_MS;
  };
  // 시킹 중 Ppause/Pplay는 무시되거나 정지에 갇힌다(실측: seek+재개 100ms 뒤 Ppause → 이후 Pplay
  // 무반응). seek끼리 연타는 안전(방향키 30연타 실측 OK) — 정지/재개만 seek 뒤 잠깐 막는다.
  const dayVodSeekQuiet = (titleNo: number) => {
    const at = dayVodSeekAtRef.current.get(titleNo);
    return at !== undefined && performance.now() - at < VOD_SETTLE_MS;
  };
  const dayVodSpaceAtRef = useRef(0); // Space 연타 억제
  // 토글 피드백 토스트(영상 위, 1.4초) — 정적이면 눌렀는지 모른다.
  const [dayVodNotice, setDayVodNotice] = useState<{ text: string; n: number } | null>(null);
  const dayVodNoticeTimerRef = useRef(0);
  const showDayVodNotice = (text: string) => {
    window.clearTimeout(dayVodNoticeTimerRef.current);
    setDayVodNotice((prev) => ({ text, n: (prev?.n ?? 0) + 1 }));
    dayVodNoticeTimerRef.current = window.setTimeout(() => setDayVodNotice(null), 1_400);
  };
  // 소리 켠 자동재생이 차단된 브라우저(MEI 낮은 크롬 등)용 2단 폴백 감시 타이머(방송별).
  // 음소거 자동재생은 정책상 항상 허용이라 반드시 굴러간다(소리는 플레이어 안 볼륨 버튼 — 프레임 내
  // 제스처. Punmute는 origin 잠금으로 무시되고, Pplay unmute는 상태 민감이라 철회). 차단이
  // 확인되면 기억해 두어 다음 점프부터는 감시창 없이 곧장 음소거 시동(isVodSoundAutoplayBlocked).
  const dayVodRetryTimersRef = useRef(new Map<number, number>());
  useEffect(() => {
    // 창이 닫히거나 다른 날짜로 바뀌면 플레이어 상태를 전부 비운다(iframe 맵은 ref 콜백이 관리).
    setDayVodJump(null);
    setDayVodSel(initialSel);
    dayVodResumeRef.current.clear();
    dayVodEndedRef.current.clear();
    // (챕터 API ref는 여기서 지우지 않는다 — 자식 효과가 먼저 돌아 등록한 걸 부모 마운트 효과가 지워 C·↑↓가 죽었다, 2026-09-17 실측.)
    setDayVodKeysOpen(false); // 자동 펼침 없음(2026-09-17 소유자: 들어갈 때마다 펼쳐져 끄기 귀찮다) — ? 눌렀을 때만
    setDayVodLive(new Set());
    setDayVodSlots({});
    dayVodActiveRef.current.clear();
    dayVodApisRef.current.clear();
    dayVodPendingRef.current.clear();
    dayVodMutedRef.current.clear();
    dayVodSoundTryRef.current.clear();
    dayVodAliveRef.current.clear();
    dayVodPausedRef.current.clear();
    dayVodTimeRef.current.clear();
    dayVodTimeSubsRef.current.clear();
    dayVodFocusRef.current = null;
    dayVodStartingAtRef.current.clear();
    dayVodSettledAtRef.current.clear();
    dayVodSeekAtRef.current.clear();
    window.clearTimeout(dayVodNoticeTimerRef.current);
    setDayVodNotice(null);
    for (const t of dayVodRetryTimersRef.current.values()) window.clearTimeout(t);
    dayVodRetryTimersRef.current.clear();
    // 마운트 한 번(창 시절 [dayVodPop] — 이제 마운트 = 열림). initialSel은 첫 렌더 값이면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 대기 슬롯을 주로 승격하며 그 초부터 자동재생 — 재생 전 점프의 유일 재생 경로.
  // (ref/setState만 만지므로 deps 없음 — 메시지 핸들러 effect가 안정된 참조로 쓴다.)
  const startDayVodAutoPlay = useCallback(
    (
      titleNo: number,
      key: string,
      post: (msg: Record<string, unknown>) => void,
      sec: number,
      muted: boolean
    ) => {
      post(buildDayVodPload(titleNo, sec, true, muted));
      dayVodStartingAtRef.current.set(titleNo, performance.now());
      if (muted) return; // 음소거 시동은 항상 굴러간다 — 더 물러날 곳도 없다
      // 소리 켠 시도가 정책에 막히면 아무 미디어 이벤트도 안 온다(실측: 조용히 정지 유지).
      // 감시창 안에 반응이 없으면 '차단'으로 기억하고 반대 슬롯(그새 리로드돼 데워짐)을 음소거로.
      dayVodSoundTryRef.current.add(key);
      const old = dayVodRetryTimersRef.current.get(titleNo);
      if (old) window.clearTimeout(old);
      dayVodRetryTimersRef.current.set(
        titleNo,
        window.setTimeout(() => {
          dayVodRetryTimersRef.current.delete(titleNo);
          // 성공 판정은 '실제로 굴러감'(timeUpdate) — buffer만 오고 안 굴러가는 경우가 있어(실측,
          // 허용 프로필에서도 간헐) alive만 보면 정지 상태에 갇힌다. 아무 이벤트도 없었을 때만
          // '차단'으로 기억(진짜 차단의 서명); buffer는 왔는데 안 굴러갔으면 이번만 음소거 폴백.
          if (dayVodSettledAtRef.current.has(titleNo)) return;
          dayVodSoundTryRef.current.delete(key);
          if (!dayVodAliveRef.current.has(titleNo)) rememberVodSoundAutoplay(true);
          promoteDayVodStandbyRef.current(titleNo, sec, true);
        }, VOD_SOUND_WATCHDOG_MS)
      );
    },
    []
  );
  // 슬롯 교체 확정: 새 슬롯을 주로, 물러나는 슬롯은 gen++로 리로드(새 대기).
  const commitDayVodSwap = useCallback((titleNo: number, newSlot: VodSlot) => {
    const oldSlot: VodSlot = newSlot === "a" ? "b" : "a";
    const oldKey = dayVodSlotKey(titleNo, oldSlot);
    dayVodApisRef.current.delete(oldKey);
    dayVodPendingRef.current.delete(oldKey);
    dayVodMutedRef.current.delete(oldKey);
    dayVodSoundTryRef.current.delete(oldKey);
    dayVodPausedRef.current.delete(titleNo);
    dayVodActiveRef.current.set(titleNo, newSlot);
    setDayVodSlots((prev) => {
      const cur = prev[titleNo] ?? { active: "a" as VodSlot, genA: 0, genB: 0 };
      return {
        ...prev,
        [titleNo]: {
          active: newSlot,
          genA: oldSlot === "a" ? cur.genA + 1 : cur.genA,
          genB: oldSlot === "b" ? cur.genB + 1 : cur.genB
        }
      };
    });
  }, []);
  const promoteDayVodStandby = useCallback(
    (titleNo: number, sec: number, muted: boolean) => {
      const active = dayVodActiveRef.current.get(titleNo) ?? "a";
      const standby: VodSlot = active === "a" ? "b" : "a";
      const newKey = dayVodSlotKey(titleNo, standby);
      const oldTimer = dayVodRetryTimersRef.current.get(titleNo);
      if (oldTimer) window.clearTimeout(oldTimer);
      dayVodRetryTimersRef.current.delete(titleNo);
      if (muted) dayVodMutedRef.current.add(newKey);
      else dayVodMutedRef.current.delete(newKey);
      const post = dayVodApisRef.current.get(newKey);
      // 승격 — 물러나는 주 슬롯은 곧바로 리로드(새 대기). 대기 슬롯이 이미 준비됐으면 즉시 첫 Pload,
      // 아직 로딩 중이면 PonReady에서 이어간다(pending). 연타로 승격이 겹쳐도 마지막 승격의 pending만
      // 살아남고 나머지는 리로드로 사라진다(수렴).
      dayVodAliveRef.current.delete(titleNo);
      dayVodStartingAtRef.current.set(titleNo, performance.now());
      dayVodSettledAtRef.current.delete(titleNo);
      dayVodSeekAtRef.current.delete(titleNo);
      commitDayVodSwap(titleNo, standby);
      if (post) startDayVodAutoPlay(titleNo, newKey, post, sec, muted);
      else dayVodPendingRef.current.set(newKey, sec);
    },
    [startDayVodAutoPlay, commitDayVodSwap]
  );
  // 감시 타이머(위)가 승격 함수를 부르는데 선언 순서상 아래에 있어 ref로 잇는다.
  const promoteDayVodStandbyRef = useRef(promoteDayVodStandby);
  promoteDayVodStandbyRef.current = promoteDayVodStandby;
  // 한 방송의 플레이어 상태를 전부 비운다 — 탭으로 떠날 때(iframe은 언마운트돼 어차피 죽는다; 남은 alive/api 기록이
  // 돌아왔을 때 죽은 창에 PseekTo를 보내게 하므로 반드시 지운다).
  const clearDayVodTitle = useCallback((titleNo: number) => {
    for (const slot of ["a", "b"] as const) {
      const k = dayVodSlotKey(titleNo, slot);
      dayVodApisRef.current.delete(k);
      dayVodPendingRef.current.delete(k);
      dayVodMutedRef.current.delete(k);
      dayVodSoundTryRef.current.delete(k);
    }
    dayVodAliveRef.current.delete(titleNo);
    dayVodPausedRef.current.delete(titleNo);
    dayVodActiveRef.current.delete(titleNo);
    dayVodStartingAtRef.current.delete(titleNo);
    dayVodSettledAtRef.current.delete(titleNo);
    dayVodSeekAtRef.current.delete(titleNo);
    const t = dayVodRetryTimersRef.current.get(titleNo);
    if (t) {
      window.clearTimeout(t);
      dayVodRetryTimersRef.current.delete(titleNo);
    }
    setDayVodLive((prev) => {
      if (!prev.has(titleNo)) return prev;
      const next = new Set(prev);
      next.delete(titleNo);
      return next;
    });
    setDayVodSlots((prev) => {
      if (!(titleNo in prev)) return prev;
      const next = { ...prev };
      delete next[titleNo];
      return next;
    });
  }, []);
  // 무대의 방송을 바꾼다. startSec: 그 초부터 자동 재생(다음 영상 자동 전환·이어보기), null이면 기억된 지점이
  // 있을 때만 이어 튼다(없으면 커버+▶ 대기). 자동 재생은 새 iframe의 PonReady가 pending을 집어 첫 Pload{autoPlay}로
  // 쏘는 기존 경로(챕터 점프와 같은 길) — 차단이 기억된 브라우저는 음소거 시동.
  const switchDayVod = useCallback(
    (from: number | null, to: number, startSec: number | null) => {
      if (from === to) return;
      if (from !== null) {
        const wasPlaying = dayVodAliveRef.current.has(from) && !dayVodPausedRef.current.has(from);
        const at = dayVodTimeRef.current.get(from) ?? 0;
        if (wasPlaying && at >= 3) dayVodResumeRef.current.set(from, at);
        else dayVodResumeRef.current.delete(from);
        clearDayVodTitle(from);
      }
      const sec = startSec ?? dayVodResumeRef.current.get(to) ?? null;
      if (sec !== null) {
        const k = dayVodSlotKey(to, "a");
        dayVodPendingRef.current.set(k, sec);
        if (isVodSoundAutoplayBlocked()) dayVodMutedRef.current.add(k);
        else dayVodMutedRef.current.delete(k);
        dayVodStartingAtRef.current.set(to, performance.now());
        dayVodTimeRef.current.set(to, sec);
      }
      dayVodFocusRef.current = to;
      dayVodEndedRef.current.delete(to);
      setDayVodSel(to);
      setDayVodJump(null);
      dayVodModalRef.current?.focus({ preventScroll: true });
    },
    [clearDayVodTitle]
  );
  // 끝나면 다음 영상(8번) — 플레이어가 끝 이벤트를 주거나 currentTime이 길이에 닿으면 다음 방송을 0초부터 자동 시동.
  const dayVodOnEndRef = useRef<(titleNo: number) => void>(() => {});
  dayVodOnEndRef.current = (titleNo) => {
    const list = vods;
    const i = list.findIndex((v) => v.titleNo === titleNo);
    const next = i >= 0 ? list[i + 1] : undefined;
    if (!next) return;
    showDayVodNotice("▶ 다음 영상");
    switchDayVod(titleNo, next.titleNo, 0);
  };
  const durations = useMemo(
    () => new Map(vods.map((v) => [v.titleNo, v.durationMs / 1000])),
    [vods]
  );
  useEffect(() => {
    // 임베드는 vod.sooplive.co.kr → vod.sooplive.com으로 넘어갈 수 있다 — 정확 일치 허용 목록.
    const SOOP_ORIGINS = new Set(["https://vod.sooplive.com", "https://vod.sooplive.co.kr"]);
    const onMsg = (e: MessageEvent) => {
      if (!SOOP_ORIGINS.has(e.origin) || !e.source) return;
      const data = e.data as {
        cmd?: unknown;
        id?: unknown;
        event?: { type?: unknown; currentTime?: unknown };
      } | null;
      if (!data || typeof data.cmd !== "string" || typeof data.id !== "string") return;
      const titleNo = Number(data.id);
      if (!Number.isFinite(titleNo) || titleNo <= 0) return;
      // 보낸 창으로 슬롯 식별 — 이미 내려간 iframe의 지연 메시지는 어느 슬롯에도 안 맞아 버려진다.
      let key: string | null = null;
      for (const [k, frame] of dayVodFramesRef.current) {
        if (frame.contentWindow === e.source) {
          key = k;
          break;
        }
      }
      if (!key) return;
      const slot: VodSlot = key.endsWith(":b") ? "b" : "a";
      const isActive = (dayVodActiveRef.current.get(titleNo) ?? "a") === slot;
      if (data.cmd === "PonReady") {
        const player = e.source as Window;
        const origin = e.origin;
        const post = (msg: Record<string, unknown>) => {
          try {
            player.postMessage(msg, origin);
          } catch {
            /* iframe이 이미 내려간 뒤의 지연 전송 — 조용히 무시 */
          }
        };
        dayVodApisRef.current.set(key, post);
        // 로딩 중에 점프/시동이 예약돼 있었으면 그 지점부터 재생 시도.
        const pending = dayVodPendingRef.current.get(key);
        if (pending !== undefined) {
          dayVodPendingRef.current.delete(key);
          startDayVodAutoPlay(titleNo, key, post, pending, dayVodMutedRef.current.has(key));
          return;
        }
        // 대기 슬롯은 순정으로 둔다 — '첫 Pload'를 점프 순간까지 아껴야 autoPlay가 먹는다.
        if (!isActive) return;
        // 주 슬롯: 초기화만(자동재생 금지 — 지정 포스터+▶ 상태. 이 ▶ 클릭은 프레임 안 제스처라
        // 어떤 브라우저에서도 소리 켠 재생이 된다).
        post(buildDayVodPload(titleNo, 0, false));
      } else if (data.cmd === "PupdateMediaEvent") {
        if (!isActive) return; // 물러난 슬롯의 잔여 이벤트
        dayVodStartingAtRef.current.delete(titleNo); // 시동 끝 — 미디어가 굴러간다
        if (data.event?.type === "timeUpdate" && !dayVodSettledAtRef.current.has(titleNo)) {
          dayVodSettledAtRef.current.set(titleNo, performance.now()); // 자리잡음 기준점
        }
        // buffer/timeUpdate/play 무엇이든 = 미디어 엔진이 굴러갔다 → 이후 점프는 PseekTo로,
        // 지정 썸네일 커버도 이때 걷는다. (재생 전엔 아무 이벤트도 오지 않는다 — 실측.)
        if (dayVodSoundTryRef.current.has(key)) {
          // 소리 켠 자동재생이 실제로 굴러감 = 이 브라우저는 허용 → 차단 기억 해제(자가 교정).
          dayVodSoundTryRef.current.delete(key);
          rememberVodSoundAutoplay(false);
          const t = dayVodRetryTimersRef.current.get(titleNo);
          if (t) {
            window.clearTimeout(t);
            dayVodRetryTimersRef.current.delete(titleNo);
          }
        }
        // (음소거 시동이었어도 소리는 자동으로 켜지 않는다 — 플레이어 볼륨 버튼이 담당. 파일 상단
        //  철회 주석 참조.)
        dayVodMutedRef.current.delete(key);
        dayVodAliveRef.current.add(titleNo);
        setDayVodLive((prev) => {
          if (prev.has(titleNo)) return prev;
          const next = new Set(prev);
          next.add(titleNo);
          return next;
        });
        // 일시정지 추적 — 정지 중 챕터 점프는 seek 후 지연 Pplay로 재개해야 해서(아래 참조).
        // 현재 시각도 받아 둔다(←/→ 상대 탐색의 기준) + 지금 굴러가는 방송이 키보드 대상.
        const evType = data.event?.type;
        if (evType === "pause") dayVodPausedRef.current.add(titleNo);
        else if (evType === "play" || evType === "timeUpdate") {
          dayVodPausedRef.current.delete(titleNo);
          dayVodFocusRef.current = titleNo;
        }
        const cur = data.event?.currentTime;
        if (typeof cur === "number" && Number.isFinite(cur)) {
          dayVodTimeRef.current.set(titleNo, cur);
          const subs = dayVodTimeSubsRef.current.get(titleNo);
          if (subs) for (const cb of subs) cb(cur);
        }
        // 끝 감지 — 플레이어의 끝 이벤트 이름은 문서가 없어 흔한 셋을 다 받고, 없어도 currentTime이 길이 1.5초 안에
        // 들면 끝으로 본다(한 방송당 한 번).
        const dur = durations.get(titleNo) ?? 0;
        const ended =
          evType === "ended" || evType === "complete" || evType === "end" ||
          (dur > 0 && typeof cur === "number" && cur >= dur - 1.5 && dayVodSettled(titleNo));
        if (ended && !dayVodEndedRef.current.has(titleNo)) {
          dayVodEndedRef.current.add(titleNo);
          dayVodOnEndRef.current(titleNo);
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [startDayVodAutoPlay, durations]);
  // 챕터 클릭의 단일 진입점 — 재생 중이면 postMessage로만 움직인다(리로드 없음 = 광고 재시작
  // 없음, 소리 상태 유지). 재생 전이면 대기 슬롯 승격(위 주석).
  const jumpDayVod = (titleNo: number, sec: number) => {
    setDayVodJump({ titleNo, sec }); // ↗ 새 탭 링크의 초 표기 동기화
    dayVodFocusRef.current = titleNo;
    dayVodEndedRef.current.delete(titleNo);
    // 챕터 링크(<a>)에 남은 포커스를 창으로 되돌린다 — 안 그러면 다음 Space/M이 링크에 먹혀 죽는다
    // (실측: 챕터 클릭 직후 Space 무반응).
    dayVodModalRef.current?.focus({ preventScroll: true });
    const activeKey = dayVodSlotKey(titleNo, dayVodActiveRef.current.get(titleNo) ?? "a");
    const post = dayVodApisRef.current.get(activeKey);
    if (post && dayVodAliveRef.current.has(titleNo) && dayVodSettled(titleNo)) {
      post({ cmd: "PseekTo", seconds: { time: sec, seekType: "timelink" } });
      dayVodSeekAtRef.current.set(titleNo, performance.now());
      notifyDayVodTime(titleNo, sec);
      // 정지 중이면 시킹 직후 바로 재개(제자리 Pplay는 믿을 수 있는 원시 동작 — 플레이어 3.1.224
      // 실측 seek→Pplay gap 0도 정상). 지연 타이머를 두지 않아 연타 시 다음 PseekTo와 뒤섞이지
      // 않는다. 정지 상태는 낙관적으로 먼저 지운다(재생 중 Pplay는 위치가 튀므로 두 번 안 보내게).
      if (dayVodPausedRef.current.has(titleNo)) {
        dayVodPausedRef.current.delete(titleNo);
        post({ cmd: "Pplay" });
      }
      return;
    }
    // 재생 전(또는 시동 직후 아직 자리 못 잡음): 재시동 — 차단이 기억돼 있으면 곧장 음소거 시동,
    // 아니면 소리 켠 1차 시도. 연타는 마지막 승격으로 수렴한다.
    notifyDayVodTime(titleNo, sec); // 가로 띠의 재생 머리가 첫 timeUpdate 전에도 그 지점에 선다
    promoteDayVodStandby(titleNo, sec, isVodSoundAutoplayBlocked());
  };
  // 창 = 키 입력의 집(2026-09-03 사용자: "재생 중엔 Esc가 안 먹는다"). 플레이어를 마우스로
  // 누르면 포커스가 교차 출처 iframe 안으로 들어가 keydown이 우리 창에 전혀 안 온다. 창이 열릴
  // 때 창 컨테이너(tabIndex -1)에 포커스를 두고, 포커스가 iframe으로 새면(window blur →
  // activeElement가 창 안 iframe) **마우스로 들어간 경우만** 되찾는다 — Tab으로 들어간 키보드
  // 사용자는 플레이어 자체 컨트롤을 쓰게 둔다. 판별 = 직전 400ms 안에 우리 문서에서 Tab keydown이
  // 있었나(교차 출처 iframe엔 :hover가 안 붙어 hover 판별은 불가 — 실측). 재생·마우스 조작은
  // 포커스와 무관해 되찾아도 영향 없음.
  const dayVodModalRef = useRef<HTMLDivElement | null>(null);
  // 검색 챕터/페이지 ?t= — 열리자마자 그 시각부터. 챕터 클릭과 같은 단일 진입점(jumpDayVod)이라
  // 플레이어가 아직 준비 전이면 pending으로 이어진다. 한 번만(리렌더·부 전환에 다시 안 뛴다).
  const initialSeekDoneRef = useRef(false);
  useEffect(() => {
    if (initialSeekDoneRef.current) return;
    initialSeekDoneRef.current = true;
    const target = initialSel ?? vods[0]?.titleNo;
    if (!target || !initialSec || !(initialSec > 0)) return;
    // 한 틱 뒤 — 챕터 레일·가로 띠가 시각 구독을 등록한 다음이라야 재생 머리가 그 지점에 선다
    // (동기로 부르면 알림이 허공에 가서 머리가 0에 남는다 — 실측).
    const t = window.setTimeout(() => jumpDayVod(target, Math.floor(initialSec)), 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회 의도
  }, []);
  useEffect(() => {
    dayVodModalRef.current?.focus({ preventScroll: true });
    let lastTabAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") lastTabAt = performance.now();
    };
    const onBlur = () => {
      const byKeyboard = performance.now() - lastTabAt < 400;
      window.setTimeout(() => {
        const ae = document.activeElement;
        const modal = dayVodModalRef.current;
        if (!modal || !(ae instanceof HTMLIFrameElement) || !modal.contains(ae)) return;
        if (byKeyboard) return;
        modal.focus({ preventScroll: true });
      }, 0);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const list = vods;
      const selNo = dayVodSelRef.current ?? list[0]?.titleNo ?? null;
      // ? = 단축키 안내 토글(2번). 다른 키를 쓰면 안내는 접힌다(배웠으니).
      // ⚠ 한글 IME가 켜져 있으면 e.key가 "Process"로 온다 — 글자·기호 키는 e.code로 본다(2026-09-17 소유자 "C 안 눌림").
      const code = e.code;
      if (e.key === "?" || (code === "Slash" && e.shiftKey)) {
        e.preventDefault();
        setDayVodKeysOpen((v) => !v);
        return;
      }
      setDayVodKeysOpen(false);
      // Shift+←/→ = 이전/다음 영상(1번·7번). 하루 한 방송이면 무시.
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        if (selNo === null || list.length < 2) return;
        const i = list.findIndex((v) => v.titleNo === selNo);
        const next = list[i + (e.key === "ArrowLeft" ? -1 : 1)];
        if (!next) return;
        hapticTick();
        switchDayVod(selNo, next.titleNo, null);
        return;
      }
      // ↑/↓ 챕터, [ ] 코너, C 레일 접기 — 레일 컴포넌트가 등록한 API(7번).
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        dayVodChapterApiRef.current?.chapter(e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (code === "BracketLeft" || code === "BracketRight") {
        e.preventDefault();
        dayVodChapterApiRef.current?.group(code === "BracketLeft" ? -1 : 1);
        return;
      }
      if (code === "KeyC") {
        e.preventDefault();
        hapticTick();
        dayVodChapterApiRef.current?.toggle();
        return;
      }
      // Space = 재생/일시정지(버튼 위면 그 버튼의 몫 — 링크(<a>)는 Space로 활성되지 않으므로 가로챈다).
      // 아직 아무것도 재생 전이면(창에 막 들어옴) Space = ▶ — 마지막 점프/재생 방송, 없으면
      // 그 날 첫 방송을 처음부터(재생 전 경로 = 챕터 점프와 같은 대기 슬롯 승격).
      if (e.key === " " && tag !== "BUTTON") {
        e.preventDefault();
        const titleNo = dayVodFocusRef.current ?? selNo;
        if (titleNo === null) return;
        const now = performance.now();
        if (now - dayVodSpaceAtRef.current < VOD_SPACE_MIN_GAP_MS) return; // 연타 억제
        dayVodSpaceAtRef.current = now;
        if (!dayVodAliveRef.current.has(titleNo)) {
          // 재생 전. 이미 시동 중(첫 Pload 보냄, 미디어 이벤트 대기)이면 무시 — 누를 때마다 승격
          // (=리로드)이 반복돼 영영 안 굴러가던 고장. 6초가 지나도 안 굴러가면 다시 시동을 허용.
          const startedAt = dayVodStartingAtRef.current.get(titleNo);
          if (startedAt !== undefined && now - startedAt < 6_000) return;
          hapticTick();
          dayVodFocusRef.current = titleNo;
          showDayVodNotice("▶ 재생");
          promoteDayVodStandby(titleNo, 0, isVodSoundAutoplayBlocked());
          return;
        }
        // 시동 직후(자리잡기 전)·시킹 직후의 Ppause/Pplay는 플레이어를 망가뜨린다 — 무시(실측: 시작
        // 0.3초 뒤 Ppause → 0초 정지 후 무반응 · seek+재개 100ms 뒤 Ppause → 이후 Pplay 무반응).
        if (!dayVodSettled(titleNo) || dayVodSeekQuiet(titleNo)) return;
        const post = dayVodApisRef.current.get(
          dayVodSlotKey(titleNo, dayVodActiveRef.current.get(titleNo) ?? "a")
        );
        if (!post) return;
        hapticTick();
        // 정지 상태는 낙관적으로 갱신 — 플레이어의 pause/play 이벤트가 오기 전에 다음 Space가 와도
        // 같은 명령을 두 번 보내지 않는다(재생 중 Pplay는 위치가 튄다).
        if (dayVodPausedRef.current.has(titleNo)) {
          dayVodPausedRef.current.delete(titleNo);
          showDayVodNotice("▶ 재생");
          post({ cmd: "Pplay" });
        } else {
          dayVodPausedRef.current.add(titleNo);
          showDayVodNotice("⏸ 일시정지");
          post({ cmd: "Ppause" });
        }
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      // 창이 떠 있는 동안 ←/→는 **영상 탐색**이다(2026-09-03 사용자: 챕터를 누른 뒤엔 포커스가
      // 프레임 밖이라 ←/→가 달력 월 이동으로 새어 보던 영상이 끊겼다). 월 이동 핸들러는
      // dayVodOpenRef로 원천 차단하고, 여기서는 마지막으로 점프/재생한 방송을 10초씩 옮긴다.
      // (iframe 자체에 포커스가 있으면 키가 프레임 안으로 가 플레이어가 직접 처리 — 여기 안 온다.)
      e.preventDefault();
      const titleNo = dayVodFocusRef.current;
      // 재생 전(기준 시각 없음)·시동 직후(명령이 플레이어를 망가뜨림)엔 무시.
      if (titleNo === null || !dayVodAliveRef.current.has(titleNo) || !dayVodSettled(titleNo)) return;
      const post = dayVodApisRef.current.get(
        dayVodSlotKey(titleNo, dayVodActiveRef.current.get(titleNo) ?? "a")
      );
      if (!post) return;
      const now = performance.now();
      if (now - dayVodKeySeekAtRef.current < 120) return; // 키 반복(초당 30회) 홍수 방지
      dayVodKeySeekAtRef.current = now;
      const cur = dayVodTimeRef.current.get(titleNo) ?? 0;
      const max = durations.get(titleNo) ?? Number.POSITIVE_INFINITY;
      const next = Math.min(Math.max(0, cur + (e.key === "ArrowLeft" ? -1 : 1) * VOD_KEY_SEEK_SEC), max);
      notifyDayVodTime(titleNo, next); // 연타 시 timeUpdate가 오기 전에도 누적 + 레일 즉시 추적
      post({ cmd: "PseekTo", seconds: { time: next, seekType: "timelink" } });
      dayVodSeekAtRef.current.set(titleNo, now);
      if (next < max - 5) dayVodEndedRef.current.delete(titleNo); // 끝에서 되감으면 다음 자동 전환을 다시 허용
      // (↗ 링크의 초 표기(dayVodJump)는 갱신하지 않는다 — 키 반복마다 포스터 전체가 다시 그려진다.)
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vods, promoteDayVodStandby, switchDayVod, durations, onClose]);
  // ── 렌더 ──
            const list = vods;
            const sel = list.find((v) => v.titleNo === dayVodSel) ?? list[0];
            const selIdx = sel ? list.indexOf(sel) : -1;
            const selLabel = sel ? sel.title || `다시보기${list.length > 1 ? ` ${selIdx + 1}` : ""}` : "";
            const selPlayerUrl = sel ? `https://vod.sooplive.co.kr/player/${sel.titleNo}` : "";
            const wd = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
            const mark = getDayMark(dateKey);
            const tone = wd === 0 || Boolean(mark?.isHoliday) ? " red" : wd === 6 ? " saturday" : "";
            return (
              <div
                className="day-vod-backdrop"
                data-variant={variant}
                /* 재생이 시작되면 유리 딤(backdrop-filter)을 끈다(2026-09-17 소유자: "소리는 되는데 영상이 툭툭") —
                   전체 화면 블러가 재생 중 매 프레임 다시 합성돼 약한 GPU에선 영상 프레임을 잡아먹는다. CSS 참조. */
                data-playing={dayVodLive.size > 0 ? "" : undefined}
                onClick={(e) => {
                  if (e.target === e.currentTarget) onClose();
                }}
                role="presentation"
              >
                <div
                  aria-label="다시보기"
                  aria-modal="true"
                  className="day-vod-modal"
                  ref={dayVodModalRef}
                  role="dialog"
                  /* 창 자체가 키 입력의 집(tabIndex -1): 열릴 때·플레이어를 마우스로 누른 뒤에도
                     포커스를 여기로 되찾아 Esc·←/→·Space가 계속 먹는다(dayVodModalRef 주석). */
                  tabIndex={-1}
                >
                  {/* 커버 썸네일 선명화 필터(2026-09-03) — 숲 스냅샷은 모든 변형이 640×360뿐이라
                      1230px 커버에서 1.9배 확대돼 흐리다(사용자 신고). 더 큰 원본이 없으니
                      완만한 언샤프(3×3 컨볼루션, 합 1)로 가장자리 대비만 되살린다. 재생이
                      시작되면 커버가 걷히므로 영상엔 영향 없음. */}
                  <svg aria-hidden="true" className="dvm-filter-defs" height="0" width="0">
                    <filter id="vod-cover-sharpen">
                      <feConvolveMatrix
                        kernelMatrix="0 -0.45 0 -0.45 2.8 -0.45 0 -0.45 0"
                        order="3"
                        preserveAlpha="true"
                      />
                    </filter>
                  </svg>
                  <div className="dvm-head">
                    <b className={`dvp-date${tone}`}>
                      {Number(dateKey.slice(0, 4))}.{formatShortDate(dateKey)} (
                      {WEEKDAYS[wd]})
                    </b>
                    {/* 제목은 머리줄로(2026-09-17 대개편 2번: 영상 아래 있어 '뭘 보는지'가 가장 늦게 읽혔다).
                        링크는 **지금 보고 있는 지점**부터 이어 본다 — 누르는 순간 currentTime을 change_second로
                        (pointerdown/enter에도 갱신해 가운데 클릭·새 탭도 같은 지점). */}
                    {/* 링크는 글자 폭만(2026-09-17 소유자: 빈 공간을 눌러도 이동됐다) — 남는 폭은 감싸는 상자가 갖는다. */}
                    {sel ? (
                      <span className="dvm-title-wrap">
                      <a
                        className="dvm-title"
                        data-act="vod-replay"
                        href={selPlayerUrl}
                        onClick={(e) => {
                          hapticTick();
                          e.currentTarget.href = vodWatchUrl(sel.titleNo);
                        }}
                        onPointerDown={(e) => {
                          e.currentTarget.href = vodWatchUrl(sel.titleNo);
                        }}
                        onPointerEnter={(e) => {
                          e.currentTarget.href = vodWatchUrl(sel.titleNo);
                        }}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={selLabel}
                      >
                        {selLabel}
                      </a>
                      </span>
                    ) : null}
                    {/* 합방 게스트 출연분(0075) — 다른 스트리머 방송국의 다시보기임을 밝히는 칩. 누르면 그 방송국 메인(2026-09-17). */}
                    {sel?.host && sel.hostId ? (
                      <a
                        className="dvm-host dvm-host-link"
                        data-act="vod-host-station"
                        href={`https://ch.sooplive.co.kr/${sel.hostId}`}
                        onClick={() => hapticTick()}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={`${sel.host} 방송국으로 가기`}
                      >
                        합방 · {sel.host} 방송국
                        <ExternalLink aria-hidden="true" size={11} strokeWidth={2.6} />
                      </a>
                    ) : sel?.host ? (
                      <span className="dvm-host" title={`${sel.host} 방송국의 다시보기 — 토리님 출연분`}>
                        합방 · {sel.host} 방송국
                      </span>
                    ) : null}
                    {/* 단축키 안내(2026-09-17): ? 뒤로 접는다. */}
                    <button
                      aria-expanded={dayVodKeysOpen}
                      aria-label="단축키 안내"
                      className="dvm-close dvm-help"
                      onClick={() => {
                        hapticTick();
                        setDayVodKeysOpen((v) => !v);
                      }}
                      title="단축키 (?)"
                      type="button"
                    >
                      ?
                    </button>
                    {dayVodKeysOpen ? (
                      <div className="dvm-keys" role="note">
                        <span><kbd>Space</kbd></span><span>재생 / 일시정지</span>
                        <span><kbd>←</kbd><kbd>→</kbd></span><span>10초 이동</span>
                        <span><kbd>↑</kbd><kbd>↓</kbd></span><span>이전 / 다음 타임라인</span>
                        <span><kbd>[</kbd><kbd>]</kbd></span><span>이전 / 다음 챕터</span>
                        {list.length > 1 ? (
                          <>
                            <span><kbd>Shift</kbd><kbd>←</kbd><kbd>→</kbd></span><span>이전 / 다음 영상</span>
                          </>
                        ) : null}
                        <span><kbd>C</kbd></span><span>타임라인 접기 / 펼치기</span>
                        <span><kbd>Esc</kbd></span><span>닫기</span>
                      </div>
                    ) : null}
                    <button
                      aria-label="닫기"
                      className="dvm-close"
                      data-act="close-day-vod"
                      onClick={() => {
                        hapticTick();
                        onClose();
                      }}
                      type="button"
                    >
                      <X aria-hidden="true" size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  {list.length > 1 && sel ? (
                    /* 영상 탭(1번) — 하루 여러 방송을 한 무대에서 바꿔 본다. 썸네일 대신 "N부 · 길이" 텍스트 칩,
                       보고 있는 영상은 금색(오늘·기록 언어). 클릭 = 무대 교체(이어보기 지점이 있으면 거기부터). */
                    <div aria-label="이 날의 다시보기" className="dvm-tabs" role="tablist">
                      {list.map((v, i) => (
                        <button
                          aria-selected={v.titleNo === sel.titleNo}
                          className={`dvm-tab${v.titleNo === sel.titleNo ? " is-on" : ""}`}
                          data-act="vod-tab"
                          key={v.titleNo}
                          onClick={() => {
                            if (v.titleNo === sel.titleNo) return;
                            hapticTick();
                            switchDayVod(sel.titleNo, v.titleNo, null);
                          }}
                          role="tab"
                          title={v.title || undefined}
                          type="button"
                        >
                          <b>{i + 1}부</b>
                          {v.durationMs > 0 ? <em>{formatVodDuration(v.durationMs)}</em> : null}
                          {v.host ? <i>합방</i> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="dvm-body">
                    {(sel ? [sel] : []).map((vod) => {
                      const playerUrl = selPlayerUrl;
                      const label = selLabel;
                      return (
                        <div className="dvm-vod" data-rail={side} key={vod.titleNo}>
                          {/* 플레이어는 창이 열릴 때부터 깔린다(fromApi=1, autoPlay:false 초기화).
                              첫 클릭 = 플레이어 안 ▶ = 어떤 브라우저에서도 1클릭 소리 켠 재생.
                              지정 썸네일 커버는 실제 재생이 시작될 때까지 덮는다(클릭 통과).
                              슬롯 a/b 두 iframe: 하나가 주(보임), 하나가 숨긴 순정 대기 — 재생 전
                              챕터 점프는 대기를 승격해 로드 없이 즉시(dayVodSlots 주석 참조).
                              gen이 오르면 그 슬롯만 재마운트(새 대기). DOM 순서 a, b 고정. */}
                          <div className="dvm-thumb is-playing">
                            {(["a", "b"] as const).map((slot) => {
                              const st = dayVodSlots[vod.titleNo] ?? { active: "a", genA: 0, genB: 0 };
                              const gen = slot === "a" ? st.genA : st.genB;
                              const active = st.active === slot;
                              const frameKey = `${vod.titleNo}:${slot}`;
                              return (
                                <iframe
                                  allow="autoplay; fullscreen; encrypted-media"
                                  aria-hidden={active ? undefined : true}
                                  className={active ? undefined : "is-standby"}
                                  key={`${vod.titleNo}-${slot}-${gen}`}
                                  ref={(el) => {
                                    if (el) dayVodFramesRef.current.set(frameKey, el);
                                    else dayVodFramesRef.current.delete(frameKey);
                                  }}
                                  src={`https://vod.sooplive.co.kr/player/${vod.titleNo}/embed?fromApi=1`}
                                  tabIndex={active ? undefined : -1}
                                  title={active ? label : `${label} (대기)`}
                                />
                              );
                            })}
                            <span
                              aria-hidden="true"
                              className={`dvm-cover${dayVodLive.has(vod.titleNo) ? " is-gone" : ""}`}
                            >
                              {vod.thumbQuery ? (
                                // SOOP 스냅샷은 외부 호스트(원격 패턴 없음)·크기 미정이라 next/image 대신 <img>.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt=""
                                  src={`https://videoimg.sooplive.com/php/SnapshotLoad.php?${vod.thumbQuery}`}
                                />
                              ) : null}
                              <span className="dvm-play">
                                <Play size={16} strokeWidth={2.6} />
                              </span>
                              {vod.durationMs > 0 ? (
                                <em className="dvm-dur">{formatVodDuration(vod.durationMs)}</em>
                              ) : null}
                            </span>
                            {/* 키 토글 피드백(🔇/🔊) — 마지막으로 다룬 방송 위에만, 1.4초 뒤 사라짐. */}
                            {dayVodNotice && dayVodFocusRef.current === vod.titleNo ? (
                              <span aria-live="polite" className="dvm-notice" key={dayVodNotice.n} role="status">
                                {dayVodNotice.text}
                              </span>
                            ) : null}
                            <a
                              aria-label="숲에서 크게 보기"
                              className="dvm-ext"
                              data-act="vod-replay"
                              href={
                                dayVodJump?.titleNo === vod.titleNo
                                  ? `${playerUrl}?change_second=${dayVodJump.sec}`
                                  : playerUrl
                              }
                              onClick={() => hapticTick()}
                              rel="noopener noreferrer"
                              target="_blank"
                              title="숲에서 크게 보기"
                            >
                              <ExternalLink aria-hidden="true" size={13} strokeWidth={2.6} />
                            </a>
                          </div>
                          {/* 가로 타임라인 띠 자리(4번) — 레일(VodChapters)이 포털로 채운다. 챕터 없는 방송은 비어 0 높이. */}
                          <div className="dvm-strip" ref={setDayVodStripHost} />
                          <VodChapters
                            chapters={vod.chapters ?? 0}
                            /* 다중 방송 날도 기본 펼침(2026-09-03) — 접힌 토글만 레일 자리에
                               떠 '어느 영상의 타임라인인지' 소속이 안 읽혔다. 2패널에선 각
                               방송 블록이 자기 높이 안에 레일을 가두므로 다 펼쳐도 안 길다. */
                            defaultOpen
                            durationMs={vod.durationMs}
                            onJump={(sec) => jumpDayVod(vod.titleNo, sec)}
                            register={registerDayVodChapterApi}
                            slug={slug}
                            stripHost={dayVodStripHost}
                            subscribeTime={(cb) => subscribeDayVodTime(vod.titleNo, cb)}
                            timelineBy={vod.timelineBy ?? ""}
                            titleNo={vod.titleNo}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
}
