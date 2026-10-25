# AffirmGate

A small, privacy-first browser extension that interrupts mindless YouTube
consumption. Every time you open YouTube — or move to another video or YouTube
page — a full-screen gate shows **your own** reminder and asks you to make a
deliberate choice before you can interact with the page.

- **Yes, continue** — allows *only the current page*. The next video asks again.
- **No — I'd rather affirm** — opens a calm affirmation timer and closes the tab
  (with a safe fallback).

There is deliberately **no** "allow YouTube forever" option and no permanent
whitelist.

---

## Overview

AffirmGate is built with [WXT](https://wxt.dev) and TypeScript. It targets
Firefox-family browsers first (Zen Browser, Mozilla Firefox) and also provides a
Chromium build (Google Chrome, Microsoft Edge, Brave). The interface is plain
HTML/CSS; the reminder overlay is isolated in a Shadow DOM so YouTube's styles
can never restyle it and vice-versa.

All settings are stored with the WebExtensions `storage.local` API. Nothing is
ever sent anywhere: no server, no account, no analytics, no remote code.

> `future-addons.txt` lists further ideas (blocking audio, custom websites, a
> *focus* timer, a daily summary). These are **not** implemented. (The affirmation
> timer described below is implemented; it is distinct from the "focus timer" idea.)

---

## Features

- Full-screen, distraction-free reminder gate on every distinct YouTube page.
- The exact reminder text you save (multiline supported).
- **Affirmation timer**: choosing "No — I'd rather affirm" opens a local timer
  page showing your affirmation with a ring countdown (15/30/60/90/120 s, default
  30). When it finishes you can **Repeat affirmation** or **Done**. The countdown
  is deadline-based, so it stays accurate even if the browser throttles timers.
- Two explicit actions; the gate cannot be dismissed with Escape, by clicking the
  backdrop, or by clicking outside the modal.
- Pauses any playing video/audio when the gate opens, exits browser fullscreen,
  and keeps media paused until you decide.
- Blocks page scrolling, clicks, and keyboard shortcuts while the gate is active
  (to the extent a content script can).
- Reliable SPA navigation detection: YouTube's `yt-navigate-*` events,
  `popstate`/`hashchange`, and a URL polling fallback.
- Deduplicated: a single navigation never produces multiple overlays.
- Options page with reminder textbox, affirmation textbox + timer-length picker,
  Save, Reset to defaults, enable/disable switch, live previews, and step-by-step
  instructions.
- Options page opens automatically on first install and from the toolbar button.
- Safe handling of missing/corrupt/typed-wrong stored data — never throws.
- Accessible: semantic `<button>`s, visible focus ring, focus trap within the
  dialog, `role="dialog"` + `aria-modal`, prefers-reduced-motion support.

---

## Folder structure

```
affirmGate/
├─ package.json            # scripts + devDependencies
├─ tsconfig.json           # strict TS config (extends WXT's generated config)
├─ vitest.config.ts        # unit-test configuration
├─ wxt.config.ts           # WXT manifest + multi-browser config
├─ public/
│  └─ icon/                # 16/32/48/96/128 PNG icons (auto-added to manifest)
├─ src/
│  ├─ entrypoints/
│  │  ├─ background.ts     # affirm (open timer + close sender), tab-close handler,
│  │  │                    #   first-run + toolbar actions
│  │  ├─ content.ts        # gate controller + navigation detection
│  │  ├─ timer/
│  │  │  ├─ index.html     # affirmation timer page markup
│  │  │  ├─ main.ts        # deadline-based countdown + Repeat/Done
│  │  │  └─ style.css      # affirmation timer styles
│  │  └─ options/
│  │     ├─ index.html     # settings page markup
│  │     ├─ main.ts        # settings page logic
│  │     └─ style.css      # settings page styles
│  └─ lib/
│     ├─ constants.ts      # shared constants (defaults, keys, durations, …)
│     ├─ types.ts          # shared TypeScript types
│     ├─ settings.ts       # pure settings validation/normalization
│     ├─ settings.test.ts  # unit tests for settings
│     ├─ navigation.ts     # pure route-key + navigation policy logic
│     ├─ navigation.test.ts# unit tests for navigation
│     ├─ timer.ts          # pure deadline-based countdown helpers
│     ├─ timer.test.ts     # unit tests for the countdown helpers
│     ├─ storage.ts        # storage.local wrapper (load/save/reset/watch)
│     ├─ messages.ts       # typed runtime-message helpers
│     ├─ overlay.ts        # Shadow-DOM reminder overlay
│     └─ overlay-styles.ts # overlay CSS (injected into the shadow root)
└─ future-addons.txt       # out-of-scope ideas
```

---

## Prerequisites

- **Node.js 20+** (developed and tested with Node 22) and npm.
- A supported browser for manual testing (see below).

---

## Development commands

```bash
npm install          # install dependencies (also runs `wxt prepare`)

npm run dev          # Chromium dev build with HMR  -> .output/chrome-mv3
npm run dev:firefox  # Firefox dev build with HMR   -> .output/firefox-mv2

npm run compile      # TypeScript type-check only (tsc --noEmit)
```

## Test commands

```bash
npm test             # run the unit tests once (vitest run)
npm run test:watch   # run the unit tests in watch mode
```

## Build commands

```bash
# Chromium bundle (Chrome, Edge, Brave)
npm run build          # -> .output/chrome-mv3

# Firefox / Zen bundle
npm run build:firefox  # -> .output/firefox-mv2

# both at once
npm run build:all

# package .zip archives for distribution
npm run zip            # -> .output/affirmgate-<version>-chrome.zip
npm run zip:firefox    # -> .output/affirmgate-<version>-firefox.zip (+ -sources.zip)
```

The exact output directories were verified with WXT 0.21.4:

| Target browsers          | Command                | Output directory        |
| ------------------------ | ---------------------- | ----------------------- |
| Chrome / Edge / Brave    | `npm run build`        | `.output/chrome-mv3`    |
| Firefox / Zen Browser    | `npm run build:firefox`| `.output/firefox-mv2`   |

---

## Loading the unpacked extension

Build the bundle for your browser first (commands above).

### Google Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.

### Microsoft Edge

1. Open `edge://extensions`.
2. Turn on **Developer mode** (left sidebar).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.

### Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
   (Edge and Brave are Chromium-based and use the Chromium bundle.)

### Mozilla Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `.output/firefox-mv2/manifest.json`.
4. Because it is a temporary add-on, Firefox removes it when the browser closes.
   For a permanent install, sign the `-firefox.zip` through
   [addons.mozilla.org](https://addons.mozilla.org/developers/) or use Firefox
   Developer Edition / Nightly with `xpinstall.signatures.required = false`.

### Zen Browser

Zen is Firefox-based, so it uses the **same** `.output/firefox-mv2` bundle:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `.output/firefox-mv2/manifest.json`.

Zen does not support permanent unsigned installs; keep the folder in place and
re-load it from `about:debugging` after a restart, or sign the bundle.

> The Firefox build declares a stable add-on id (`browser_specific_settings.gecko.id`
> in `wxt.config.ts`) so `storage.local` stays associated with the extension. If
> you publish to AMO, replace it with your own id.

---

## Configuring the gate

1. On first install an **AffirmGate settings** tab opens. You can also open it
   any time by clicking the AffirmGate toolbar icon,
   or via your browser's extension manager → **Options**.
2. Type your reminder in the reminder textbox. Multiline text and newlines are
   preserved.
3. Press **Save** (or **Reset to default** to restore the generic text).
4. Use the **Gate enabled** switch to turn the gate off entirely.
5. The **Preview** panel shows exactly how the gate will look.

Notes:

- The reminder is limited to 500 characters and is trimmed of surrounding
  whitespace. Empty/whitespace-only text falls back to the default.
- Settings are stored per browser profile, so each user configures their own.

Default reminder:

> Pause. Is this important? Or would you rather focus on what really matters to you?

### Affirmation timer

The **Affirmation timer** panel configures what happens when you choose
**No — I'd rather affirm**:

1. Type your affirmation (multiline supported, up to 500 characters). Empty text
   falls back to the default.
2. Pick a **Timer length**: 15, 30 (default), 60, 90, or 120 seconds. The ring
   preview updates live.
3. Press **Save**. Both the reminder and the affirmation are saved together.

When you affirm on YouTube, AffirmGate opens its own local timer page as the
active tab, shows your affirmation, and counts down. When it reaches zero you can
**Repeat affirmation** for another full session or **Done** to close the tab.
The timer page is a normal extension page — it makes no network requests.

Default affirmation:

> I am becoming the person I have chosen to be. My attention belongs to what matters to me.

---

## Navigation policy

The gate uses a **route key** that identifies a distinct YouTube destination:

- `/watch?v=<videoId>` — videos are keyed by video id.
- `/results?search_query=<q>` — searches by query.
- `/playlist?list=<id>` — playlists by list id.
- `/shorts/<id>` and all other routes — by normalized pathname.

Transient parameters (`t`, `list` on a watch page, `index`, tracking params) are
ignored so re-rendering the same page does **not** re-trigger the gate.

Behavior:

1. Opening any YouTube page arms the gate.
2. The user must choose an action before interacting.
3. **Yes, continue** authorizes **only the current navigation instance** (an
   internal token). It is not remembered for future navigations.
4. Any distinct navigation — a different video, search, channel, and even
   returning via Back/Forward to a page seen earlier — re-arms the gate.
5. Duplicate navigation events for the same route are ignored, so one navigation
   never stacks multiple overlays.
6. Unrelated DOM mutations never trigger the gate (only URL/route changes do).
7. There is no permanent URL whitelist and no "allow forever" setting.

---

## Permissions and privacy

| Permission / manifest key        | Why it is needed                                          |
| -------------------------------- | --------------------------------------------------------- |
| `storage`                        | Save your reminder, affirmation and settings locally.     |
| `host_permissions: *://*.youtube.com/*` | Inject the gate only on YouTube pages.             |
| `tabs`                           | **Not requested.** Closing the sender's own tab via `tabs.remove` and opening the timer tab via `tabs.create` need no `tabs` permission. |

- No analytics, telemetry, advertising, external APIs, or remote code.
- No network requests of any kind.
- Personal reminder text is never logged and never leaves the device.

---

## Testing

### Automated (run locally)

```bash
npm test        # 45 unit tests — settings validation + navigation + timer logic
npm run compile # TypeScript type-check
npm run build && npm run build:firefox
```

What the automated tests cover:

- `settings.test.ts` — fall back to defaults for `null`/`undefined`/wrong types,
  trim whitespace, preserve newlines/tabs, strip other control characters,
  truncate to the max length, ignore extra keys, never mutate input, return fresh
  default objects, migrate legacy settings that predate the affirmation timer,
  and validate/normalize the affirmation text and timer duration.
- `navigation.test.ts` — host detection (incl. look-alike domains), route-key
  generation for watch/search/playlist/shorts/channel/home, ignoring transient
  params, `null` for non-YouTube URLs, distinct-vs-duplicate navigation counting
  (including Back to a previously seen page), and the show/hide decision.
- `timer.test.ts` — session/deadline creation, remaining milliseconds/seconds
  (round-up behavior at the boundary), completion, progress fraction (0→1,
  clamped), and `M:SS` clock formatting (incl. invalid input).

### Manual (requires a live browser)

Use this checklist whenever the overlay, navigation, or background code changes:

- [ ] 1. Extension initializes with the generic default reminder.
- [ ] 2. Change the reminder and press **Save**.
- [ ] 3. Refresh the web page — the saved reminder is still shown.
- [ ] 4. Restart the browser — settings persist (permanent install / signed build).
- [ ] 5. The gate appears on the initial YouTube page (e.g. the homepage).
- [ ] 6. The overlay blocks scrolling, clicks, and page keyboard shortcuts.
- [ ] 7. **Yes, continue** unlocks only the current page.
- [ ] 8. Clicking another video shows the gate again — without a document reload.
- [ ] 9. Browser Back/Forward between YouTube routes shows the gate again.
- [ ] 10. **No — I'd rather affirm** opens the affirmation timer page in a new
      active tab, shows the saved affirmation, and closes the source YouTube tab.
- [ ] 11. The timer counts down to zero, then offers **Repeat affirmation** and
      **Done**. **Repeat** restarts a full session; **Done** closes the tab.
      (If the YouTube tab could not be closed, the gate is dismissed instead of
      leaving you stuck.)
- [ ] 12. If the timer page cannot be opened, the gate falls back to leaving the
      page (`about:blank` / previous page).
- [ ] 13. Rapid/repeated navigation never creates duplicate overlays.
- [ ] 14. A missing/corrupt setting does not break the extension (edit
      `storage.local` via devtools, or clear it, and reload).
- [ ] 15. Turning the **Gate enabled** switch off disables blocking.
- [ ] 16. The Firefox/Zen and Chromium builds both load and run.

> Items 1–16 are **manual** and were not executed by an automated browser in
> this repository. The automated suite and both builds were executed (see the
> results section below).

---

## Troubleshooting

- **The gate never appears.**
  - Confirm the extension is loaded and enabled.
  - Confirm the **Gate enabled** switch is on in the options page.
  - Reload the YouTube tab so the content script re-injects.
  - The extension only matches `*://*.youtube.com/*`; it will not run on
    embeds hosted on other domains, or on `youtu.be` links (which redirect to
    `youtube.com`).
- **The overlay is behind the video.** If the player is in HTML5 fullscreen,
  AffirmGate calls `exitFullscreen()` when it activates. If a page re-enters
  fullscreen programmatically it can briefly cover the gate; press `Esc` in the
  player and the gate will be on top.
- **Settings do not persist after restarting Firefox/Zen.** A temporarily
  loaded add-on is removed on restart; reload it from `about:debugging`, or use
  a signed/permanent install.
- **Options page opens in a new tab.** This is intentional (`open_in_tab`) so the
  preview and instructions have room. You can also open it from the toolbar icon.
- **Save says the default was restored.** You submitted empty/whitespace-only
  text; type something and save again.
- **Type-check/build errors after editing.** Run `npm run compile` and read the
  first error; WXT regenerates `.wxt/` types on `npm install`/`wxt prepare`.

---

## Known browser-specific limitations

- **Content-script keyboard blocking is best-effort.** AffirmGate stops page
  shortcuts (e.g. YouTube's `k`, `space`, arrow keys, `Esc`) while the gate is
  active, but it intentionally cannot and does not block browser/OS shortcuts
  such as `Ctrl+W`, `F5`, `Ctrl+T`, or the browser's own Back button.
- **Firefox / Zen install is temporary** unless the bundle is signed (AMO) or
  you run Developer Edition/Nightly with signature checks disabled. The
  Chromium builds can be loaded unpacked permanently.
- **Chromium builds use the same bundle (`chrome-mv3`)** for Chrome, Edge, and
  Brave. Edge/Brave were not individually installed during development; they are
  expected to work because they share the Chromium extension APIs, but that
  expectation is not a guarantee — verify locally.
- **YouTube is the only matched site** in this release. `music.youtube.com` and
  `studio.youtube.com` also match the `*.youtube.com` pattern and will gate.
- **SPA detection depends on YouTube's behavior.** AffirmGate listens for
  `yt-navigate-start`/`yt-navigate-finish`/`yt-page-data-updated`, plus
  `popstate`/`hashchange`, plus a 400 ms URL poll. If YouTube renames its events,
  the poll still catches URL changes, but there may be a short delay.
- **`about:blank` fallback.** If the background cannot close the tab, the gate
  falls back to navigating the current tab away. Some browsers may restrict
  scripted navigation in rare cases.

---

## Automated results (as executed in this repository)

- `npm test` — **passing**: 3 test files, 45 tests.
- `npm run compile` — **passing**: no type errors.
- `npm run build` (Chromium, `chrome-mv3`) — **passing**.
- `npm run build:firefox` (`firefox-mv2`) — **passing** (no build warnings).
- `npm run zip` / `npm run zip:firefox` — **passing**.

Manual browser scenarios above still need to be confirmed in a live browser.

---

## License

MIT (declared in `package.json`).
