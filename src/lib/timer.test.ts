import { describe, expect, it } from 'vitest';
import {
  createSession,
  formatClock,
  isComplete,
  progressFraction,
  remainingMs,
  remainingSeconds,
} from '../lib/timer';

describe('createSession', () => {
  it('sets the deadline relative to the start time', () => {
    const session = createSession(30, 1000);
    expect(session.totalMs).toBe(30_000);
    expect(session.deadlineMs).toBe(31_000);
  });

  it('treats invalid or negative durations as zero', () => {
    expect(createSession(Number.NaN, 0).totalMs).toBe(0);
    expect(createSession(-10, 0).totalMs).toBe(0);
  });
});

describe('remaining values', () => {
  const session = createSession(30, 1000);

  it('reports the remaining time until the deadline', () => {
    expect(remainingMs(session, 1000)).toBe(30_000);
    expect(remainingMs(session, 11_000)).toBe(20_000);
    expect(remainingMs(session, 99_000)).toBe(0);
  });

  it('rounds seconds up so 1 is shown until truly finished', () => {
    expect(remainingSeconds(session, 1000)).toBe(30);
    expect(remainingSeconds(session, 30_000)).toBe(1);
    expect(remainingSeconds(session, 30_999)).toBe(1);
    expect(remainingSeconds(session, 31_000)).toBe(0);
  });
});

describe('isComplete', () => {
  const session = createSession(30, 1000);

  it('is false before the deadline and true at/after it', () => {
    expect(isComplete(session, 30_999)).toBe(false);
    expect(isComplete(session, 31_000)).toBe(true);
    expect(isComplete(session, 40_000)).toBe(true);
  });
});

describe('progressFraction', () => {
  const session = createSession(30, 1000);

  it('goes from 0 to 1 and is clamped', () => {
    expect(progressFraction(session, 1000)).toBe(0);
    expect(progressFraction(session, 16_000)).toBeCloseTo(0.5);
    expect(progressFraction(session, 31_000)).toBe(1);
    expect(progressFraction(session, 50_000)).toBe(1);
  });

  it('is 1 for a zero-length session', () => {
    expect(progressFraction(createSession(0, 0), 0)).toBe(1);
  });
});

describe('formatClock', () => {
  it('formats seconds as M:SS', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(120)).toBe('2:00');
  });

  it('floors fractional and guards invalid input', () => {
    expect(formatClock(59.9)).toBe('0:59');
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-10)).toBe('0:00');
  });
});
