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
              // Stand-in for the calendora-ics Python Worker (its own tests: services/ics-py/tests). It echoes what
              // the main Worker sent, so the tests can check the token, family and member handling.
              serviceBindings: {
                async ICS(request) {
                  const body = await request.json();
                  const titles = (body.board.events || []).map(e => `SUMMARY:${e.title}`).join('\r\n');
                  return new Response(`BEGIN:VCALENDAR\r\nX-WR-CALNAME:${body.name}\r\nX-MEMBER:${body.member || ''}\r\n${titles}\r\nEND:VCALENDAR\r\n`, { headers: { 'Content-Type': 'text/calendar' } });
                },
              },
            },
          }),
        ],
        test: { name: 'worker', include: ['test/worker/**/*.test.js'] },
      },
    ],
  },
});
