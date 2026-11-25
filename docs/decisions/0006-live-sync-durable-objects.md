# 0006 — Live updates through a Durable Object per family; D1 stays the source of truth

**Status:** accepted

## Context
Screens polled `/api/board` every 15 seconds ([0002](0002-board-as-one-versioned-document.md)). A chore ticked on a
phone took up to 15 seconds to show on the kitchen tablet. And the longer a screen's copy was stale, the more likely its
next save was to collide (409) and need a merge. The load test (`load/board.k6.js`) shows collisions rising quickly as
screens edit more often.

## Options
1. **Poll faster.** Simple, but it costs requests on every idle screen, all day.
2. **Move the board into a Durable Object** that holds the data and serialises every write. It's the strongest
   consistency, but it means migrating a live family's data out of D1. It also means rewriting the tested
   conflict and AnyList paths, and giving up `wrangler d1` tooling and backups.
3. **Durable Object as a coordination hub only.** D1 keeps the board. Each family gets a `FamilyRoom` object
   (`src/room.js`) that open screens hold a WebSocket to. After a successful save, the Worker tells the room the new
   version number, and the room tells every screen to fetch.

## Decision
Option 3.
- The object uses the **WebSocket Hibernation API**: between messages it's evicted from memory while the sockets stay
  open, and keep-alive pings are answered by the runtime (`setWebSocketAutoResponse`) without waking it. So idle wall
  tablets cost nothing.
- **Messages carry version numbers, never family data.** A socket is only as useful as the session that can read
  `/api/board`. That keeps the room out of the security model.
- The **same session rules** apply to `/api/live`. The room is chosen by the session's family id. "Sign out all
  devices" also closes every socket (code 4001).
- **Presence** ("live on 3 screens") comes free from `getWebSockets()`.
- **Polling stays as the safety net,** at once a minute while a socket is open and every 15 seconds otherwise. A missed
  message, a proxy that drops WebSockets, or an old browser still converge.
- The class is SQLite-backed (`new_sqlite_classes`), so it runs on Workers Free.

## Consequences
- Other screens update within about a second (`e2e/calendar.spec.mjs` checks it in under 5 seconds, where polling alone could take a minute).
- No data migration, and the conflict handling and its tests are unchanged.
- Two hops per change (a version push, then a board fetch) instead of pushing the data. That's fine at family scale, and it
  keeps data out of the socket.
- A removed member's open socket keeps receiving version numbers until it reconnects. It gets no data (see the
  threat model).
