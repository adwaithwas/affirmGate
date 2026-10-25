import { defineContentScript } from 'wxt/utils/define-content-script';
import { NAVIGATION_POLL_INTERVAL } from '@/lib/constants';
import { requestAffirm } from '@/lib/messages';
import {
  createNavigationState,
  getRouteKey,
  registerNavigation,
  shouldShowGate,
} from '@/lib/navigation';
import { ReminderOverlay } from '@/lib/overlay';
import { getDefaultSettings } from '@/lib/settings';
import { loadSettings, watchSettings } from '@/lib/storage';
import type { Settings } from '@/lib/types';

/**
 * YouTube is a single-page application, so the document does not reload when
 * you move between videos. These custom events are fired by YouTube's own
 * navigation layer; `popstate`/`hashchange` and a URL poll act as fallbacks.
 */
const NAVIGATION_EVENTS = [
  'yt-navigate-finish',
  'yt-page-data-updated',
  'yt-navigate-start',
] as const;

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  allFrames: false,
  main(ctx) {
    // Guard against accidental double injection (e.g. hot reload in dev).
    const globalKey = '__affirmgateController__';
    const globalObject = window as unknown as Record<string, unknown>;
    if (globalObject[globalKey]) return;
    globalObject[globalKey] = true;

    const controller = new GateController();
    // Clean up listeners/timers when the extension context is invalidated
    // (extension reload/update, HMR) so no stale state survives.
    ctx.onInvalidated(() => controller.dispose());
    void controller.start();
  },
});

/**
 * Owns the gate's lifecycle on a single YouTube document:
 * settings, navigation tracking, overlay show/hide, and the two actions.
 */
class GateController {
  private settings: Settings = getDefaultSettings();
  private readonly navState = createNavigationState();
  private authorizedToken: number | null = null;

  private ready = false;
  private started = false;
  private scheduled = false;
  private affirming = false;
  private lastHref = '';
  private pollId: number | null = null;
  private mediaGuardAttached = false;
  private unwatchSettings: (() => void) | null = null;

  private readonly overlay: ReminderOverlay;

  constructor() {
    this.overlay = new ReminderOverlay({
      onContinue: () => this.handleContinue(),
      onAffirm: () => {
        void this.handleAffirm();
      },
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Attach navigation listeners immediately so early SPA events are not lost,
    // then wait for settings before deciding whether to show the gate.
    this.attachNavigationListeners();

    this.settings = await loadSettings();
    this.ready = true;
    this.lastHref = location.href;
    this.startPolling();
    this.unwatchSettings = watchSettings((next) => this.handleSettingsChanged(next));

    this.scheduleEvaluate();
  }

  private attachNavigationListeners(): void {
    // YouTube dispatches its navigation events on the document; `popstate` and
    // `hashchange` fire on window. Listening on both targets in the capture
    // phase maximizes the chance of catching a transition.
    for (const target of [window, document]) {
      for (const name of NAVIGATION_EVENTS) {
        target.addEventListener(name, this.handleNavigationEvent, true);
      }
    }
    window.addEventListener('popstate', this.handleNavigationEvent, true);
    window.addEventListener('hashchange', this.handleNavigationEvent, true);
  }

  private startPolling(): void {
    // Final safety net for URL changes that emit no usable event.
    this.pollId = window.setInterval(() => {
      if (location.href !== this.lastHref) {
        this.lastHref = location.href;
        this.scheduleEvaluate();
      }
    }, NAVIGATION_POLL_INTERVAL);
  }

  private readonly handleNavigationEvent = (): void => {
    this.scheduleEvaluate();
  };

  /** Coalesces bursts of navigation events into a single evaluation. */
  private scheduleEvaluate(): void {
    if (!this.ready || this.scheduled) return;
    this.scheduled = true;
    window.setTimeout(() => {
      this.scheduled = false;
      this.evaluate();
    }, 0);
  }

  private evaluate(): void {
    if (!this.ready) return;

    this.lastHref = location.href;
    const key = getRouteKey(location.href);
    const isDistinct = registerNavigation(this.navState, key);

    if (!isDistinct) {
      // Duplicate event for the current page. Only react if the gate was
      // disabled in the meantime.
      if (!this.settings.enabled) this.dismissGate();
      return;
    }

    this.updateGate();
  }

  private updateGate(): void {
    if (!this.settings.enabled) {
      this.dismissGate();
      return;
    }

    const show = shouldShowGate({
      enabled: true,
      token: this.navState.token,
      authorizedToken: this.authorizedToken,
    });

    if (!show) {
      this.dismissGate();
      return;
    }

    if (this.overlay.isActive) {
      this.overlay.setReminder(this.settings.reminder);
    } else {
      this.activateGate();
    }
  }

  private activateGate(): void {
    this.pauseMedia();
    this.overlay.show(this.settings.reminder);
    this.attachMediaGuard();
  }

  private dismissGate(): void {
    this.detachMediaGuard();
    if (this.overlay.isActive) this.overlay.hide();
  }

  /** "Yes, continue": authorize exactly the current navigation only. */
  private handleContinue(): void {
    this.authorizedToken = this.navState.token;
    this.detachMediaGuard();
    this.overlay.hide();
    // Deliberately do NOT resume playback; the user can press play when ready.
  }

  /**
   * "No — I'd rather affirm": open the affirmation timer page and close this
   * tab. Falls back to leaving the page when the timer page cannot be opened.
   */
  private async handleAffirm(): Promise<void> {
    if (this.affirming) return;
    this.affirming = true;

    const result = await requestAffirm();

    if (result.ok) {
      // The timer tab opened. If the source tab could not be closed (e.g. no
      // tab id), dismiss the gate so the user is not stuck behind the overlay.
      if (!result.closed) this.dismissGate();
      return;
    }

    // The timer page could not be created; fall back to leaving the page.
    this.affirming = false;
    console.warn('[AffirmGate] Could not open the affirmation timer:', result.reason);
    this.leavePage();
  }

  private leavePage(): void {
    this.overlay.hide();
    const before = location.href;

    try {
      window.location.replace('about:blank');
    } catch {
      /* fall through to history fallback */
    }

    window.setTimeout(() => {
      if (location.href !== before) return;
      try {
        if (history.length > 1) history.back();
        else window.location.href = 'about:blank';
      } catch {
        window.location.href = 'about:blank';
      }
    }, 400);
  }

  private handleSettingsChanged(next: Settings): void {
    const wasEnabled = this.settings.enabled;
    this.settings = next;

    if (!next.enabled) {
      this.dismissGate();
      return;
    }

    if (this.overlay.isActive) {
      this.overlay.setReminder(next.reminder);
      return;
    }

    // Re-enabled while sitting on YouTube: gate the current page, since its
    // navigation token has not been authorized.
    if (!wasEnabled) this.updateGate();
  }

  private pauseMedia(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    for (const media of document.querySelectorAll<HTMLMediaElement>(
      'video, audio',
    )) {
      try {
        media.pause();
      } catch {
        /* ignore media that cannot be paused */
      }
    }
  }

  private readonly handleMediaPlay = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLMediaElement && !target.paused) {
      try {
        target.pause();
      } catch {
        /* ignore */
      }
    }
  };

  private attachMediaGuard(): void {
    if (this.mediaGuardAttached) return;
    document.addEventListener('play', this.handleMediaPlay, true);
    document.addEventListener('playing', this.handleMediaPlay, true);
    this.mediaGuardAttached = true;
  }

  private detachMediaGuard(): void {
    if (!this.mediaGuardAttached) return;
    document.removeEventListener('play', this.handleMediaPlay, true);
    document.removeEventListener('playing', this.handleMediaPlay, true);
    this.mediaGuardAttached = false;
  }

  /** Removes listeners/timers. Currently only used if the page is unloaded. */
  dispose(): void {
    for (const target of [window, document]) {
      for (const name of NAVIGATION_EVENTS) {
        target.removeEventListener(name, this.handleNavigationEvent, true);
      }
    }
    window.removeEventListener('popstate', this.handleNavigationEvent, true);
    window.removeEventListener('hashchange', this.handleNavigationEvent, true);

    if (this.pollId !== null) {
      window.clearInterval(this.pollId);
      this.pollId = null;
    }

    this.detachMediaGuard();
    this.unwatchSettings?.();
    this.unwatchSettings = null;
    this.overlay.hide();
  }
}
