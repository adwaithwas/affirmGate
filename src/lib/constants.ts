/**
 * Shared, app-wide constants.
 *
 * NOTE: personal reminder text is NEVER hardcoded here. The value below is only
 * a generic first-run default; the user's own text is stored in
 * `storage.local` at runtime.
 */

/** Generic default reminder shown until the user configures their own. */
export const DEFAULT_REMINDER =
  'Pause. Is this important? Or would you rather focus on what really matters to you?';

/** Hard upper bound for the reminder, to keep the overlay readable. */
export const MAX_REMINDER_LENGTH = 500;

/** Generic default affirmation for the affirmation timer. */
export const DEFAULT_AFFIRMATION =
  'I am becoming the person I have chosen to be. My attention belongs to what matters to me.';

/** Hard upper bound for the affirmation, to keep the timer page readable. */
export const MAX_AFFIRMATION_LENGTH = 500;

/** Allowed countdown durations (in seconds) for the affirmation timer. */
export const AFFIRMATION_DURATIONS = [15, 30, 60, 90, 120] as const;

/** Default countdown duration (in seconds). */
export const DEFAULT_AFFIRMATION_DURATION = 30;

/** Storage key for the user's settings (WXT namespaced key: area + name). */
export const SETTINGS_STORAGE_KEY = 'local:settings';

/** Runtime message used to ask the background to close the current tab. */
export const CLOSE_TAB_MESSAGE = 'affirmgate:close-tab';

/** Runtime message used to open the affirmation timer page. */
export const AFFIRM_MESSAGE = 'affirmgate:affirm';

/** Path (relative to the extension root) of the affirmation timer page. */
export const TIMER_PAGE_PATH = '/timer.html';

/** DOM id of the injected overlay host element. */
export const OVERLAY_HOST_ID = 'affirmgate-gate';

/** Attribute used to find the injected host, even if the id is changed. */
export const OVERLAY_HOST_ATTRIBUTE = 'data-affirmgate-host';

/** Interval (ms) for the URL polling fallback used to detect SPA navigation. */
export const NAVIGATION_POLL_INTERVAL = 400;
