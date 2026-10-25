import { browser } from 'wxt/browser';
import { AFFIRM_MESSAGE, CLOSE_TAB_MESSAGE } from './constants';
import type {
  AffirmRequest,
  AffirmResponse,
  CloseTabRequest,
  CloseTabResponse,
} from './types';

/**
 * Asks the background service worker to close the tab that sent this message.
 * The result is always resolved (never throws) so the caller can fall back to
 * in-page navigation when closing is unavailable.
 */
export async function requestCloseTab(): Promise<CloseTabResponse> {
  const message: CloseTabRequest = { type: CLOSE_TAB_MESSAGE };

  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | CloseTabResponse
      | undefined;

    if (response && typeof response === 'object' && 'ok' in response) {
      return response;
    }

    return { ok: false, reason: 'no-response' };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'unknown-error',
    };
  }
}

/**
 * Asks the background to open the affirmation timer page (as the active tab)
 * and then close the source tab. The result is always resolved (never throws)
 * so the caller can fall back safely when the timer page cannot be opened.
 */
export async function requestAffirm(): Promise<AffirmResponse> {
  const message: AffirmRequest = { type: AFFIRM_MESSAGE };

  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | AffirmResponse
      | undefined;

    if (response && typeof response === 'object' && 'ok' in response) {
      return response;
    }

    return { ok: false, reason: 'no-response' };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'unknown-error',
    };
  }
}
