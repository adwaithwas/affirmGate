import './style.css';
import {
  DEFAULT_AFFIRMATION,
  DEFAULT_AFFIRMATION_DURATION,
} from '@/lib/constants';
import { requestCloseTab } from '@/lib/messages';
import { loadSettings } from '@/lib/storage';
import {
  createSession,
  formatClock,
  isComplete,
  progressFraction,
  remainingSeconds,
  type TimerSession,
} from '@/lib/timer';
import type { Settings } from '@/lib/types';

const UPDATE_INTERVAL_MS = 200;

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`AffirmGate timer: missing #${id}`);
  return el as T;
}

const affirmationEl = requireElement<HTMLParagraphElement>('affirmation');
const ringEl = requireElement<HTMLDivElement>('ring');
const clockEl = requireElement<HTMLSpanElement>('clock');
const captionEl = requireElement<HTMLParagraphElement>('caption');
const completeEl = requireElement<HTMLDivElement>('complete');
const repeatButton = requireElement<HTMLButtonElement>('repeat');
const doneButton = requireElement<HTMLButtonElement>('done');
const statusEl = requireElement<HTMLParagraphElement>('status');

let settings: Settings | null = null;
let session: TimerSession | null = null;
let intervalId: number | null = null;

function stopInterval(): void {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function render(): void {
  if (!session) return;

  const now = Date.now();

  if (isComplete(session, now)) {
    finish();
    return;
  }

  clockEl.textContent = formatClock(remainingSeconds(session, now));
  ringEl.style.setProperty('--progress', String(progressFraction(session, now)));
}

function startSession(durationSeconds: number): void {
  stopInterval();
  completeEl.hidden = true;
  clockEl.textContent = formatClock(durationSeconds);
  ringEl.style.setProperty('--progress', '0');
  captionEl.textContent = 'Breathe. Read it slowly.';

  // Deadline-based: every value is derived from the deadline vs. `Date.now()`,
  // so throttled timers can never drift the countdown.
  session = createSession(durationSeconds, Date.now());
  render();

  intervalId = window.setInterval(render, UPDATE_INTERVAL_MS);
}

function finish(): void {
  stopInterval();
  session = null;
  clockEl.textContent = '0:00';
  ringEl.style.setProperty('--progress', '1');
  captionEl.textContent = '';
  completeEl.hidden = false;
  repeatButton.focus();
}

function showStatus(message: string, tone: 'info' | 'error' = 'info'): void {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

repeatButton.addEventListener('click', () => {
  if (!settings) return;
  showStatus('');
  startSession(settings.affirmationDuration);
});

doneButton.addEventListener('click', () => {
  void (async () => {
    doneButton.disabled = true;
    showStatus('Closing…');
    const result = await requestCloseTab();
    if (!result.ok) {
      doneButton.disabled = false;
      showStatus('This tab could not be closed automatically — you can close it manually.', 'error');
    }
  })();
});

// On return to the tab, refresh immediately (deadline-based, so it is accurate).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

window.addEventListener('beforeunload', stopInterval);

void (async () => {
  try {
    settings = await loadSettings();
  } catch (error) {
    console.error('[AffirmGate] Failed to load settings', error);
  }

  affirmationEl.textContent = settings?.affirmation ?? DEFAULT_AFFIRMATION;

  const duration = settings?.affirmationDuration ?? DEFAULT_AFFIRMATION_DURATION;
  startSession(duration);
})();
