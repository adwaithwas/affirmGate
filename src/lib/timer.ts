/**
 * Pure helpers for the affirmation-timer countdown.
 *
 * The countdown is deadline-based: a session stores an absolute deadline and
 * every visible value is derived from `now` vs. that deadline. This keeps the
 * display accurate even when browser timer callbacks are throttled or delayed,
 * and it never relies on decrementing a counter.
 */

export interface TimerSession {
  /** Total duration of the session in milliseconds. */
  totalMs: number;
  /** Absolute timestamp (ms, e.g. `Date.now()`) when the session ends. */
  deadlineMs: number;
}

/** Creates a new session lasting `durationSeconds`, starting at `nowMs`. */
export function createSession(
  durationSeconds: number,
  nowMs: number,
): TimerSession {
  const safeSeconds = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds)
    : 0;
  const totalMs = safeSeconds * 1000;
  return { totalMs, deadlineMs: nowMs + totalMs };
}

/** Milliseconds remaining in the session at `nowMs` (never negative). */
export function remainingMs(session: TimerSession, nowMs: number): number {
  return Math.max(0, session.deadlineMs - nowMs);
}

/** Whole seconds remaining, rounded up, so it shows "1" until truly finished. */
export function remainingSeconds(session: TimerSession, nowMs: number): number {
  return Math.ceil(remainingMs(session, nowMs) / 1000);
}

/** True once the session has reached zero. */
export function isComplete(session: TimerSession, nowMs: number): boolean {
  return remainingMs(session, nowMs) <= 0;
}

/**
 * Fraction of the session that has elapsed, clamped to `[0, 1]`.
 * `0` at the start, `1` at completion. Ideal for a progress indicator.
 */
export function progressFraction(session: TimerSession, nowMs: number): number {
  if (session.totalMs <= 0) return 1;
  const elapsed = session.totalMs - remainingMs(session, nowMs);
  return clamp(elapsed / session.totalMs, 0, 1);
}

/** Formats whole seconds as `M:SS` (e.g. 90 -> "1:30"). */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
