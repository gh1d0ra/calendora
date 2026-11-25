// FamilyRoom: one Durable Object per family, the live "room" its signed-in screens connect to.
//
// D1 stays the source of truth for the board (see docs/decisions/0006-live-sync-durable-objects.md).
// The room only coordinates: when a save lands, the Worker tells the room the new version and the
// room tells every open screen, which then fetches the board. Messages carry version numbers, never
// family data, so a socket is only as useful as the session that can read /api/board.
//
// Uses the WebSocket Hibernation API: between messages the object is evicted from memory and the
// sockets stay open, so a family's idle wall tablets cost nothing. Keep-alive pings are answered
// by the runtime (setWebSocketAutoResponse) without waking the object.
import { DurableObject } from 'cloudflare:workers';

const MAX_SOCKETS = 50; // per family: plenty for tablets, phones and a TV

export class FamilyRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const url = new URL(request.url);

    // From the Worker (never from a browser): a save landed, or the family signed out every device.
    if (url.pathname === '/notify' && request.method === 'POST') {
      const msg = await request.json();
      if (msg.type === 'board') this.broadcast({ type: 'board', version: msg.version });
      if (msg.type === 'ical') this.broadcast({ type: 'ical', feed: msg.feed }); // a calendar came back after an outage
      if (msg.type === 'reauth') for (const ws of this.ctx.getWebSockets()) ws.close(4001, 'signed out');
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response('Too many screens', { status: 429 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ device: url.searchParams.get('device') === '1', since: Date.now() });
    this.presence();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage() { /* clients only send keep-alive pings, answered without waking us */ }
  webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) { /* already closed */ }
    this.presence(ws);
  }
  webSocketError(ws) { this.presence(ws); }

  /** Sends a message to every open screen (except one that is leaving). */
  broadcast(msg, except) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(text); } catch (e) { /* closing */ }
    }
  }

  /** How many screens are open right now, so each can show "3 screens live". */
  presence(leaving) {
    const open = this.ctx.getWebSockets().filter(ws => ws !== leaving);
    this.broadcast({ type: 'presence', screens: open.length, tablets: open.filter(ws => (ws.deserializeAttachment() || {}).device).length }, leaving);
  }
}

/** Tells a family's room something happened. Never fails the request that called it. */
export async function notifyRoom(env, fid, msg) {
  if (!env.ROOMS || !fid) return;
  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(fid));
    await stub.fetch('https://room/notify', { method: 'POST', body: JSON.stringify(msg) });
  } catch (e) { console.warn('room notify failed', fid, e && e.message); }
}
