// Two test projects:
//   unit   — pure logic from lib/core.js, in Node
//   worker — the real Worker (src/worker.js) inside workerd with a local D1, via @cloudflare/vitest-plugin
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['test/unit/**/*.test.js'], environment: 'node' } },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.toml' },
            remoteBindings: false, // never talk to the real Cloudflare account (Workers AI, etc.) from tests
            miniflare: {
              bindings: { GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', OWNER_EMAILS: 'owner@example.com' },
            },
          }),
        ],
        test: { name: 'worker', include: ['test/worker/**/*.test.js'] },
      },
    ],
  },
});
