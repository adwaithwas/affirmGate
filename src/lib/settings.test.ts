import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AFFIRMATION,
  DEFAULT_AFFIRMATION_DURATION,
  DEFAULT_REMINDER,
  MAX_AFFIRMATION_LENGTH,
  MAX_REMINDER_LENGTH,
} from '../lib/constants';
import {
  DEFAULT_SETTINGS,
  isValidAffirmation,
  isValidReminder,
  normalizeAffirmationDuration,
  normalizeSettings,
  sanitizeAffirmation,
  sanitizeReminder,
} from '../lib/settings';

describe('sanitizeReminder', () => {
  it('falls back to the default for non-string values', () => {
    expect(sanitizeReminder(undefined)).toBe(DEFAULT_REMINDER);
    expect(sanitizeReminder(null)).toBe(DEFAULT_REMINDER);
    expect(sanitizeReminder(42)).toBe(DEFAULT_REMINDER);
    expect(sanitizeReminder({})).toBe(DEFAULT_REMINDER);
    expect(sanitizeReminder(['x'])).toBe(DEFAULT_REMINDER);
  });

  it('falls back to the default for empty or whitespace-only strings', () => {
    expect(sanitizeReminder('')).toBe(DEFAULT_REMINDER);
    expect(sanitizeReminder('   ')).toBe(DEFAULT_REMINDER);
    expect(sanitizeReminder('\n\t  ')).toBe(DEFAULT_REMINDER);
  });

  it('trims surrounding whitespace but preserves interior text', () => {
    expect(sanitizeReminder('  Focus on one thing.  ')).toBe(
      'Focus on one thing.',
    );
  });

  it('preserves newlines and tabs but strips other control characters', () => {
    const withControls = 'Line one\u0000\nLine two\t\u0007end';
    expect(sanitizeReminder(withControls)).toBe('Line one\nLine two\tend');
  });

  it('truncates reminders longer than the maximum length', () => {
    const long = 'a'.repeat(MAX_REMINDER_LENGTH + 250);
    const result = sanitizeReminder(long);
    expect(result).toHaveLength(MAX_REMINDER_LENGTH);
  });
});

describe('normalizeSettings', () => {
  it('returns defaults for null, undefined and primitives', () => {
    for (const value of [null, undefined, 'nope', 7, true]) {
      expect(normalizeSettings(value)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('returns defaults for an empty object', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid reminder and enabled values', () => {
    expect(normalizeSettings({ reminder: 'Breathe.', enabled: false })).toEqual({
      reminder: 'Breathe.',
      enabled: false,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
    });
  });

  it('repairs invalid fields independently', () => {
    expect(normalizeSettings({ reminder: 123, enabled: 'yes' })).toEqual({
      reminder: DEFAULT_REMINDER,
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
    });
    expect(normalizeSettings({ reminder: 'Custom', enabled: 'nope' })).toEqual({
      reminder: 'Custom',
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
    });
  });

  it('ignores unknown and extra keys', () => {
    expect(
      normalizeSettings({ reminder: 'Keep it simple', enabled: true, extra: 1 }),
    ).toEqual({
      reminder: 'Keep it simple',
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
    });
  });

  it('migrates legacy settings that predate the affirmation timer', () => {
    expect(normalizeSettings({ reminder: 'Old', enabled: true })).toEqual({
      reminder: 'Old',
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
    });
  });

  it('keeps valid affirmation and duration values', () => {
    expect(
      normalizeSettings({
        affirmation: 'I am present.',
        affirmationDuration: 90,
      }),
    ).toEqual({
      reminder: DEFAULT_REMINDER,
      enabled: true,
      affirmation: 'I am present.',
      affirmationDuration: 90,
    });
  });

  it('does not mutate the input object', () => {
    const input = { reminder: '  Hello  ', enabled: false };
    const output = normalizeSettings(input);
    expect(input.reminder).toBe('  Hello  ');
    expect(output.reminder).toBe('Hello');
  });

  it('returns a fresh object each time (defaults are not shared)', () => {
    const a = normalizeSettings(null);
    const b = normalizeSettings(null);
    expect(a).not.toBe(b);
    a.reminder = 'changed';
    expect(b.reminder).toBe(DEFAULT_REMINDER);
  });
});

describe('isValidReminder', () => {
  it('accepts non-empty strings and rejects everything else', () => {
    expect(isValidReminder('hello')).toBe(true);
    expect(isValidReminder('')).toBe(false);
    expect(isValidReminder('   ')).toBe(false);
    expect(isValidReminder(null)).toBe(false);
    expect(isValidReminder(3)).toBe(false);
  });
});

describe('sanitizeAffirmation', () => {
  it('falls back to the default for non-string and empty values', () => {
    expect(sanitizeAffirmation(undefined)).toBe(DEFAULT_AFFIRMATION);
    expect(sanitizeAffirmation(null)).toBe(DEFAULT_AFFIRMATION);
    expect(sanitizeAffirmation(42)).toBe(DEFAULT_AFFIRMATION);
    expect(sanitizeAffirmation('   ')).toBe(DEFAULT_AFFIRMATION);
  });

  it('trims and truncates like the reminder sanitizer', () => {
    expect(sanitizeAffirmation('  I am calm.  ')).toBe('I am calm.');
    expect(sanitizeAffirmation('a'.repeat(MAX_AFFIRMATION_LENGTH + 10))).toHaveLength(
      MAX_AFFIRMATION_LENGTH,
    );
  });
});

describe('normalizeAffirmationDuration', () => {
  it('keeps allowed preset durations', () => {
    for (const value of [15, 30, 60, 90, 120]) {
      expect(normalizeAffirmationDuration(value)).toBe(value);
    }
  });

  it('accepts numeric strings', () => {
    expect(normalizeAffirmationDuration('60')).toBe(60);
  });

  it('falls back to the default for anything else', () => {
    expect(normalizeAffirmationDuration(45)).toBe(DEFAULT_AFFIRMATION_DURATION);
    expect(normalizeAffirmationDuration(-5)).toBe(DEFAULT_AFFIRMATION_DURATION);
    expect(normalizeAffirmationDuration('nope')).toBe(
      DEFAULT_AFFIRMATION_DURATION,
    );
    expect(normalizeAffirmationDuration(null)).toBe(
      DEFAULT_AFFIRMATION_DURATION,
    );
    expect(normalizeAffirmationDuration(30.5)).toBe(
      DEFAULT_AFFIRMATION_DURATION,
    );
  });
});

describe('isValidAffirmation', () => {
  it('accepts non-empty strings and rejects everything else', () => {
    expect(isValidAffirmation('I am enough.')).toBe(true);
    expect(isValidAffirmation('')).toBe(false);
    expect(isValidAffirmation(null)).toBe(false);
  });
});
