import { describe, expect, it } from 'vitest';
import {
  COMPLETION_SOUND_REPEAT_COUNTS,
  DEFAULT_AFFIRMATION,
  DEFAULT_AFFIRMATION_DURATION,
  DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
  DEFAULT_REMINDER,
  DEFAULT_TIMER_SOUND_ENABLED,
  DEFAULT_TIMER_SOUND_VOLUME,
  MAX_AFFIRMATION_LENGTH,
  MAX_COMPLETION_SOUND_REPEAT_COUNT,
  MAX_REMINDER_LENGTH,
  MIN_COMPLETION_SOUND_REPEAT_COUNT,
} from '../lib/constants';
import {
  DEFAULT_SETTINGS,
  isValidAffirmation,
  isValidReminder,
  normalizeAffirmationDuration,
  normalizeCompletionSoundRepeatCount,
  normalizeSettings,
  normalizeTimerSoundVolume,
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
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: DEFAULT_TIMER_SOUND_VOLUME,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    });
  });

  it('repairs invalid fields independently', () => {
    expect(normalizeSettings({ reminder: 123, enabled: 'yes' })).toEqual({
      reminder: DEFAULT_REMINDER,
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: DEFAULT_TIMER_SOUND_VOLUME,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    });
    expect(normalizeSettings({ reminder: 'Custom', enabled: 'nope' })).toEqual({
      reminder: 'Custom',
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: DEFAULT_TIMER_SOUND_VOLUME,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
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
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: DEFAULT_TIMER_SOUND_VOLUME,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    });
  });

  it('migrates legacy settings that predate the affirmation timer', () => {
    expect(normalizeSettings({ reminder: 'Old', enabled: true })).toEqual({
      reminder: 'Old',
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: DEFAULT_TIMER_SOUND_VOLUME,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
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
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: DEFAULT_TIMER_SOUND_VOLUME,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
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

describe('normalizeTimerSoundVolume', () => {
  it('clamps volume to valid range', () => {
    expect(normalizeTimerSoundVolume(0)).toBe(0);
    expect(normalizeTimerSoundVolume(0.5)).toBe(0.5);
    expect(normalizeTimerSoundVolume(1)).toBe(1);
    expect(normalizeTimerSoundVolume(-0.1)).toBe(0);
    expect(normalizeTimerSoundVolume(1.5)).toBe(1);
  });

  it('falls back to default for invalid values', () => {
    expect(normalizeTimerSoundVolume(null)).toBe(DEFAULT_TIMER_SOUND_VOLUME);
    expect(normalizeTimerSoundVolume(undefined)).toBe(DEFAULT_TIMER_SOUND_VOLUME);
    expect(normalizeTimerSoundVolume('0.5')).toBe(DEFAULT_TIMER_SOUND_VOLUME);
    expect(normalizeTimerSoundVolume(Number.NaN)).toBe(DEFAULT_TIMER_SOUND_VOLUME);
  });
});

describe('normalizeSettings with timer sound', () => {
  it('keeps valid timer sound settings', () => {
    expect(
      normalizeSettings({
        timerSoundEnabled: false,
        timerSoundVolume: 0.8,
      }),
    ).toEqual({
      reminder: DEFAULT_REMINDER,
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
      timerSoundEnabled: false,
      timerSoundVolume: 0.8,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    });
  });

  it('normalizes invalid timer sound settings', () => {
    expect(
      normalizeSettings({
        timerSoundEnabled: 'yes',
        timerSoundVolume: 2,
      }),
    ).toEqual({
      reminder: DEFAULT_REMINDER,
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: 1,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    });
  });

  it('migrates old settings without timer sound fields', () => {
    expect(normalizeSettings({ reminder: 'Old', enabled: false })).toEqual({
      reminder: 'Old',
      enabled: false,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
      timerSoundEnabled: DEFAULT_TIMER_SOUND_ENABLED,
      timerSoundVolume: DEFAULT_TIMER_SOUND_VOLUME,
      completionSoundRepeatCount: DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    });
  });
});

describe('completion sound repeat count defaults', () => {
  it('defaults to 3 and allows only 1-5', () => {
    expect(DEFAULT_COMPLETION_SOUND_REPEAT_COUNT).toBe(3);
    expect([...COMPLETION_SOUND_REPEAT_COUNTS]).toEqual([1, 2, 3, 4, 5]);
    expect(MIN_COMPLETION_SOUND_REPEAT_COUNT).toBe(1);
    expect(MAX_COMPLETION_SOUND_REPEAT_COUNT).toBe(5);
    expect(DEFAULT_SETTINGS.completionSoundRepeatCount).toBe(3);
  });
});

describe('normalizeCompletionSoundRepeatCount', () => {
  it('keeps the allowed values 1-5', () => {
    for (const value of [1, 2, 3, 4, 5]) {
      expect(normalizeCompletionSoundRepeatCount(value)).toBe(value);
    }
  });

  it('accepts numeric strings', () => {
    expect(normalizeCompletionSoundRepeatCount('4')).toBe(4);
    expect(normalizeCompletionSoundRepeatCount(' 1 ')).toBe(1);
  });

  it('clamps out-of-range numbers into 1-5', () => {
    expect(normalizeCompletionSoundRepeatCount(0)).toBe(1);
    expect(normalizeCompletionSoundRepeatCount(-3)).toBe(1);
    expect(normalizeCompletionSoundRepeatCount(7)).toBe(5);
    expect(normalizeCompletionSoundRepeatCount(999)).toBe(5);
    expect(normalizeCompletionSoundRepeatCount('7')).toBe(5);
  });

  it('rounds fractional numbers to an integer in range', () => {
    expect(normalizeCompletionSoundRepeatCount(2.6)).toBe(3);
    expect(normalizeCompletionSoundRepeatCount(0.4)).toBe(1);
    expect(normalizeCompletionSoundRepeatCount(5.4)).toBe(5);
  });

  it('falls back to the default for missing or malformed values', () => {
    expect(normalizeCompletionSoundRepeatCount(undefined)).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(normalizeCompletionSoundRepeatCount(null)).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(normalizeCompletionSoundRepeatCount('many')).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(normalizeCompletionSoundRepeatCount(Number.NaN)).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(normalizeCompletionSoundRepeatCount(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(normalizeCompletionSoundRepeatCount({})).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(normalizeCompletionSoundRepeatCount(true)).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
  });
});

describe('normalizeSettings with completion sound repeat count', () => {
  it('keeps a valid stored repeat count', () => {
    const result = normalizeSettings({ completionSoundRepeatCount: 5 });
    expect(result.completionSoundRepeatCount).toBe(5);
    expect(result.reminder).toBe(DEFAULT_REMINDER);
    expect(result.enabled).toBe(true);
    expect(result.affirmation).toBe(DEFAULT_AFFIRMATION);
    expect(result.affirmationDuration).toBe(DEFAULT_AFFIRMATION_DURATION);
    expect(result.timerSoundEnabled).toBe(DEFAULT_TIMER_SOUND_ENABLED);
    expect(result.timerSoundVolume).toBe(DEFAULT_TIMER_SOUND_VOLUME);
  });

  it('repairs an invalid stored repeat count without touching other fields', () => {
    const result = normalizeSettings({
      reminder: 'Keep me',
      enabled: false,
      affirmation: 'Keep me too',
      affirmationDuration: 90,
      timerSoundEnabled: false,
      timerSoundVolume: 0.7,
      completionSoundRepeatCount: 'lots',
    });
    expect(result.completionSoundRepeatCount).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(result.reminder).toBe('Keep me');
    expect(result.enabled).toBe(false);
    expect(result.affirmation).toBe('Keep me too');
    expect(result.affirmationDuration).toBe(90);
    expect(result.timerSoundEnabled).toBe(false);
    expect(result.timerSoundVolume).toBe(0.7);
  });

  it('migrates settings saved before the repeat count existed', () => {
    const result = normalizeSettings({
      reminder: 'Old reminder',
      enabled: true,
      affirmation: 'Old affirmation',
      affirmationDuration: 60,
      timerSoundEnabled: false,
      timerSoundVolume: 0.5,
    });
    expect(result.completionSoundRepeatCount).toBe(
      DEFAULT_COMPLETION_SOUND_REPEAT_COUNT,
    );
    expect(result.reminder).toBe('Old reminder');
    expect(result.affirmation).toBe('Old affirmation');
    expect(result.affirmationDuration).toBe(60);
    expect(result.timerSoundEnabled).toBe(false);
    expect(result.timerSoundVolume).toBe(0.5);
  });
});
