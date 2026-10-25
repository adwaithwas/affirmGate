import type { NavigationState } from './types';

/**
 * Returns true when a hostname belongs to YouTube (e.g. `youtube.com`,
 * `www.youtube.com`, `m.youtube.com`, `music.youtube.com`).
 */
export function isYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'youtube.com' || host.endsWith('.youtube.com');
}

/**
 * Computes a stable "route key" for a YouTube URL.
 *
 * The key intentionally ignores transient query parameters (timestamps,
 * playlist position, tracking) so that re-rendering the same page does not
 * re-trigger the gate. It preserves the parameters that identify a *distinct*
 * destination (video id, search query, playlist id).
 *
 * Returns `null` for URLs that are not YouTube pages or cannot be parsed.
 */
export function getRouteKey(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (!isYouTubeHost(url.hostname)) return null;

  const path = normalizePath(url.pathname);

  if (path === '/watch') {
    const videoId = url.searchParams.get('v');
    return videoId ? `/watch?v=${videoId}` : '/watch';
  }

  if (path === '/results') {
    const query = url.searchParams.get('search_query');
    return query ? `/results?search_query=${query}` : '/results';
  }

  if (path === '/playlist') {
    const listId = url.searchParams.get('list');
    return listId ? `/playlist?list=${listId}` : '/playlist';
  }

  // Everything else (channels, /shorts/<id>, /feed/*, homepage, etc.) is
  // uniquely identified by its normalized pathname.
  return path;
}

function normalizePath(pathname: string): string {
  let path = pathname || '/';
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

/** Creates the initial navigation state. */
export function createNavigationState(): NavigationState {
  return { lastKey: null, token: 0 };
}

/**
 * Records a navigation. Returns `true` exactly once per *distinct* destination.
 *
 * Duplicate events for the same destination (YouTube fires several navigation
 * events per transition) return `false`, which is how the gate avoids showing
 * overlapping overlays. Navigating away and back again produces a new token.
 */
export function registerNavigation(
  state: NavigationState,
  key: string | null,
): boolean {
  if (key === null) return false;
  if (state.lastKey === key) return false;

  state.lastKey = key;
  state.token += 1;
  return true;
}

/**
 * Decides whether the gate should be visible.
 *
 * The gate is shown whenever the gate is enabled and the current navigation
 * token has not been explicitly authorized by the user.
 */
export function shouldShowGate(params: {
  enabled: boolean;
  token: number;
  authorizedToken: number | null;
}): boolean {
  if (!params.enabled) return false;
  return params.authorizedToken !== params.token;
}
