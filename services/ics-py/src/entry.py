"""calendora-ics: a Python Worker that turns a family board into an iCalendar feed.

It has no public URL (workers_dev = false). The main Calendora Worker reaches it through a service binding
(env.ICS) after checking the feed's secret token, and sends it the board as JSON:
    POST /render  {"name": "The Smiths", "member": "m2" | null, "board": {...}}
"""
import json

from workers import Response, WorkerEntrypoint

from ics import render


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        if request.method != "POST":
            return Response("Use POST /render", status=405)
        try:
            body = json.loads(await request.text())
            text = render(body.get("board") or {}, name=body.get("name") or "Calendora", member=body.get("member"))
        except (ValueError, TypeError, AttributeError) as e:
            return Response(json.dumps({"error": f"bad board: {e}"}), status=400, headers={"Content-Type": "application/json"})
        return Response(text, headers={"Content-Type": "text/calendar; charset=utf-8"})
