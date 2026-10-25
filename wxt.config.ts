import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: ({ browser }) => ({
    name: 'AffirmGate',
    description:
      'An intentional-browsing gate that shows your personal reminder before you watch YouTube.',
    version: '0.1.0',
    // Minimum permissions only: local storage. The tab is closed via
    // `tabs.remove`, which does not require the "tabs" permission.
    permissions: ['storage'],
    host_permissions: ['*://*.youtube.com/*'],
    action: {
      default_title: 'AffirmGate settings',
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Stable ID keeps storage.local associated with the extension
              // across reloads in the same profile. Replace with your own AMO ID
              // before publishing.
              id: 'affirmgate@example.com',
              strict_min_version: '115.0',
              data_collection_permissions: {
                // AffirmGate collects nothing and sends nothing anywhere.
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
});
