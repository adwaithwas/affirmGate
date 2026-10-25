import './style.css';
import {
  DEFAULT_AFFIRMATION,
  DEFAULT_AFFIRMATION_DURATION,
} from '@/lib/constants';
import { requestCloseTab } from '@/lib/messages';
import { loadSettings, watchSettings } from '@/lib/storage';
import {
  cancelActiveCompletionSequence,
  ensureAudioReady,
  playCompletionSequence,
} from '@/lib/timer-sound';
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
let completionSoundPlayed = false;
let audioInitialized = false;
let audioStatusEl: HTMLParagraphElement | null = null;
let unwatchSettings: (() => void) | null = null;

function stopInterval(): void {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function createAudioStatusElement(): void {
  if (audioStatusEl) return;
  audioStatusEl = document.createElement('p');
  audioStatusEl.className = 'status';
  audioStatusEl.style.marginTop = '1rem';
  audioStatusEl.style.fontSize = '0.875rem';
  audioStatusEl.style.color = 'var(--muted)';
  const completeDiv = completeEl;
  completeDiv.parentElement?.insertBefore(audioStatusEl, completeDiv.nextSibling);
}

function updateAudioStatus(message: string): void {
  createAudioStatusElement();
  if (audioStatusEl) {
    audioStatusEl.textContent = message;
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

async function startSession(durationSeconds: number): Promise<void> {
  stopInterval();
  completeEl.hidden = true;
  completionSoundPlayed = false;
  if (audioStatusEl) audioStatusEl.textContent = '';
  clockEl.textContent = formatClock(durationSeconds);
  ringEl.style.setProperty('--progress', '0');
  captionEl.textContent = 'Breathe. Read it slowly.';

  // Deadline-based: every value is derived from the deadline vs. `Date.now()`,
  // so throttled timers can never drift the countdown.
  session = createSession(durationSeconds, Date.now());
  render();

  intervalId = window.setInterval(render, UPDATE_INTERVAL_MS);
}

async function finish(): Promise<void> {
  stopInterval();
  session = null;
  clockEl.textContent = '0:00';
  ringEl.style.setProperty('--progress', '1');
  captionEl.textContent = '';
  completeEl.hidden = false;
  repeatButton.focus();

  // Play exactly one sequence per completed session (repeat-session resets
  // this flag when the next session starts).
  if (!completionSoundPlayed && settings) {
    completionSoundPlayed = true;
    if (settings.timerSoundEnabled) {
      try {
        const result = await playCompletionSequence({
          enabled: settings.timerSoundEnabled,
          volume: settings.timerSoundVolume,
          repeatCount: settings.completionSoundRepeatCount,
        });
        if (!result.ok && result.reason !== 'cancelled') {
          updateAudioStatus('Sound could not play (browser may have blocked autoplay).');
        }
      } catch (error) {
        console.error('[AffirmGate] Failed to play completion sound', error);
        updateAudioStatus('Sound playback failed.');
      }
    }
  }
}

function showStatus(message: string, tone: 'info' | 'error' = 'info'): void {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

repeatButton.addEventListener('click', () => {
  if (!settings) return;
  showStatus('');
  void startSession(settings.affirmationDuration);
});

doneButton.addEventListener('click', () => {
  void (async () => {
    doneButton.disabled = true;
    showStatus('Closing...');
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

window.addEventListener('beforeunload', () => {
  stopInterval();
  cancelActiveCompletionSequence();
  if (unwatchSettings) {
    unwatchSettings();
    unwatchSettings = null;
  }
});

void (async () => {
  try {
    settings = await loadSettings();
  } catch (error) {
    console.error('[AffirmGate] Failed to load settings', error);
  }

  // Keep settings in sync while this tab stays open, so a saved change (e.g.
  // the repetition count) is used by the next completion in this session.
  try {
    unwatchSettings = watchSettings((updated) => {
      settings = updated;
    });
  } catch (error) {
    console.warn('[AffirmGate] Could not watch settings changes', error);
  }

  affirmationEl.textContent = settings?.affirmation ?? DEFAULT_AFFIRMATION;

  try {
    await ensureAudioReady();
    audioInitialized = true;
  } catch {
    audioInitialized = false;
  }

  const duration = settings?.affirmationDuration ?? DEFAULT_AFFIRMATION_DURATION;
  void startSession(duration);
})();
