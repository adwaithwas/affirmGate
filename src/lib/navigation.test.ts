import { describe, expect, it } from 'vitest';
import {
  createNavigationState,
  getRouteKey,
  isYouTubeHost,
  registerNavigation,
  shouldShowGate,
} from '../lib/navigation';

describe('isYouTubeHost', () => {
  it('recognizes YouTube hosts and subdomains', () => {
    expect(isYouTubeHost('youtube.com')).toBe(true);
    expect(isYouTubeHost('www.youtube.com')).toBe(true);
    expect(isYouTubeHost('m.youtube.com')).toBe(true);
    expect(isYouTubeHost('music.youtube.com')).toBe(true);
    expect(isYouTubeHost('YOUTUBE.COM')).toBe(true);
  });

  it('rejects look-alike and unrelated hosts', () => {
    expect(isYouTubeHost('notyoutube.com')).toBe(false);
    expect(isYouTubeHost('youtube.com.evil.com')).toBe(false);
    expect(isYouTubeHost('youtubee.com')).toBe(false);
    expect(isYouTubeHost('example.com')).toBe(false);
  });
});

describe('getRouteKey', () => {
  it('keys videos by their video id', () => {
    expect(getRouteKey('https://www.youtube.com/watch?v=abc123')).toBe(
      '/watch?v=abc123',
    );
  });

  it('ignores transient parameters on the same video', () => {
    const a = getRouteKey('https://www.youtube.com/watch?v=abc123&t=90s');
    const b = getRouteKey(
      'https://www.youtube.com/watch?v=abc123&list=PL1&index=4&pp=xyz',
    );
    expect(a).toBe('/watch?v=abc123');
    expect(a).toBe(b);
  });

  it('treats different videos as different routes', () => {
    expect(getRouteKey('https://www.youtube.com/watch?v=one')).not.toBe(
      getRouteKey('https://www.youtube.com/watch?v=two'),
    );
  });

  it('keys searches by the query', () => {
    expect(
      getRouteKey('https://www.youtube.com/results?search_query=cats&x=1'),
    ).toBe('/results?search_query=cats');
  });

  it('keys playlists by the list id', () => {
    expect(getRouteKey('https://www.youtube.com/playlist?list=PL99')).toBe(
      '/playlist?list=PL99',
    );
  });

  it('keys channels and shorts by path', () => {
    expect(getRouteKey('https://www.youtube.com/@somechannel/videos')).toBe(
      '/@somechannel/videos',
    );
    expect(getRouteKey('https://www.youtube.com/shorts/xyz789')).toBe(
      '/shorts/xyz789',
    );
  });

  it('normalizes the homepage and trailing slashes', () => {
    expect(getRouteKey('https://www.youtube.com/')).toBe('/');
    expect(getRouteKey('https://www.youtube.com')).toBe('/');
    expect(getRouteKey('https://www.youtube.com/feed/subscriptions/')).toBe(
      '/feed/subscriptions',
    );
  });

  it('returns null for non-YouTube or unparseable URLs', () => {
    expect(getRouteKey('https://example.com/watch?v=abc')).toBeNull();
    expect(getRouteKey('not a url')).toBeNull();
  });
});

describe('registerNavigation', () => {
  it('counts only distinct destinations as navigations', () => {
    const state = createNavigationState();

    expect(registerNavigation(state, '/watch?v=a')).toBe(true);
    // Duplicate events for the same page are ignored.
    expect(registerNavigation(state, '/watch?v=a')).toBe(false);
    expect(registerNavigation(state, '/watch?v=a')).toBe(false);
    expect(state.token).toBe(1);

    expect(registerNavigation(state, '/watch?v=b')).toBe(true);
    expect(state.token).toBe(2);

    // Returning to a previously seen page is still a distinct navigation.
    expect(registerNavigation(state, '/watch?v=a')).toBe(true);
    expect(state.token).toBe(3);
  });

  it('ignores null keys', () => {
    const state = createNavigationState();
    expect(registerNavigation(state, null)).toBe(false);
    expect(state.token).toBe(0);
  });
});

describe('shouldShowGate', () => {
  it('never shows when disabled', () => {
    expect(
      shouldShowGate({ enabled: false, token: 2, authorizedToken: null }),
    ).toBe(false);
  });

  it('shows when the current navigation is not authorized', () => {
    expect(
      shouldShowGate({ enabled: true, token: 1, authorizedToken: null }),
    ).toBe(true);
    expect(
      shouldShowGate({ enabled: true, token: 2, authorizedToken: 1 }),
    ).toBe(true);
  });

  it('hides once the current navigation has been authorized', () => {
    expect(
      shouldShowGate({ enabled: true, token: 3, authorizedToken: 3 }),
    ).toBe(false);
  });
});
