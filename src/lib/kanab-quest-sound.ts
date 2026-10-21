export type KqSoundCue = "harvest" | "reward" | "victory" | "defeat" | "dice";

type Note = readonly [frequency: number, offset: number, duration: number];
const SCORES: Record<KqSoundCue, readonly Note[]> = {
  harvest: [[293.66, 0, .32], [369.99, .1, .38], [440, .2, .48]],
  reward: [[440, 0, .26], [554.37, .09, .3], [659.25, .18, .4]],
  victory: [[293.66, 0, .34], [440, .1, .38], [587.33, .2, .5], [739.99, .3, .45]],
  defeat: [[369.99, 0, .26], [329.63, .12, .3], [293.66, .24, .38]],
  dice: [[180, 0, .045], [140, .065, .045], [160, .14, .06]],
};

/** Kept separate from React so delayed browser resumes can be exercised directly. */
export type KqSoundInstrument = {
  state: () => AudioContextState;
  resume: () => Promise<void>;
  suspend: () => Promise<void>;
  silence: () => void;
  unmute: () => void;
  close: () => void;
  onStateChange: (listener: () => void) => void;
  navigation: (frequency: number) => void;
  cue: (cue: KqSoundCue) => void;
};

function createInstrument(): KqSoundInstrument {
  const audio = new AudioContext({ latencyHint: "interactive" });
  const master = audio.createGain();
  master.gain.setValueAtTime(0, audio.currentTime);
  master.connect(audio.destination);
  const voices = new Map<OscillatorNode, GainNode>();

  function release(source: OscillatorNode, stop = false) {
    const envelope = voices.get(source);
    if (!envelope) return;
    source.onended = null;
    if (stop) { try { source.stop(); } catch { /* Already ended. */ } }
    source.disconnect();
    envelope.disconnect();
    voices.delete(source);
  }

  function silence() {
    master.gain.cancelScheduledValues(audio.currentTime);
    master.gain.setValueAtTime(0, audio.currentTime);
    for (const source of voices.keys()) release(source, true);
  }

  function note(frequency: number, offset: number, duration: number, wooden = false) {
    if (voices.size >= 16) return;
    const source = audio.createOscillator();
    const envelope = audio.createGain();
    const start = audio.currentTime + .006 + offset;
    source.type = wooden ? "triangle" : "sine";
    source.frequency.setValueAtTime(frequency, start);
    if (wooden) source.frequency.exponentialRampToValueAtTime(frequency * .7, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(wooden ? .08 : .1, start + Math.min(.012, duration / 5));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    envelope.gain.linearRampToValueAtTime(0, start + duration + .015);
    source.connect(envelope);
    envelope.connect(master);
    voices.set(source, envelope);
    source.onended = () => release(source);
    source.start(start);
    source.stop(start + duration + .02);
  }

  return {
    state: () => audio.state,
    resume: () => audio.resume(),
    suspend: () => audio.state === "closed" ? Promise.resolve() : audio.suspend(),
    silence,
    unmute() {
      master.gain.cancelScheduledValues(audio.currentTime);
      master.gain.setValueAtTime(0, audio.currentTime);
      master.gain.linearRampToValueAtTime(.18, audio.currentTime + .02);
    },
    close() {
      audio.onstatechange = null;
      silence();
      master.disconnect();
      if (audio.state !== "closed") void audio.close().catch(() => {});
    },
    onStateChange(listener) { audio.onstatechange = listener; },
    navigation(frequency) { note(frequency, 0, .095, true); },
    cue(cue) { for (const [frequency, offset, duration] of SCORES[cue]) note(frequency, offset, duration, cue === "dice"); },
  };
}

type Options = {
  onEnabledChange: (enabled: boolean) => void;
  createInstrument?: () => KqSoundInstrument;
  isVisible?: () => boolean;
  hasUserActivation?: () => boolean;
  now?: () => number;
};

/** A shell session owns its audio. Nothing is persisted or played on construction. */
export function createKqSoundController({
  onEnabledChange,
  createInstrument: makeInstrument = createInstrument,
  isVisible = () => !document.hidden,
  hasUserActivation = () => !navigator.userActivation || navigator.userActivation.isActive,
  now = () => performance.now(),
}: Options) {
  let instrument: KqSoundInstrument | null = null;
  let enabled = false;
  let wanted = false;
  let disposed = false;
  let operation = 0;
  let lastNavigation = -Infinity;
  const seen = new Set<string>();

  function mute() {
    operation++;
    wanted = false;
    enabled = false;
    instrument?.silence();
    if (instrument) void instrument.suspend().catch(() => {});
    if (!disposed) onEnabledChange(false);
  }

  function ready() {
    return !disposed && enabled && wanted && isVisible() && instrument?.state() === "running" ? instrument : null;
  }

  return {
    toggle() {
      if (disposed) return;
      if (wanted) { mute(); return; }
      if (!isVisible() || !hasUserActivation()) return;
      const request = ++operation;
      wanted = true;
      try {
        if (!instrument || instrument.state() === "closed") {
          instrument = makeInstrument();
          instrument.onStateChange(() => {
            if (enabled && instrument?.state() !== "running") mute();
          });
        }
        const current = instrument;
        // Calling resume synchronously preserves the explicit button activation.
        void current.resume().then(() => {
          if (disposed || request !== operation || !wanted || current !== instrument) {
            // A stale browser resume must not leave a muted session running.
            if (!disposed && !wanted && current.state() !== "closed") {
              current.silence();
              void current.suspend().catch(() => {});
            }
            return;
          }
          if (!isVisible() || current.state() !== "running") { mute(); return; }
          current.unmute();
          lastNavigation = -Infinity;
          enabled = true;
          onEnabledChange(true);
        }).catch(() => { if (!disposed && request === operation) mute(); });
      } catch { if (!disposed && request === operation) mute(); }
    },
    playNavigation(frequency: number) {
      const current = ready();
      const time = now();
      if (!current || !Number.isFinite(frequency) || frequency < 80 || frequency > 2000 || time - lastNavigation < 90) return;
      lastNavigation = time;
      current.navigation(frequency);
    },
    playOnce(cue: KqSoundCue, id: string) {
      if (disposed || !id.trim()) return;
      const key = `${cue}:${id}`;
      if (seen.has(key)) return;
      // A receipt first seen while muted must not be celebrated later.
      seen.add(key);
      ready()?.cue(cue);
    },
    hide() { if (!disposed) mute(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      operation++;
      wanted = false;
      enabled = false;
      instrument?.close();
      instrument = null;
      seen.clear();
    },
  };
}
