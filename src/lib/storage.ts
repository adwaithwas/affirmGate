import { storage } from 'wxt/utils/storage';
import { SETTINGS_STORAGE_KEY } from './constants';
import { normalizeSettings } from './settings';
import type { Settings } from './types';

/**
 * Loads settings from `storage.local`.
 *
 * Any missing, corrupt or unexpected value is normalized to safe defaults, so
 * this function never rejects because of bad stored data.
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await storage.getItem<unknown>(SETTINGS_STORAGE_KEY);
    return normalizeSettings(raw);
  } catch (error) {
    console.warn('[AffirmGate] Could not read settings; using defaults.', error);
    return normalizeSettings(null);
  }
}

/** Normalizes and persists settings. Returns the value that was written. */
export async function saveSettings(input: Settings): Promise<Settings> {
  const settings = normalizeSettings(input);
  await storage.setItem(SETTINGS_STORAGE_KEY, settings);
  return settings;
}

/** Restores and persists the built-in defaults. */
export async function resetSettings(): Promise<Settings> {
  return saveSettings(normalizeSettings(null));
}

/** Subscribes to settings changes. Returns an unsubscribe function. */
export function watchSettings(callback: (settings: Settings) => void): () => void {
  return storage.watch<unknown>(SETTINGS_STORAGE_KEY, (newValue) => {
    callback(normalizeSettings(newValue));
  });
}
