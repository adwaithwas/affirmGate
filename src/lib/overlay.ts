import { OVERLAY_HOST_ATTRIBUTE, OVERLAY_HOST_ID } from './constants';
import { overlayStyles } from './overlay-styles';

export interface ReminderOverlayOptions {
  /** Called when the user chooses to continue on the current page. */
  onContinue: () => void;
  /** Called when the user chooses to leave / affirm their intention. */
  onAffirm: () => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Pointer/mouse events that must never reach the page under the gate. */
const GATE_SWALLOWED_EVENTS = [
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'pointerdown',
  'pointerup',
  'touchstart',
] as const;

/**
 * Full-screen, shadow-DOM-isolated reminder gate.
 *
 * The overlay owns all of its event listeners and removes every one of them on
 * {@link hide}, so repeated show/hide cycles never leak listeners.
 */
export class ReminderOverlay {
  private host: HTMLElement | null = null;
  private reminderEl: HTMLElement | null = null;
  private continueButton: HTMLButtonElement | null = null;
  private restoreFocus: Element | null = null;

  private prevHtmlOverflow = '';
  private prevBodyOverflow = '';
  private prevBodyInert: boolean | null = null;

  constructor(private readonly options: ReminderOverlayOptions) {}

  /** Whether the overlay is currently mounted. */
  get isActive(): boolean {
    return this.host !== null;
  }

  /** Updates the reminder text while the overlay is visible. */
  setReminder(text: string): void {
    if (this.reminderEl) this.reminderEl.textContent = text;
  }

  /** Mounts the overlay and locks down page interaction. Idempotent. */
  show(reminder: string): void {
    if (this.host) {
      this.setReminder(reminder);
      return;
    }

    const mount = document.documentElement ?? document.body;
    if (!mount) {
      console.warn('[AffirmGate] No document root available to mount the gate.');
      return;
    }

    this.restoreFocus = document.activeElement;

    const host = document.createElement('div');
    host.id = OVERLAY_HOST_ID;
    host.setAttribute(OVERLAY_HOST_ATTRIBUTE, '');

    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = overlayStyles;
    shadow.append(styleEl);
    shadow.append(this.buildContent(reminder));

    this.reminderEl = shadow.querySelector<HTMLElement>('[data-role="reminder"]');
    this.continueButton = shadow.querySelector<HTMLButtonElement>(
      '[data-role="continue"]',
    );
    const affirmButton = shadow.querySelector<HTMLButtonElement>(
      '[data-role="affirm"]',
    );

    this.continueButton?.addEventListener('click', this.onContinueClick);
    affirmButton?.addEventListener('click', this.onAffirmClick);

    // Swallow every pointer/mouse event that happens anywhere over the gate so
    // it can never reach YouTube's own handlers. These listeners sit at the
    // shadow root (bubble phase), so the gate's own button handlers still run.
    for (const type of GATE_SWALLOWED_EVENTS) {
      shadow.addEventListener(type, swallowEvent);
    }
    shadow.addEventListener('contextmenu', suppressContextMenu);
    shadow.addEventListener('keydown', this.trapFocus);

    mount.append(host);
    this.host = host;

    this.lockPageScroll();
    this.addGlobalBlockers();

    // Focus the least destructive action so an accidental Enter does not
    // immediately continue.
    this.continueButton?.focus();
  }

  /** Unmounts the overlay and restores page interaction. Idempotent. */
  hide(): void {
    const host = this.host;
    if (!host) return;

    this.removeGlobalBlockers();
    this.unlockPageScroll();

    host.shadowRoot?.removeEventListener('keydown', this.trapFocus);
    const shadow = host.shadowRoot;
    if (shadow) {
      for (const type of GATE_SWALLOWED_EVENTS) {
        shadow.removeEventListener(type, swallowEvent);
      }
      shadow.removeEventListener('contextmenu', suppressContextMenu);
    }

    host.remove();
    this.host = null;
    this.reminderEl = null;
    this.continueButton = null;

    const target = this.restoreFocus;
    this.restoreFocus = null;
    if (target instanceof HTMLElement && document.contains(target)) {
      try {
        target.focus();
      } catch {
        /* focusing the old element can fail if it was detached; ignore. */
      }
    }
  }

  private buildContent(reminder: string): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const backdrop = document.createElement('div');
    backdrop.className = 'ag-backdrop';
    backdrop.dataset.role = 'backdrop';

    const card = document.createElement('div');
    card.className = 'ag-card';
    // The dialog role lives inside the shadow root so its aria-labelledby
    // reference resolves (ARIA references do not cross shadow boundaries).
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'affirmgate-reminder');

    const eyebrow = document.createElement('p');
    eyebrow.className = 'ag-eyebrow';
    eyebrow.textContent = 'AffirmGate';

    const reminderEl = document.createElement('p');
    reminderEl.id = 'affirmgate-reminder';
    reminderEl.className = 'ag-reminder';
    reminderEl.dataset.role = 'reminder';
    // textContent keeps user input inert (no HTML injection).
    reminderEl.textContent = reminder;

    const actions = document.createElement('div');
    actions.className = 'ag-actions';

    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.className = 'ag-btn ag-btn--continue';
    continueButton.dataset.role = 'continue';
    continueButton.textContent = 'Yes, continue';

    const affirmButton = document.createElement('button');
    affirmButton.type = 'button';
    affirmButton.className = 'ag-btn ag-btn--affirm';
    affirmButton.dataset.role = 'affirm';
    affirmButton.textContent = "No — I'd rather affirm";

    actions.append(continueButton, affirmButton);

    card.append(eyebrow, reminderEl, actions);
    backdrop.append(card);
    fragment.append(backdrop);

    return fragment;
  }

  private readonly onContinueClick = (event: Event): void => {
    stopEvent(event);
    this.options.onContinue();
  };

  private readonly onAffirmClick = (event: Event): void => {
    stopEvent(event);
    this.options.onAffirm();
  };

  private readonly trapFocus = (event: Event): void => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== 'Tab') return;

    const host = this.host;
    if (!host?.shadowRoot) return;

    const focusable = Array.from(
      host.shadowRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    const active = host.shadowRoot.activeElement;

    if (keyEvent.shiftKey && active === first) {
      keyEvent.preventDefault();
      last.focus();
    } else if (!keyEvent.shiftKey && active === last) {
      keyEvent.preventDefault();
      first.focus();
    }
  };

  private readonly blockKey = (event: KeyboardEvent): void => {
    const host = this.host;
    if (!host) return;

    const insideGate = event.composedPath().includes(host);
    // Let the gate's own controls receive Tab / Enter / Space. Everything else
    // (including Escape) is swallowed so YouTube shortcuts cannot fire and the
    // gate cannot be dismissed from the keyboard.
    const isActivationKey =
      event.key === 'Tab' || event.key === 'Enter' || event.key === ' ';

    if (insideGate && isActivationKey) return;

    stopEvent(event);
  };

  private readonly blockPointerOrScroll = (event: Event): void => {
    const host = this.host;
    if (!host) return;
    // Allow interactions that originate inside the gate's own controls.
    if (event.composedPath().includes(host)) return;
    stopEvent(event);
  };

  private readonly blockScroll = (event: Event): void => {
    event.preventDefault();
    stopEvent(event);
  };

  private addGlobalBlockers(): void {
    window.addEventListener('keydown', this.blockKey, true);
    window.addEventListener('keyup', this.blockKey, true);
    window.addEventListener('keypress', this.blockKey, true);

    for (const type of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'auxclick',
      'contextmenu',
      'pointerdown',
      'pointerup',
    ]) {
      window.addEventListener(type, this.blockPointerOrScroll, true);
    }

    window.addEventListener('wheel', this.blockScroll, {
      capture: true,
      passive: false,
    });
    window.addEventListener('touchmove', this.blockScroll, {
      capture: true,
      passive: false,
    });
  }

  private removeGlobalBlockers(): void {
    window.removeEventListener('keydown', this.blockKey, true);
    window.removeEventListener('keyup', this.blockKey, true);
    window.removeEventListener('keypress', this.blockKey, true);

    for (const type of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'auxclick',
      'contextmenu',
      'pointerdown',
      'pointerup',
    ]) {
      window.removeEventListener(type, this.blockPointerOrScroll, true);
    }

    window.removeEventListener('wheel', this.blockScroll, true);
    window.removeEventListener('touchmove', this.blockScroll, true);
  }

  private lockPageScroll(): void {
    const html = document.documentElement;
    if (html) {
      this.prevHtmlOverflow = html.style.overflow;
      html.style.overflow = 'hidden';
    }
    if (document.body) {
      this.prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // `inert` removes the page behind the gate from interaction and the
      // accessibility tree. The gate is a sibling of <body>, so it is unaffected.
      this.prevBodyInert = document.body.inert;
      document.body.inert = true;
    }
  }

  private unlockPageScroll(): void {
    const html = document.documentElement;
    if (html) html.style.overflow = this.prevHtmlOverflow;
    if (document.body) {
      document.body.style.overflow = this.prevBodyOverflow;
      if (this.prevBodyInert !== null) {
        document.body.inert = this.prevBodyInert;
      }
    }
    this.prevBodyInert = null;
  }
}

function stopEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function swallowEvent(event: Event): void {
  event.stopPropagation();
}

function suppressContextMenu(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}
