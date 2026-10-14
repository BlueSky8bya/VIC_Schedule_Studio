import type { MusicNote, PremiereTrack } from "./music";

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ac: BaseAudioContext) {
  let buffer = noiseBuffers.get(ac);
  if (!buffer) {
    buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * .2), ac.sampleRate);
    const data = buffer.getChannelData(0); let seed = 104729;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
    noiseBuffers.set(ac, buffer);
  }
  return buffer;
}

/** Runtime and offline audition share these exact voices/envelopes. */
export function renderPremiereNote(ac: BaseAudioContext, out: AudioNode, track: PremiereTrack, note: MusicNote, start: number, voices: Set<AudioScheduledSourceNode>) {
  const percussion = note.kind === "snare" || note.kind === "hat";
  const source = percussion ? ac.createBufferSource() : ac.createOscillator();
  const envelope = ac.createGain(), filter = ac.createBiquadFilter();
  const end = start + note.duration;
  if (source instanceof AudioBufferSourceNode) {
    source.buffer = noise(ac);
    filter.type = "bandpass";
    filter.frequency.value = note.kind === "hat" ? 3600 : 1700;
    filter.Q.value = note.kind === "hat" ? .65 : .5;
  } else {
    source.type = note.kind === "kick" ? "sine" : note.kind === "bass" ? "triangle" : track.wave;
    const hz = 261.6256 * 2 ** (note.semi / 12);
    source.frequency.setValueAtTime(note.kind === "kick" ? 135 : hz, start);
    if (note.kind === "kick") source.frequency.exponentialRampToValueAtTime(46, start + Math.min(.12, note.duration));
    filter.type = "lowpass";
    filter.frequency.value = note.kind === "bass" ? 650 : note.kind === "chord" ? 1600 : 3000;
    filter.Q.value = .5;
  }
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(note.level, start + Math.min(note.kind === "chord" ? .025 : .006, note.duration / 4));
  envelope.gain.exponentialRampToValueAtTime(.00001, end);
  source.connect(filter).connect(envelope).connect(out);
  voices.add(source);
  source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  source.start(start); source.stop(end);
}
