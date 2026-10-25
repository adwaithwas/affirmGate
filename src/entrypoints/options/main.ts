import './style.css';
import {
  AFFIRMATION_DURATIONS,
  DEFAULT_AFFIRMATION,
  DEFAULT_AFFIRMATION_DURATION,
  DEFAULT_REMINDER,
  MAX_AFFIRMATION_LENGTH,
  MAX_REMINDER_LENGTH,
} from '@/lib/constants';
import { normalizeAffirmationDuration } from '@/lib/settings';
import { loadSettings, resetSettings, saveSettings } from '@/lib/storage';
import { formatClock } from '@/lib/timer';
import type { Settings } from '@/lib/types';

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`AffirmGate options: missing #${id}`);
  return el as T;
}

const enabledInput = requireElement<HTMLInputElement>('enabled');
const reminderInput = requireElement<HTMLTextAreaElement>('reminder');
const counterEl = requireElement<HTMLSpanElement>('counter');
const affirmationInput = requireElement<HTMLTextAreaElement>('affirmation');
const affirmationCounterEl = requireElement<HTMLSpanElement>('affirmation-counter');
const durationSelect = requireElement<HTMLSelectElement>('affirmation-duration');
const timerPreviewEl = requireElement<HTMLSpanElement>('timer-preview-text');
const previewEl = requireElement<HTMLDivElement>('preview');
const previewTextEl = requireElement<HTMLParagraphElement>('preview-text');
const previewDisabledEl = requireElement<HTMLParagraphElement>('preview-disabled');

const saveButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-save]'),
);
const resetButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-reset]'),
);
const statusEls = Array.from(
  document.querySelectorAll<HTMLElement>('[data-status]'),
);

reminderInput.maxLength = MAX_REMINDER_LENGTH;
affirmationInput.maxLength = MAX_AFFIRMATION_LENGTH;

for (const seconds of AFFIRMATION_DURATIONS) {
  const option = document.createElement('option');
  option.value = String(seconds);
  option.textContent = `${seconds} seconds`;
  durationSelect.append(option);
}

function showStatus(message: string, tone: 'info' | 'error' = 'info'): void {
  for (const el of statusEls) {
    el.textContent = message;
    el.dataset.tone = tone;
  }
}

function updateReminderCounter(): void {
  counterEl.textContent = `${reminderInput.value.length} / ${MAX_REMINDER_LENGTH} characters`;
}

function updateAffirmationCounter(): void {
  affirmationCounterEl.textContent = `${affirmationInput.value.length} / ${MAX_AFFIRMATION_LENGTH} characters`;
}

function updateTimerPreview(): void {
  const seconds = normalizeAffirmationDuration(durationSelect.value);
  timerPreviewEl.textContent = formatClock(seconds);
}

function updatePreview(): void {
  const enabled = enabledInput.checked;
  const text = reminderInput.value.trim();

  previewEl.hidden = !enabled;
  previewDisabledEl.hidden = enabled;
  previewTextEl.textContent = text.length > 0 ? text : DEFAULT_REMINDER;
}

function readForm(): Settings {
  return {
    reminder: reminderInput.value.trim(),
    enabled: enabledInput.checked,
    affirmation: affirmationInput.value.trim(),
    affirmationDuration: normalizeAffirmationDuration(durationSelect.value),
  };
}

function applySettingsToForm(settings: Settings): void {
  enabledInput.checked = settings.enabled;
  reminderInput.value = settings.reminder;
  affirmationInput.value = settings.affirmation;
  durationSelect.value = String(settings.affirmationDuration);
  updateReminderCounter();
  updateAffirmationCounter();
  updateTimerPreview();
  updatePreview();
}

reminderInput.addEventListener('input', () => {
  updateReminderCounter();
  updatePreview();
  showStatus('');
});

affirmationInput.addEventListener('input', () => {
  updateAffirmationCounter();
  showStatus('');
});

durationSelect.addEventListener('change', () => {
  updateTimerPreview();
  showStatus('');
});

enabledInput.addEventListener('change', () => {
  updatePreview();
  showStatus('');
});

async function save(): Promise<void> {
  for (const button of saveButtons) button.disabled = true;
  try {
    const raw = readForm();
    const saved = await saveSettings(raw);
    applySettingsToForm(saved);

    if (raw.reminder.length === 0 && raw.affirmation.length === 0) {
      showStatus(
        'Empty fields were replaced with the defaults. Edit and save again to customize.',
      );
    } else if (raw.reminder.length === 0) {
      showStatus('The reminder cannot be empty, so the default was restored.');
    } else if (raw.affirmation.length === 0) {
      showStatus(
        'The affirmation cannot be empty, so the default was restored.',
      );
    } else {
      showStatus('Saved. It will appear the next time you open YouTube.');
    }
  } catch (error) {
    console.error('[AffirmGate] Failed to save settings', error);
    showStatus('Could not save. Please try again.', 'error');
  } finally {
    for (const button of saveButtons) button.disabled = false;
  }
}

async function reset(): Promise<void> {
  for (const button of resetButtons) button.disabled = true;
  try {
    const restored = await resetSettings();
    applySettingsToForm(restored);
    showStatus('Reset to the default reminder and affirmation.');
  } catch (error) {
    console.error('[AffirmGate] Failed to reset settings', error);
    showStatus('Could not reset. Please try again.', 'error');
  } finally {
    for (const button of resetButtons) button.disabled = false;
  }
}

for (const button of saveButtons) {
  button.addEventListener('click', () => void save());
}

for (const button of resetButtons) {
  button.addEventListener('click', () => void reset());
}

void (async () => {
  try {
    applySettingsToForm(await loadSettings());
  } catch (error) {
    console.error('[AffirmGate] Failed to load settings', error);
    applySettingsToForm({
      reminder: DEFAULT_REMINDER,
      enabled: true,
      affirmation: DEFAULT_AFFIRMATION,
      affirmationDuration: DEFAULT_AFFIRMATION_DURATION,
    });
    showStatus('Could not load saved settings; showing defaults.', 'error');
  }
})();
