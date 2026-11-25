// Background jobs on Cloudflare Queues: the consumer re-fetches calendars whose source was down
// (retrying with backoff), and the every-minute cron hands AnyList work to the queue.
import { createExecutionContext, createMessageBatch, env, getQueueResult, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import worker from '../../src/worker.js';
import { familyOwner, fakeGoogle } from './helpers.js';

let sites = {};
beforeAll(async () => {
  const spy = await fakeGoogle();
  const google = spy.getMockImplementation();
  spy.mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    return sites[url] ? Promise.resolve(sites[url]()) : google(input, init);
  });
});
beforeEach(() => { sites = {}; });

const ICS = summary => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:1', `SUMMARY:${summary}`, 'DTSTART:20261020T140000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const FEED = 'https://cal.example/kids.ics';

async function familyWithFeed() {
  const owner = await familyOwner();
  await owner.put('/api/board', { baseVersion: 0, data: { icalFeeds: [{ id: 'kids', url: FEED }] } });
  const { family } = (await owner.get('/api/session')).data;
  return { owner, fid: family.id };
}

/** Runs the queue consumer on one message and reports what happened to it. */
async function consume(body, attempts = 1) {
  const batch = createMessageBatch('calendora-jobs', [{ id: 'm1', timestamp: new Date(), attempts, body }]);
  const ctx = createExecutionContext();
  await worker.queue(batch, env, ctx);
  await waitOnExecutionContext(ctx);
  return getQueueResult(batch, ctx);
}

/** The delay the consumer asks for when it retries a message on its nth attempt. */
async function retryDelay(body, attempts) {
  let delay = null, acked = false;
  const msg = { id: 'm1', timestamp: new Date(), attempts, body, ack: () => { acked = true; }, retry: o => { delay = o.delaySeconds; } };
  await worker.queue({ queue: 'calendora-jobs', messages: [msg] }, env);
  return acked ? 'acked' : delay;
}

describe('calendar re-fetch jobs', () => {
  test('when the source is back, the saved copy is refreshed and the message is acknowledged', async () => {
    const { owner, fid } = await familyWithFeed();
    sites[FEED] = () => new Response(ICS('Old'));
    await owner.get('/api/ical?feed=kids&fresh=1'); // first good copy

    sites[FEED] = () => new Response(ICS('New'));
    const result = await consume({ kind: 'ical', fid, feed: 'kids' });
    expect(result.explicitAcks).toEqual(['m1']);
    sites[FEED] = () => new Response('down', { status: 503 });
    const served = await owner.get('/api/ical?feed=kids&fresh=1');
    expect(served.headers.get('X-Snapshot-At')).toBeTruthy(); // the saved copy …
    expect(served.data).toContain('SUMMARY:New'); // … is the one the job fetched
  });

  test('while the source is still down, the job is retried with exponential backoff', async () => {
    const { fid } = await familyWithFeed();
    sites[FEED] = () => new Response('down', { status: 503 });
    const job = { kind: 'ical', fid, feed: 'kids' };
    expect((await consume(job)).retryMessages).toEqual([{ msgId: 'm1' }]);
    expect(await retryDelay(job, 1)).toBe(30);
    expect(await retryDelay(job, 4)).toBe(240);
    expect(await retryDelay(job, 20)).toBe(3600); // capped at an hour
  });

  test('a feed the family removed is dropped, not retried', async () => {
    const { fid } = await familyWithFeed();
    const result = await consume({ kind: 'ical', fid, feed: 'gone' });
    expect(result.explicitAcks).toEqual(['m1']);
    expect(result.retryMessages).toEqual([]);
  });
});

describe('cron', () => {
  test('hands AnyList work to the queue instead of doing it inline', async () => {
    const owner = await familyOwner();
    const { family } = (await owner.get('/api/session')).data;
    await env.DB.prepare("UPDATE families SET anylist = '{}' WHERE id = ?").bind(family.id).run(); // AnyList set up
    const sent = [];
    const jobs = { send: async () => {}, sendBatch: async msgs => { sent.push(...msgs); } };
    const ctx = createExecutionContext();
    await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() }, { ...env, JOBS: jobs }, ctx);
    await waitOnExecutionContext(ctx);
    expect(sent).toContainEqual({ body: { kind: 'anylist', fid: family.id } });
    expect(sent.every(m => m.body.kind === 'anylist')).toBe(true);
  });
});
