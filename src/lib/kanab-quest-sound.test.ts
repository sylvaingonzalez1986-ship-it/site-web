import { describe, expect, it, vi } from "vitest";
import { createKqSoundController, type KqSoundInstrument } from "./kanab-quest-sound";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  let state: AudioContextState = "suspended";
  let visible = true;
  let activated = true;
  let time = 0;
  let stateChange = () => {};
  const resumes: ReturnType<typeof deferred>[] = [];
  const instrument: KqSoundInstrument = {
    state: () => state,
    resume: vi.fn(() => {
      const pending = deferred();
      resumes.push(pending);
      return pending.promise;
    }),
    suspend: vi.fn(async () => { state = "suspended"; }),
    silence: vi.fn(),
    unmute: vi.fn(),
    close: vi.fn(() => { state = "closed"; }),
    onStateChange(listener) { stateChange = listener; },
    navigation: vi.fn(),
    cue: vi.fn(),
  };
  const changed = vi.fn();
  const factory = vi.fn(() => instrument);
  const controller = createKqSoundController({
    onEnabledChange: changed, createInstrument: factory,
    isVisible: () => visible, hasUserActivation: () => activated, now: () => time,
  });
  return {
    controller, instrument, changed, factory, resumes,
    visible(value: boolean) { visible = value; },
    activation(value: boolean) { activated = value; },
    time(value: number) { time = value; },
    state(value: AudioContextState) { state = value; stateChange(); },
    async finish(index = resumes.length - 1) {
      state = "running";
      resumes[index].resolve();
      await Promise.resolve();
    },
    async enable() { controller.toggle(); state = "running"; resumes.at(-1)!.resolve(); await Promise.resolve(); },
  };
}

describe("Kanab Quest opt-in sound session", () => {
  it("creates no audio or resume for construction and muted gameplay events", () => {
    const test = setup();
    test.controller.playNavigation(293.66);
    test.controller.playOnce("harvest", "run-1");
    expect(test.factory).not.toHaveBeenCalled();
    expect(test.instrument.cue).not.toHaveBeenCalled();
    test.controller.dispose();
    expect(test.instrument.close).not.toHaveBeenCalled();
  });

  it("requires a visible page and active user gesture to enable audio", () => {
    const test = setup();
    test.activation(false); test.controller.toggle();
    test.activation(true); test.visible(false); test.controller.toggle();
    expect(test.factory).not.toHaveBeenCalled();
  });

  it("plays distinct confirmed cues once and never creates another context", async () => {
    const test = setup();
    await test.enable();
    test.controller.playOnce("harvest", "run-1");
    test.controller.playOnce("harvest", "run-1");
    test.controller.playOnce("reward", "mission-1");
    test.controller.playOnce("victory", "battle-1");
    test.controller.playOnce("defeat", "battle-2");
    test.controller.playOnce("dice", "run-2:stage-1");
    expect(test.instrument.cue).toHaveBeenCalledTimes(5);
    expect(test.factory).toHaveBeenCalledTimes(1);
    expect(test.changed).toHaveBeenLastCalledWith(true);
  });

  it("does not replay a receipt first observed while muted", async () => {
    const test = setup();
    test.controller.playOnce("reward", "old-receipt");
    await test.enable();
    test.controller.playOnce("reward", "old-receipt");
    test.controller.playOnce("reward", " ");
    expect(test.instrument.cue).not.toHaveBeenCalled();
  });

  it("mutes immediately, keeps deduplication, and reuses the existing instrument", async () => {
    const test = setup();
    await test.enable();
    test.controller.playOnce("reward", "mission-1");
    test.controller.toggle();
    expect(test.instrument.silence).toHaveBeenCalledTimes(1);
    expect(test.instrument.suspend).toHaveBeenCalledTimes(1);
    test.controller.playOnce("reward", "mission-2");
    await test.enable();
    test.controller.playOnce("reward", "mission-1");
    test.controller.playOnce("reward", "mission-2");
    expect(test.factory).toHaveBeenCalledTimes(1);
    expect(test.instrument.cue).toHaveBeenCalledTimes(1);
  });

  it("invalidates a delayed resume after the player immediately switches off", async () => {
    const test = setup();
    test.controller.toggle();
    test.controller.toggle();
    await test.finish();
    expect(test.instrument.unmute).not.toHaveBeenCalled();
    expect(test.instrument.state()).toBe("suspended");
    expect(test.changed).not.toHaveBeenCalledWith(true);
  });

  it("ignores an older rejected resume after a newer activation has succeeded", async () => {
    const test = setup();
    test.controller.toggle(); test.controller.toggle(); test.controller.toggle();
    await test.finish(1);
    test.resumes[0].reject(new Error("old request"));
    await Promise.resolve(); await Promise.resolve();
    test.controller.playOnce("harvest", "current");
    expect(test.changed).toHaveBeenLastCalledWith(true);
    expect(test.instrument.cue).toHaveBeenCalledWith("harvest");
  });

  it("does not let an old successful resume interrupt the latest enabled session", async () => {
    const test = setup();
    test.controller.toggle(); test.controller.toggle(); test.controller.toggle();
    await test.finish(1);
    await test.finish(0);
    expect(test.instrument.unmute).toHaveBeenCalledTimes(1);
    expect(test.instrument.suspend).toHaveBeenCalledTimes(1);
    expect(test.instrument.state()).toBe("running");
  });

  it("stops audio when hidden and never resumes upon returning or receiving an event", async () => {
    const test = setup();
    await test.enable();
    test.visible(false); test.controller.hide();
    test.visible(true);
    test.controller.playNavigation(440);
    test.controller.playOnce("reward", "background-receipt");
    expect(test.instrument.silence).toHaveBeenCalledTimes(1);
    expect(test.instrument.resume).toHaveBeenCalledTimes(1);
    expect(test.instrument.navigation).not.toHaveBeenCalled();
    expect(test.instrument.cue).not.toHaveBeenCalled();
    expect(test.changed).toHaveBeenLastCalledWith(false);
  });

  it("invalidates a pending resume when the page becomes hidden", async () => {
    const test = setup();
    test.controller.toggle();
    test.visible(false); test.controller.hide();
    await test.finish();
    expect(test.instrument.unmute).not.toHaveBeenCalled();
    expect(test.instrument.state()).toBe("suspended");
  });

  it("shows sound off after browser interruption and requires explicit reactivation", async () => {
    const test = setup();
    await test.enable();
    test.state("suspended");
    test.controller.playOnce("dice", "stage-1");
    expect(test.instrument.cue).not.toHaveBeenCalled();
    expect(test.changed).toHaveBeenLastCalledWith(false);
    expect(test.instrument.resume).toHaveBeenCalledTimes(1);
  });

  it("disposes once and ignores async work, gestures and events after unmount", async () => {
    const test = setup();
    test.controller.toggle();
    test.controller.dispose(); test.controller.dispose();
    await test.finish();
    test.controller.toggle(); test.controller.hide();
    test.controller.playOnce("harvest", "late"); test.controller.playNavigation(440);
    expect(test.instrument.close).toHaveBeenCalledTimes(1);
    expect(test.instrument.unmute).not.toHaveBeenCalled();
    expect(test.instrument.cue).not.toHaveBeenCalled();
    expect(test.changed).not.toHaveBeenCalled();
    expect(test.instrument.resume).toHaveBeenCalledTimes(1);
  });

  it("handles unavailable audio and rejected resumes without gameplay errors", async () => {
    const changed = vi.fn();
    const unavailable = createKqSoundController({
      onEnabledChange: changed, isVisible: () => true, hasUserActivation: () => true,
      createInstrument: () => { throw new Error("AudioContext unavailable"); },
    });
    expect(() => unavailable.toggle()).not.toThrow();
    expect(changed).toHaveBeenLastCalledWith(false);
    const test = setup();
    test.controller.toggle();
    test.resumes[0].reject(new Error("permission denied"));
    await Promise.resolve(); await Promise.resolve();
    expect(test.changed).toHaveBeenLastCalledWith(false);
    expect(test.instrument.unmute).not.toHaveBeenCalled();
  });

  it("limits rapid navigation and rejects non-audible or invalid frequencies", async () => {
    const test = setup();
    await test.enable();
    for (const frequency of [NaN, Infinity, -1, 0, 50000]) test.controller.playNavigation(frequency);
    test.controller.playNavigation(293.66);
    test.time(40); test.controller.playNavigation(440);
    test.time(90); test.controller.playNavigation(440);
    expect(test.instrument.navigation).toHaveBeenCalledTimes(2);
    expect(test.instrument.resume).toHaveBeenCalledTimes(1);
  });
});
