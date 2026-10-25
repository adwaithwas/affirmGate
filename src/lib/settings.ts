import {
  AFFIRMATION_DURATIONS,
  DEFAULT_AFFIRMATION,
  DEFAULT_AFFIRMATION_DURATION,
  DEFAULT_REMINDER,
  MAX_AFFIRMATION_LENGTH,
  MAX_REMINDER_LENGTH,
} from './constants';
import type { Settings } from './types';

/** Immutable defaults used when nothing valid has been stored yet. */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  reminder: DEFAULT_REMINDER,
  enabled: true,
  affirmation: DEFAULT_AFFIRMATION,
  affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
});

/** Returns a detached copy of the default settings. */
export function getDefaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS };
}

/**
 * Normalizes arbitrary text into a safe string.
 *
 * - Non-strings fall back to the provided default.
 * - Control characters are stripped (newlines and tabs are preserved).
 * - Leading/trailing whitespace is trimmed.
 * - Empty or whitespace-only strings fall back to the default.
 * - Over-long strings are truncated to `maxLength`.
 */
function sanitizeText(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') return fallback;

  const withoutControlChars = value
    .replace(/\r\n?/g, '\n')
    // Keep \t (0x09) and \n (0x0A); strip other C0/C1 controls and DEL.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  const trimmed = withoutControlChars.trim();
  if (trimmed.length === 0) return fallback;

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * Normalizes an arbitrary reminder value into a safe string. See
 * {@link sanitizeText} for the rules.
 */
export function sanitizeReminder(value: unknown): string {
  return sanitizeText(value, DEFAULT_REMINDER, MAX_REMINDER_LENGTH);
}

/**
 * Normalizes an arbitrary affirmation value into a safe string. Uses the same
 * rules as {@link sanitizeReminder} but with the affirmation default/limit.
 */
export function sanitizeAffirmation(value: unknown): string {
  return sanitizeText(value, DEFAULT_AFFIRMATION, MAX_AFFIRMATION_LENGTH);
}

/** True when the value is one of the allowed timer durations. */
export function isAllowedAffirmationDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (AFFIRMATION_DURATIONS as readonly number[]).includes(value)
  );
}

/**
 * Normalizes an arbitrary duration value to one of the allowed presets.
 *
 * Accepts numbers and numeric strings (so older/corrupt stored values still
 * migrate cleanly); anything else falls back to the default duration.
 */
export function normalizeAffirmationDuration(value: unknown): number {
  if (isAllowedAffirmationDuration(value)) return value;

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (isAllowedAffirmationDuration(parsed)) return parsed;
  }

  return DEFAULT_AFFIRMATION_DURATION;
}

/**
 * Turns any stored/unknown value into a valid {@link Settings} object.
 *
 * Handles missing values, wrong types, corrupt objects and extra keys without
 * ever throwing, so a bad stored value can never break the extension.
 *
 * This is also the migration path: settings saved by older versions (which only
 * contained `reminder` and `enabled`) are upgraded by filling the new fields
 * with their defaults, without losing any existing preference.
 */
export function normalizeSettings(raw: unknown): Settings {
  if (raw === null || typeof raw !== 'object') {
    return getDefaultSettings();
  }

  const record = raw as Record<string, unknown>;

  return {
    reminder: sanitizeReminder(record.reminder),
    enabled:
      typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_SETTINGS.enabled,
    affirmation: sanitizeAffirmation(record.affirmation),
    affirmationDuration: normalizeAffirmationDuration(record.affirmationDuration),
  };
}

/** True when the value is a non-empty reminder string. */
export function isValidReminder(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True when the value is a non-empty affirmation string. */
export function isValidAffirmation(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
