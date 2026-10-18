/** Original CC0 recordings, served locally. Provenance accompanies each file. */
export type CompanionRadioMood = "lively" | "graceful" | "calm";
export type CompanionRadioTrack = Readonly<{ id: string; title: string; creator: string; mood: CompanionRadioMood; bpm: number; src: string; sourceUrl: string; license: "CC0-1.0" }>;
export const COMPANION_RADIO_MOOD_NAMES = { lively: "신나게", graceful: "우아하게", calm: "잔잔하게" } as const;
export const COMPANION_RADIO_TRACKS: readonly CompanionRadioTrack[] = [
  {
    "id": "radio-01",
    "title": "작은 고향",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-01.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-2-towns",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-02",
    "title": "햇살 마을",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-02.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-2-towns",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-03",
    "title": "느긋한 오후",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-03.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-2-towns",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-04",
    "title": "골목 장터",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-04.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-2-towns",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-05",
    "title": "폭신한 구름",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "calm",
    "bpm": 68,
    "src": "/companion/audio/radio/radio-05.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-4-calm",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-06",
    "title": "따뜻한 낮잠",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "calm",
    "bpm": 68,
    "src": "/companion/audio/radio/radio-06.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-4-calm",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-07",
    "title": "별빛 창가",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "calm",
    "bpm": 68,
    "src": "/companion/audio/radio/radio-07.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-4-calm",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-08",
    "title": "느린 산책",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "calm",
    "bpm": 68,
    "src": "/companion/audio/radio/radio-08.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-4-calm",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-09",
    "title": "보송한 꿈",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "calm",
    "bpm": 68,
    "src": "/companion/audio/radio/radio-09.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-4-calm",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-10",
    "title": "집으로 가는 길",
    "creator": "Juhani Junkala / SubspaceAudio",
    "mood": "calm",
    "bpm": 68,
    "src": "/companion/audio/radio/radio-10.ogg",
    "sourceUrl": "https://opengameart.org/content/jrpg-pack-4-calm",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-11",
    "title": "반짝이는 여행",
    "creator": "Ragnar Random",
    "mood": "graceful",
    "bpm": 78,
    "src": "/companion/audio/radio/radio-11.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-12",
    "title": "작은 유리병",
    "creator": "Ragnar Random",
    "mood": "graceful",
    "bpm": 78,
    "src": "/companion/audio/radio/radio-12.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-13",
    "title": "경쾌한 발걸음",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-13.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-14",
    "title": "초록빛 모험",
    "creator": "Ragnar Random",
    "mood": "graceful",
    "bpm": 78,
    "src": "/companion/audio/radio/radio-14.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-15",
    "title": "살랑살랑 바람",
    "creator": "Ragnar Random",
    "mood": "graceful",
    "bpm": 78,
    "src": "/companion/audio/radio/radio-15.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-16",
    "title": "보랏빛 저녁",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-16.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-17",
    "title": "동글동글 구름",
    "creator": "Ragnar Random",
    "mood": "graceful",
    "bpm": 78,
    "src": "/companion/audio/radio/radio-17.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-18",
    "title": "조용한 정원",
    "creator": "Ragnar Random",
    "mood": "graceful",
    "bpm": 78,
    "src": "/companion/audio/radio/radio-18.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-19",
    "title": "나른한 숲",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-19.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-20",
    "title": "춤추는 햇살",
    "creator": "Ragnar Random",
    "mood": "graceful",
    "bpm": 78,
    "src": "/companion/audio/radio/radio-20.ogg",
    "sourceUrl": "https://opengameart.org/content/orchestral-and-world-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-21",
    "title": "통통 도시",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-21.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-22",
    "title": "공룡 친구",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-22.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-23",
    "title": "별나라 산책",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-23.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-24",
    "title": "공주님의 소풍",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-24.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-25",
    "title": "바닷속 산책",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-25.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-26",
    "title": "이름 없는 노래",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-26.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-27",
    "title": "보물 찾기",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-27.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-28",
    "title": "버섯 마을",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-28.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-29",
    "title": "고블린 파티",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-29.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-30",
    "title": "꼬마 모험가",
    "creator": "Ragnar Random",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-30.ogg",
    "sourceUrl": "https://opengameart.org/content/rock-music-pack",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-31",
    "title": "얼음 언덕",
    "creator": "TheFrenchDodo",
    "mood": "lively",
    "bpm": 128,
    "src": "/companion/audio/radio/radio-31.ogg",
    "sourceUrl": "https://opengameart.org/content/retro-tunes",
    "license": "CC0-1.0"
  },
  {
    "id": "radio-32",
    "title": "분홍빛 쉼표",
    "creator": "TheFrenchDodo",
    "mood": "calm",
    "bpm": 68,
    "src": "/companion/audio/radio/radio-32.ogg",
    "sourceUrl": "https://opengameart.org/content/retro-tunes",
    "license": "CC0-1.0"
  }
];
