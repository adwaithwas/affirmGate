import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMPLETION_SOUND_REPEAT_GAP_MS,
  DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
} from './constants';
import {
  cancelActiveCompletionSequence,
  isCompletionSequenceActive,
  playCompletionSequence,
} from './timer-sound';

/** Instant wait that records the requested gap values. */
function makeRecordingWait(gaps: number[]) {
  return (ms: number): boolean => {
    gaps.push(ms);
    return true;
  };
}

afterEach(() => {
  // Never leave a sequence (or its gap timer) behind between tests.
  cancelActiveCompletionSequence();
  vi.useRealTimers();
});

describe('playCompletionSequence repetitions', () => {
  it('plays exactly one complete pattern when the count is 1', async () => {
    let patterns = 0;
    const result = await playCompletionSequence(
      { enabled: true, repeatCount: 1 },
      { playPattern: () => { patterns += 1; return true; }, wait: () => true },
    );

    expect(result.ok).toBe(true);
    expect(result.playedCount).toBe(1);
    expect(patterns).toBe(1);
  });

  it('plays exactly three complete patterns when the count is 3', async () => {
    let patterns = 0;
    const gaps: number[] = [];
    const result = await playCompletionSequence(
      { enabled: true, repeatCount: 3 },
      { playPattern: () => { patterns += 1; return true; }, wait: makeRecordingWait(gaps) },
    );

    expect(result.ok).toBe(true);
    expect(result.playedCount).toBe(3);
    expect(patterns).toBe(3);
    expect(gaps).toHaveLength(2);
    expect(gaps.every((gap) => gap === COMPLETION_SOUND_REPEAT_GAP_MS)).toBe(true);
  });

  it('plays exactly five complete patterns when the count is 5', async () => {
    let patterns = 0;
    const gaps: number[] = [];
    const result = await playCompletionSequence(
      { enabled: true, repeatCount: 5 },
      { playPattern: () => { patterns += 1; return true; }, wait: makeRecordingWait(gaps) },
    );

    expect(result.ok).toBe(true);
    expect(result.playedCount).toBe(5);
    expect(patterns).toBe(5);
    expect(gaps).toHaveLength(4);
  });

  it('never waits after the final pattern', async () => {
    const gaps: number[] = [];
    await playCompletionSequence(
      { enabled: true, repeatCount: 2 },
      { playPattern: () => true, wait: makeRecordingWait(gaps) },
    );
    expect(gaps).toEqual([COMPLETION_SOUND_REPEAT_GAP_MS]);
  });

  it('falls back to the default count when none is given', async () => {
    expect(DEFAULT_COMPLETION_SOUND_REPEAT_COUNT).toBe(3);

    let patterns = 0;
    const gaps: number[] = [];
    const result = await playCompletionSequence(
      { enabled: true },
      { playPattern: () => { patterns += 1; return true; }, wait: makeRecordingWait(gaps) },
    );

    expect(result.playedCount).toBe(DEFAULT_COMPLETION_SOUND_REPEAT_COUNT);
    expect(patterns).toBe(DEFAULT_COMPLETION_SOUND_REPEAT_COUNT);
    expect(gaps).toHaveLength(DEFAULT_COMPLETION_SOUND_REPEAT_COUNT - 1);
  });

  it('clamps out-of-range and malformed counts to the allowed 1-5 range', async () => {
    const playPattern = vi.fn(() => true);
    const wait = vi.fn(() => true);

    await playCompletionSequence(
      { enabled: true, repeatCount: 0 },
      { playPattern, wait },
    );
    expect(playPattern).toHaveBeenCalledTimes(1);

    playPattern.mockClear();
    await playCompletionSequence(
      { enabled: true, repeatCount: 99 },
      { playPattern, wait },
    );
    expect(playPattern).toHaveBeenCalledTimes(5);

    playPattern.mockClear();
    await playCompletionSequence(
      { enabled: true, repeatCount: Number.NaN },
      { playPattern, wait },
    );
    expect(playPattern).toHaveBeenCalledTimes(DEFAULT_COMPLETION_SOUND_REPEAT_COUNT);
  });
});

describe('playCompletionSequence pattern accounting', () => {
  it('does not count individual tones inside a pattern as repetitions', async () => {
    // Mirrors the real buzzer: one pattern = two tones.
    let tones = 0;
    let patterns = 0;
    const playPattern = () => {
      patterns += 1;
      tones += 2; // two pulses per pattern
      return true;
    };

    const result = await playCompletionSequence(
      { enabled: true, repeatCount: 3 },
      { playPattern, wait: () => true },
    );

    expect(result.playedCount).toBe(3);
    expect(patterns).toBe(3);
    expect(tones).toBe(6);
    // Tones are not sequences: only three logical patterns were played.
    expect(result.playedCount).toBe(patterns);
    expect(tones).not.toBe(result.playedCount);
  });

  it('stops after a failed pattern instead of continuing', async () => {
    const calls: boolean[] = [];
    const result = await playCompletionSequence(
      { enabled: true, repeatCount: 3 },
      {
        playPattern: () => {
          calls.push(true);
          return calls.length !== 2; // second pattern fails
        },
        wait: () => true,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('blocked');
    expect(result.playedCount).toBe(1);
    expect(calls).toHaveLength(2);
    expect(isCompletionSequenceActive()).toBe(false);
  });

  it('reports an error when a pattern throws and releases the sequence', async () => {
    const result = await playCompletionSequence(
      { enabled: true, repeatCount: 2 },
      {
        playPattern: () => {
          throw new Error('boom');
        },
        wait: () => true,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('error');
    expect(result.playedCount).toBe(0);
    expect(isCompletionSequenceActive()).toBe(false);
  });
});

describe('playCompletionSequence preferences and guards', () => {
  it('does not play anything when the sound is disabled', async () => {
    const playPattern = vi.fn(() => true);

    const result = await playCompletionSequence(
      { enabled: false, repeatCount: 3 },
      { playPattern, wait: () => true },
    );

    expect(result.ok).toBe(true);
    expect(result.disabled).toBe(true);
    expect(result.playedCount).toBe(0);
    expect(playPattern).not.toHaveBeenCalled();
    expect(isCompletionSequenceActive()).toBe(false);
  });

  it('fails gracefully (not loudly) when no audio output is available', async () => {
    // Node test environment has no Web Audio API, so the real pattern player
    // reports a blocked playback instead of throwing.
    const result = await playCompletionSequence({ enabled: true, repeatCount: 2 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('blocked');
    expect(result.playedCount).toBe(0);
    expect(isCompletionSequenceActive()).toBe(false);
  });

  it('prevents overlapping sequences (rapid Test Sound clicks)', async () => {
    let releaseFirst!: () => void;
    const firstPattern = new Promise<boolean>((resolve) => {
      releaseFirst = () => resolve(true);
    });

    const first = playCompletionSequence(
      { enabled: true, repeatCount: 1 },
      { playPattern: () => firstPattern },
    );

    expect(isCompletionSequenceActive()).toBe(true);

    const secondPlayPattern = vi.fn(() => true);
    const second = await playCompletionSequence(
      { enabled: true, repeatCount: 1 },
      { playPattern: secondPlayPattern },
    );

    expect(second).toEqual({ ok: false, playedCount: 0, reason: 'busy' });
    expect(secondPlayPattern).not.toHaveBeenCalled();

    releaseFirst();
    const firstResult = await first;
    expect(firstResult.ok).toBe(true);
    expect(isCompletionSequenceActive()).toBe(false);

    // The guard is released afterwards, so a later sequence can play.
    const third = await playCompletionSequence(
      { enabled: true, repeatCount: 1 },
      { playPattern: () => true },
    );
    expect(third.ok).toBe(true);
    expect(third.playedCount).toBe(1);
  });

  it('stops a running sequence when it is cancelled (page unload)', async () => {
    const gaps: number[] = [];
    const result = await playCompletionSequence(
      { enabled: true, repeatCount: 3 },
      {
        playPattern: () => true,
        wait: (ms) => {
          gaps.push(ms);
          cancelActiveCompletionSequence();
          return true;
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cancelled');
    expect(result.playedCount).toBe(1);
    expect(gaps).toHaveLength(1);
    expect(isCompletionSequenceActive()).toBe(false);
  });

  it('clears the pending gap timer when cancelled mid-gap', async () => {
    vi.useFakeTimers();

    // Real default wait is used here so the gap timer is actually scheduled.
    const sequence = playCompletionSequence({ enabled: true, repeatCount: 2 }, {
      playPattern: () => true,
    });

    // Flush the first pattern so the sequence parks on its gap timer.
    await Promise.resolve();
    await Promise.resolve();
    expect(isCompletionSequenceActive()).toBe(true);

    cancelActiveCompletionSequence();
    const result = await sequence;

    expect(result.reason).toBe('cancelled');
    expect(result.playedCount).toBe(1);
    expect(isCompletionSequenceActive()).toBe(false);
  });
});
