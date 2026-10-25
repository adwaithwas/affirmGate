/**
 * Local audio generation for timer completion notification using Web Audio API.
 * Creates a short, subtle, two-pulse notification sound without external files.
 */

import { COMPLETION_SOUND_REPEAT_GAP_MS } from './constants';
import { normalizeCompletionSoundRepeatCount } from './settings';

export interface TimerSoundOptions {
  volume?: number;
  enabled?: boolean;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContext) {
    try {
      audioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }

  return audioContext;
}

export async function ensureAudioReady(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }

  return ctx.state === 'running' || ctx.state === 'closed' ? ctx.state === 'running' : false;
}

export async function playTimerCompletionSound(
  options: TimerSoundOptions = {},
): Promise<boolean> {
  const enabled = options.enabled !== false;
  const volume = Math.max(0, Math.min(1, options.volume ?? 0.3));

  if (!enabled) return true;

  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    if (ctx.state !== 'running') {
      return false;
    }

    const now = ctx.currentTime;

    // Create a subtle two-pulse sound
    const playPulse = (startTime: number, frequency: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      // Smooth envelope - quick attack, gentle decay
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.15);
    };

    // Two gentle pulses with slightly different frequencies
    playPulse(now, 880); // A5
    playPulse(now + 0.12, 1046.5); // C6

    return true;
  } catch {
    return false;
  }
}

export function canPlayAudio(): boolean {
  return getAudioContext() !== null;
}

/**
 * Repeated completion-sequence playback.
 *
 * A "pattern" is one call to the existing buzzer (which itself may contain
 * several tones). The sequence plays the complete pattern `repeatCount` times
 * with a short gap in between, and only one sequence may run at a time.
 */
export interface CompletionSequenceOptions extends TimerSoundOptions {
  /** How many times the complete pattern plays (1-5). Defaults to 3. */
  repeatCount?: number;
}

export interface CompletionSequenceResult {
  /** True when the sequence finished normally (or the sound was disabled). */
  ok: boolean;
  /** Number of complete patterns that were actually played. */
  playedCount: number;
  /** Set when the sound is disabled: nothing was played, by design. */
  disabled?: boolean;
  /** Why the sequence stopped early, when `ok` is false. */
  reason?: 'busy' | 'blocked' | 'cancelled' | 'error';
}

/** Injectable dependencies so sequencing can be unit-tested without audio. */
export interface CompletionSequenceDeps {
  /** Plays one complete pattern. Defaults to `playTimerCompletionSound`. */
  playPattern?: () => boolean | Promise<boolean>;
  /** Waits between patterns. Defaults to a cancellable timeout. */
  wait?: (ms: number) => boolean | Promise<boolean>;
}

interface SequenceToken {
  cancelled: boolean;
}

let activeSequence: SequenceToken | null = null;
let gapTimerId: ReturnType<typeof setTimeout> | null = null;
let gapResolve: (() => void) | null = null;

/** True while a completion sequence is currently playing. */
export function isCompletionSequenceActive(): boolean {
  return activeSequence !== null;
}

/**
 * Cancels any in-flight completion sequence (e.g. on page unload) and clears
 * the pending gap timer. No-op when nothing is playing.
 */
export function cancelActiveCompletionSequence(): void {
  if (activeSequence) {
    activeSequence.cancelled = true;
  }
  if (gapTimerId !== null) {
    clearTimeout(gapTimerId);
    gapTimerId = null;
  }
  if (gapResolve) {
    const resolve = gapResolve;
    gapResolve = null;
    resolve();
  }
}

function defaultWait(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    gapTimerId = setTimeout(() => {
      gapTimerId = null;
      gapResolve = null;
      resolve(true);
    }, ms);
    gapResolve = () => resolve(false);
  });
}

/**
 * Plays the complete notification pattern `repeatCount` times, separated by
 * `COMPLETION_SOUND_REPEAT_GAP_MS` gaps.
 *
 * - Respects the enabled/volume preferences like the single-pattern player.
 * - Only one sequence can run at a time; concurrent calls return `busy`
 *   without playing, so rapid Test Sound clicks cannot overlap.
 * - Stops cleanly when cancelled (page unload) or when a pattern fails, and
 *   always releases its "active" slot, so audio errors can never wedge it.
 */
export async function playCompletionSequence(
  options: CompletionSequenceOptions = {},
  deps: CompletionSequenceDeps = {},
): Promise<CompletionSequenceResult> {
  const enabled = options.enabled !== false;

  if (!enabled) {
    return { ok: true, playedCount: 0, disabled: true };
  }

  if (activeSequence) {
    return { ok: false, playedCount: 0, reason: 'busy' };
  }

  const token: SequenceToken = { cancelled: false };
  activeSequence = token;

  const playPattern =
    deps.playPattern ?? ((): Promise<boolean> => playTimerCompletionSound(options));
  const wait = deps.wait ?? defaultWait;

  // Normalized once, before any audio work, so a bad value can never affect
  // playback.
  const repeatCount = normalizeCompletionSoundRepeatCount(options.repeatCount);

  let playedCount = 0;
  try {
    for (let i = 0; i < repeatCount; i++) {
      if (token.cancelled) break;

      const patternOk = await playPattern();
      if (!patternOk) {
        return {
          ok: false,
          playedCount,
          reason: token.cancelled ? 'cancelled' : 'blocked',
        };
      }
      playedCount += 1;

      // Gap only between patterns, never after the last one.
      if (i < repeatCount - 1 && !token.cancelled) {
        const resumed = await wait(COMPLETION_SOUND_REPEAT_GAP_MS);
        if (resumed === false || token.cancelled) break;
      }
    }
  } catch (error) {
    console.error('[AffirmGate] Completion sound sequence failed', error);
    return { ok: false, playedCount, reason: 'error' };
  } finally {
    if (activeSequence === token) {
      activeSequence = null;
    }
  }

  if (token.cancelled) {
    return { ok: false, playedCount, reason: 'cancelled' };
  }
  return { ok: true, playedCount };
}
