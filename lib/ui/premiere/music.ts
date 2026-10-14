/** Original scores, not transcriptions/samples of reference countdown music. */
export const PREMIERE_TRACKS = [
  { id: "spark-pop", name: "반짝이는 출발", bpm: 120, wave: "triangle", root: 2, chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], motif: [0, 2, 4, 2, 1, 3, 5, 2], kicks: [0, 4, 8, 12], bass: [0, 6, 8, 14], swing: 0 },
  { id: "velvet-bounce", name: "통통 튀는 응원", bpm: 112, wave: "triangle", root: -2, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [8, 12, 15, 19], [7, 10, 14, 17]], motif: [2, 0, 3, 1, 4, 2, 5, 3], kicks: [0, 7, 10], bass: [0, 3, 6, 10, 14], swing: .14 },
  { id: "neon-run", name: "빛을 향한 질주", bpm: 132, wave: "sawtooth", root: 4, chords: [[0, 3, 7, 10], [8, 12, 15, 19], [3, 7, 10, 14], [10, 14, 17, 21]], motif: [0, 4, 2, 5, 1, 4, 3, 6], kicks: [0, 4, 8, 12], bass: [0, 2, 6, 8, 10, 14], swing: 0 },
  { id: "curtain-rise", name: "막이 오르는 순간", bpm: 104, wave: "sine", root: -3, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [8, 12, 15, 19], [7, 11, 14, 17]], motif: [0, 2, 1, 3, 2, 4, 3, 5], kicks: [0, 8], bass: [0, 8], swing: 0 },
] as const;
export type PremiereTrack = typeof PREMIERE_TRACKS[number];
export type MusicNote = { kind: "lead" | "chord" | "bass" | "kick" | "snare" | "hat"; semi: number; duration: number; level: number };
export const MUSIC_OPEN = 68;
export const MUSIC_QUIET = 10.5;

export function pickPremiereTrack(previous?: string, random = Math.random): PremiereTrack {
  const pool = PREMIERE_TRACKS.filter(track => track.id !== previous);
  const roll = random();
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * pool.length)))];
}

export function musicStepTime(track: PremiereTrack, step: number) {
  return (step + (step % 2 ? track.swing : 0)) * 60 / track.bpm / 4;
}

/** 4-bar harmony, 2-bar call/response. Grow arrangement, not master loudness. */
export function premiereMusicStep(track: PremiereTrack, step: number): MusicNote[] {
  const elapsed = musicStepTime(track, step), remain = MUSIC_OPEN - elapsed;
  if (!Number.isFinite(elapsed) || step < 0 || remain <= MUSIC_QUIET) return [];
  const position = step % 16, bar = Math.floor(step / 16);
  const chord = track.chords[bar % track.chords.length];
  const build = remain < 44, peak = remain < 26;
  const fade = Math.min(1, Math.max(0, (remain - MUSIC_QUIET) / 3.5));
  const notes: MusicNote[] = [];
  const add = (kind: MusicNote["kind"], semi: number, duration: number, level: number) => {
    notes.push({ kind, semi: semi + track.root, duration: Math.min(duration, remain - MUSIC_QUIET), level: level * fade });
  };
  if ((track.kicks as readonly number[]).includes(position) || peak && position === 14) add("kick", -24, .19, .22);
  if (position === 4 || position === 12 || peak && bar % 4 === 3 && position >= 14) add("snare", 0, .105, .065);
  if (position % (peak ? 1 : 2) === 0) add("hat", 0, position % 4 === 2 ? .07 : .035, position % 4 === 2 ? .026 : .014);
  if ((track.bass as readonly number[]).includes(position)) add("bass", chord[position >= 12 ? 2 : 0] - 24, .18, .14);
  if (position === 0 || build && position === 10) {
    for (const tone of chord) add("chord", tone, build ? .65 : .32, .025);
  }
  // Leave holes for the groove, then let the answer fill them in. The last
  // two beats of every fourth bar lift an octave rather than turn up volume.
  const stride = peak ? 1 : build ? 2 : 4;
  if (position % stride === 0 && (position !== 8 || peak)) {
    const motifIndex = (Math.floor(position / stride) + (bar % 2 ? 3 : 0)) % track.motif.length;
    const degree = track.motif[motifIndex];
    const tone = chord[degree % 4] + Math.floor(degree / 4) * 12;
    add("lead", tone + (peak && bar % 4 === 3 && position >= 12 ? 12 : 0), peak ? .13 : .24, .085);
  }
  return notes;
}

/** Shared 100ms clock drives a 150ms lookahead; actual notes use audio time.
 * Never replay missed bars after a sleeping tab or a clock correction. */
export function premiereMusicWindow(track: PremiereTrack, remainMs: number, lastStep: number) {
  const elapsed = MUSIC_OPEN - remainMs / 1000, unit = 60 / track.bpm / 4;
  if (!Number.isFinite(elapsed) || elapsed < 0 || remainMs <= MUSIC_QUIET * 1000) return [];
  const current = Math.floor(elapsed / unit);
  const after = lastStep > current + 3 ? current - 1 : lastStep;
  const events: { step: number; delay: number; notes: MusicNote[] }[] = [];
  for (let step = Math.max(0, current, after + 1); musicStepTime(track, step) <= elapsed + .15; step++) {
    const time = musicStepTime(track, step);
    if (time < elapsed - .015) continue;
    const notes = premiereMusicStep(track, step);
    if (notes.length) events.push({ step, delay: Math.max(0, time - elapsed), notes });
  }
  return events;
}
