"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LotteryCardRarity } from "@/types/lottery";

type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };
type Instrument = {
  audio: AudioContext;
  master: GainNode;
  voices: Set<Voice>;
  noise: AudioBuffer;
};
type Note = readonly [frequency: number, offset: number, duration: number, gain?: number];
const MASTER_GAIN = 0.14;
const MAX_VOICES = 24;
const SCORE: Record<LotteryCardRarity, readonly Note[]> = {
  common: [[523.25, 0, 0.5, 0.08], [659.25, 0.08, 0.58, 0.055]],
  silver: [[783.99, 0, 0.6], [987.77, 0.08, 0.65], [1174.66, 0.17, 0.75, 0.045]],
  gold: [[261.63, 0, 0.9, 0.055], [523.25, 0, 0.7], [659.25, 0.1, 0.8], [783.99, 0.2, 0.9], [1046.5, 0.31, 1, 0.045]],
  epic: [[220, 0, 1.1, 0.05], [440, 0, 0.9], [659.25, 0.1, 1], [880, 0.2, 1.1], [1046.5, 0.3, 1.1, 0.05], [1318.51, 0.4, 1.1, 0.035], [1567.98, 0.53, 0.85, 0.025]],
  legendary: [
    [392, 0, 0.6], [493.88, 0.1, 0.55], [587.33, 0.2, 0.55], [783.99, 0.31, 0.65], [987.77, 0.42, 0.6, 0.045],
    [261.63, 0.66, 1.4, 0.065], [523.25, 0.66, 1.35], [659.25, 0.69, 1.3, 0.055], [783.99, 0.72, 1.25, 0.05], [1046.5, 0.79, 1.25, 0.045],
  ],
};

function releaseVoice(instrument: Instrument, voice: Voice, stop = false) {
  voice.source.onended = null;
  if (stop) {
    try { voice.source.stop(); } catch { /* A voice may already have ended. */ }
  }
  for (const node of voice.nodes) node.disconnect();
  instrument.voices.delete(voice);
}

function stopVoices(instrument: Instrument) {
  for (const voice of instrument.voices) releaseVoice(instrument, voice, true);
}

function trackVoice(instrument: Instrument, source: AudioScheduledSourceNode, nodes: AudioNode[], start: number, end: number) {
  const voice = { source, nodes: [source, ...nodes] };
  instrument.voices.add(voice);
  source.onended = () => releaseVoice(instrument, voice);
  source.start(start);
  source.stop(end);
}

function tone(instrument: Instrument, frequency: number, offset: number, duration: number, level = 0.065, rise = 1) {
  // Skip excess voices instead of cutting an audible decay on rapid input.
  if (instrument.voices.size >= MAX_VOICES) return;
  const { audio, master } = instrument;
  const source = audio.createOscillator();
  const envelope = audio.createGain();
  const start = audio.currentTime + 0.008 + offset;
  source.type = "sine";
  source.frequency.setValueAtTime(frequency, start);
  if (rise !== 1) source.frequency.exponentialRampToValueAtTime(frequency * rise, start + duration * 0.8);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(level, start + Math.min(0.025, duration * 0.15));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  envelope.gain.linearRampToValueAtTime(0, start + duration + 0.025);
  source.connect(envelope);
  envelope.connect(master);
  trackVoice(instrument, source, [envelope], start, start + duration + 0.03);
}

function foil(instrument: Instrument) {
  if (instrument.voices.size >= MAX_VOICES) return;
  const { audio, master, noise } = instrument;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  const start = audio.currentTime + 0.008;
  source.buffer = noise;
  filter.type = "bandpass";
  filter.Q.setValueAtTime(0.65, start);
  filter.frequency.setValueAtTime(1100, start);
  filter.frequency.exponentialRampToValueAtTime(2400, start + 0.23);
  filter.frequency.exponentialRampToValueAtTime(900, start + 0.48);
  envelope.gain.setValueAtTime(0, start);
  // A few rounded creases give the noise a paper/foil texture rather than a hiss.
  for (const [offset, level] of [[0.025, 0.12], [0.075, 0.035], [0.13, 0.1], [0.19, 0.035], [0.25, 0.085], [0.34, 0.025]] as const) {
    envelope.gain.linearRampToValueAtTime(level, start + offset);
  }
  envelope.gain.linearRampToValueAtTime(0, start + 0.5);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(master);
  trackVoice(instrument, source, [filter, envelope], start, start + 0.51);
}

function createInstrument(): Instrument {
  const audio = new AudioContext({ latencyHint: "interactive" });
  const master = audio.createGain();
  master.gain.setValueAtTime(0, audio.currentTime);
  master.connect(audio.destination);
  const noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.6), audio.sampleRate);
  const samples = noise.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < samples.length; i++) {
    previous = previous * 0.55 + (Math.random() * 2 - 1) * 0.45;
    samples[i] = previous;
  }
  return { audio, master, noise, voices: new Set() };
}

/** Optional, local synthesis. Only the sound button may create or resume audio. */
export function useBoosterSound() {
  const [enabled, setEnabled] = useState(false);
  const instrument = useRef<Instrument | null>(null);
  const wanted = useRef(false);
  const mounted = useRef(false);
  const operation = useRef(0);
  const lastPlayed = useRef(-Infinity);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      wanted.current = false;
      const current = instrument.current;
      instrument.current = null;
      if (current) {
        stopVoices(current);
        current.master.disconnect();
        if (current.audio.state !== "closed") void current.audio.close().catch(() => {});
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (!mounted.current) return;
    const request = ++operation.current;
    if (wanted.current) {
      wanted.current = false;
      setEnabled(false);
      const current = instrument.current;
      if (current) {
        current.master.gain.cancelScheduledValues(current.audio.currentTime);
        current.master.gain.setValueAtTime(0, current.audio.currentTime);
        stopVoices(current);
        void current.audio.suspend().catch(() => {});
      }
      return;
    }
    // Playback callbacks never resume a context after browser interruption.
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    wanted.current = true;
    try {
      const current = instrument.current?.audio.state !== "closed" ? instrument.current : null;
      const next = current ?? createInstrument();
      instrument.current = next;
      // Synchronous invocation preserves the activation from the sound-button click.
      void next.audio.resume().then(() => {
        if (!mounted.current || operation.current !== request || !wanted.current || instrument.current !== next) return;
        const running = next.audio.state === "running";
        wanted.current = running;
        if (running) {
          next.master.gain.cancelScheduledValues(next.audio.currentTime);
          next.master.gain.setValueAtTime(0, next.audio.currentTime);
          next.master.gain.linearRampToValueAtTime(MASTER_GAIN, next.audio.currentTime + 0.025);
          lastPlayed.current = -Infinity;
        }
        setEnabled(running);
      }).catch(() => {
        if (!mounted.current || operation.current !== request || instrument.current !== next) return;
        wanted.current = false;
        setEnabled(false);
      });
    } catch {
      wanted.current = false;
      setEnabled(false);
    }
  }, []);

  const ready = useCallback(() => {
    const current = instrument.current;
    const now = performance.now();
    if (!mounted.current || !wanted.current || !current || current.audio.state !== "running" || now - lastPlayed.current < 75) return null;
    lastPlayed.current = now;
    return current;
  }, []);

  const playOpening = useCallback(() => {
    const current = ready();
    if (!current) return;
    foil(current);
    tone(current, 196, 0.05, 0.75, 0.045, 1.5);
    tone(current, 293.66, 0.12, 0.8, 0.03, 1.5);
    tone(current, 587.33, 0.4, 0.55, 0.025);
  }, [ready]);

  const playReveal = useCallback((rarity: LotteryCardRarity) => {
    const current = ready();
    if (!current) return;
    for (const [frequency, offset, duration, gain] of SCORE[rarity]) tone(current, frequency, offset, duration, gain);
    if (rarity === "epic" || rarity === "legendary") {
      // Quiet octave echoes add shimmer without a feedback loop or long reverb tail.
      tone(current, 1567.98, 0.58, 0.75, 0.018);
      tone(current, 2093, 0.78, 0.6, 0.012);
    }
  }, [ready]);

  const playAdvance = useCallback(() => {
    const current = ready();
    if (current) tone(current, 659.25, 0, 0.12, 0.035, 0.8);
  }, [ready]);

  return { enabled, toggle, playOpening, playReveal, playAdvance };
}
