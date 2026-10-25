/** User-facing settings persisted in `storage.local`. */
export interface Settings {
  /** The user's personal reminder text shown on the gate. */
  reminder: string;
  /** Whether the gate is active. When false, no overlay is shown. */
  enabled: boolean;
  /** The affirmation shown and repeated on the affirmation timer page. */
  affirmation: string;
  /** Countdown duration (in seconds) for the affirmation timer. */
  affirmationDuration: number;
  /** Whether the timer completion sound is enabled. */
  timerSoundEnabled: boolean;
  /** Volume for the timer completion sound (0-1). */
  timerSoundVolume: number;
  /** How many times the completion sound pattern repeats (1-5). */
  completionSoundRepeatCount: number;
}

/** Result of asking the background to close the current tab. */
export type CloseTabResponse =
  | { ok: true }
  | { ok: false; reason: string };

/** Runtime message sent from the content script to the background. */
export interface CloseTabRequest {
  type: 'affirmgate:close-tab';
}

/** Runtime message asking the background to open the affirmation timer. */
export interface AffirmRequest {
  type: 'affirmgate:affirm';
}

/**
 * Result of the affirm flow:
 *  - `{ ok: true, closed }` — the timer tab opened; `closed` reports whether the
 *    source YouTube tab was also closed.
 *  - `{ ok: false }` — the timer tab could not be created (or no tab was
 *    available), so the caller must use its safe fallback.
 */
export type AffirmResponse =
  | { ok: true; closed: boolean }
  | { ok: false; reason: string };

/** Mutable bookkeeping state for YouTube's single-page navigation stream. */
export interface NavigationState {
  /** The route key of the most recently processed navigation. */
  lastKey: string | null;
  /** Increments once per distinct navigation. */
  token: number;
}
