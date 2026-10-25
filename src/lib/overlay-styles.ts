/**
 * Styles injected inside the overlay's shadow root.
 *
 * They live in a shadow root so YouTube's stylesheet can never restyle the
 * gate, and the gate's styles can never leak into YouTube.
 *
 * `:host { all: initial }` resets inherited typography/colors so the gate looks
 * identical on every YouTube layout (including the dark theme).
 */
export const overlayStyles = `
  :host {
    all: initial;
    display: block;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
      "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
    color-scheme: light;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  .ag-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(9, 10, 14, 0.88);
    overscroll-behavior: contain;
    cursor: default;
  }

  .ag-card {
    width: 100%;
    max-width: 560px;
    margin: 0;
    padding: 36px 34px 30px;
    border-radius: 18px;
    background: #ffffff;
    color: #14161a;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
    text-align: center;
    line-height: 1.5;
  }

  .ag-eyebrow {
    margin: 0 0 14px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .ag-reminder {
    margin: 0 0 26px;
    font-size: clamp(1.25rem, 2.4vw, 1.7rem);
    font-weight: 600;
    line-height: 1.45;
    color: #14161a;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .ag-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: center;
  }

  .ag-btn {
    flex: 1 1 190px;
    min-height: 52px;
    padding: 14px 22px;
    border-radius: 999px;
    border: 2px solid transparent;
    font: inherit;
    font-size: 1.12rem;
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
    transition: transform 0.12s ease, background-color 0.12s ease,
      border-color 0.12s ease, box-shadow 0.12s ease;
  }

  .ag-btn:hover {
    transform: translateY(-1px);
  }

  .ag-btn:active {
    transform: translateY(0);
  }

  .ag-btn:focus-visible {
    outline: 3px solid #f59e0b;
    outline-offset: 3px;
  }

  .ag-btn--continue {
    background: #ffffff;
    color: #14161a;
    border-color: #cbd0da;
  }

  .ag-btn--continue:hover {
    background: #f3f4f6;
  }

  .ag-btn--affirm {
    background: #4f46e5;
    color: #ffffff;
    border-color: #4f46e5;
    box-shadow: 0 8px 22px rgba(79, 70, 229, 0.35);
  }

  .ag-btn--affirm:hover {
    background: #4338ca;
    border-color: #4338ca;
  }

  @media (max-width: 480px) {
    .ag-card {
      padding: 28px 22px 24px;
    }
    .ag-btn {
      flex-basis: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ag-btn {
      transition: none;
    }
    .ag-btn:hover,
    .ag-btn:active {
      transform: none;
    }
  }
`;
