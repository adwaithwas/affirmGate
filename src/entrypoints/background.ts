import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { AFFIRM_MESSAGE, CLOSE_TAB_MESSAGE, TIMER_PAGE_PATH } from '@/lib/constants';
import type {
  AffirmRequest,
  AffirmResponse,
  CloseTabRequest,
  CloseTabResponse,
} from '@/lib/types';

interface ActionApi {
  onClicked: {
    addListener(callback: () => void): void;
  };
}

/**
 * Background service worker / page.
 *
 * Responsibilities:
 *  - Handle the content script's "No — I'd rather affirm" action: open the
 *    affirmation timer page as the active tab, verify it opened, then close the
 *    source YouTube tab. Falls back to the previous safe tab-close behavior if
 *    the timer page cannot be created.
 *  - Close the tab on request from the timer page's "Done" action.
 *  - Open the options page the first time the extension is installed, and from
 *    the toolbar button.
 *
 * Uses `tabs.create`/`tabs.remove`, neither of which requires the "tabs"
 * permission because the extension only ever acts on the tab that messaged it
 * (or on a tab it just created).
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isCloseTabRequest(message)) {
      void closeSenderTab(sender).then(sendResponse);
      return true;
    }

    if (isAffirmRequest(message)) {
      void handleAffirm(sender).then(sendResponse);
      return true;
    }

    return undefined;
  });

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void browser.runtime.openOptionsPage();
    }
  });

  getAction()?.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });
});

/**
 * Opens the affirmation timer page as the active tab, then closes the source
 * tab. If the timer page cannot be created, falls back to the previous safe
 * behavior (close the source tab) and reports failure so the caller can
 * navigate away instead of getting stuck.
 */
async function handleAffirm(sender: Browser.runtime.MessageSender): Promise<AffirmResponse> {
  const sourceTabId = sender.tab?.id;

  try {
    await browser.tabs.create({
      url: browser.runtime.getURL(TIMER_PAGE_PATH),
      active: true,
    });
  } catch (error) {
    // Timer page could not be created: preserve the existing fallback.
    const fallback = await closeSenderTab(sender);
    return {
      ok: false,
      reason: fallback.ok
        ? 'timer-page-unavailable'
        : `timer-page-unavailable:${fallback.reason}`,
    };
  }

  // The timer tab exists; now close the source YouTube tab.
  let closed = false;
  if (typeof sourceTabId === 'number') {
    try {
      await browser.tabs.remove(sourceTabId);
      closed = true;
    } catch {
      closed = false;
    }
  }

  return { ok: true, closed };
}

async function closeSenderTab(sender: Browser.runtime.MessageSender): Promise<CloseTabResponse> {
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') {
    return { ok: false, reason: 'no-tab' };
  }

  try {
    await browser.tabs.remove(tabId);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: toReason(error) };
  }
}

function toReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCloseTabRequest(message: unknown): message is CloseTabRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === CLOSE_TAB_MESSAGE
  );
}

function isAffirmRequest(message: unknown): message is AffirmRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === AFFIRM_MESSAGE
  );
}

/**
 * `browser.action` exists on Manifest V3 (Chromium); Firefox's Manifest V2
 * build exposes the same API under `browser.browserAction`.
 */
function getAction(): ActionApi | undefined {
  const api = browser as unknown as {
    action?: ActionApi;
    browserAction?: ActionApi;
  };
  return api.action ?? api.browserAction;
}
