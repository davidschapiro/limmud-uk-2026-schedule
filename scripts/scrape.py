#!/usr/bin/env python3
"""Download the Limmud Festival programme from events.limmud.org and write public/data.json.

Usage: python scripts/scrape.py [output_path]

Sources (all public pages):
  - print view per day:    /programme/print/YYYY-MM-DD/   -> order, time, title, presenters, room
  - timeslot pages:        /programme/timeslot/<slug>/<id>/ -> session descriptions
  - all presenters:        /programme/presenters/all/      -> bios and session lists

The file is only rewritten when the programme content actually changed, so the
nightly GitHub Action doesn't create empty commits.
"""
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

BASE = "https://events.limmud.org"
FESTIVAL = "limmud-festival-2026"
DATES = [f"2026-12-{d}" for d in range(25, 31)]
UA = "limmud-programme-browser/1.0 (personal festival planner; nightly refresh)"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "public" / "data.json"


def get(path: str) -> BeautifulSoup:
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                html = r.read().decode("utf-8")
            time.sleep(0.3)  # be gentle with a volunteer-run server
            return BeautifulSoup(html, "html.parser")
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                raise RuntimeError(f"failed to fetch {path}: {e}") from e
            time.sleep(3)


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def scrape() -> dict:
    sessions, order, days, timeslots = {}, [], [], set()
    for date in DATES:
        soup = get(f"/{FESTIVAL}/programme/print/{date}/")
        h1 = soup.find("h1")
        label = h1.get_text("\n").split("\n")[-1].strip() if h1 else date
        days.append({"date": date, "label": label})
        for tbl in soup.select("table.timeslot"):
            t = clean(tbl.select_one("tr.timeslot-header").get_text())
            for tr in tbl.select("tr.session"):
                a = tr.select_one("td.title a")
                href = a["href"]
                sid = href.split("#")[-1]
                timeslots.add(href.split("#")[0])
                room = tr.select_one("td.room")
                sessions[sid] = {
                    "id": sid, "date": date, "time": t, "title": clean(a.get_text()),
                    "room": clean(room.get_text()) if room else "",
                    "presenters": [pa["href"].split("#")[-1] for pa in tr.select("td.presenters a")],
                    "url": BASE + href, "desc": "",
                }
                order.append(sid)

    for path in sorted(timeslots):
        soup = get(path)
        for sn in soup.select("div.session-snippet"):
            h = sn.select_one("h4.session-title")
            sid = h.get("id") if h else None
            if sid in sessions:
                d = sn.select_one("p.description")
                sessions[sid]["desc"] = clean(d.get_text()) if d else ""

    presenters = {}
    soup = get(f"/{FESTIVAL}/programme/presenters/all/")
    for h2 in soup.select("h2.presenter-heading"):
        pid = h2["id"]
        rows = h2.find_parent("table").find_all("tr", recursive=False)
        body = rows[1].find_all("td", recursive=False)[1]
        bio = [clean(p.get_text()) for p in body.find_all("p", recursive=False)]
        presenters[pid] = {
            "id": pid, "name": clean(h2.get_text()), "bio": "\n\n".join(x for x in bio if x),
            "sessions": [a["href"].split("#")[-1] for a in body.select("table.presenter-sessions a")],
        }

    if len(sessions) < 50 or len(presenters) < 20:
        raise RuntimeError(f"suspiciously small result ({len(sessions)} sessions, {len(presenters)} presenters); not writing")
    return {"days": days, "sessions": [sessions[i] for i in order], "presenters": presenters}


def main() -> None:
    new = scrape()
    if OUT.exists():
        old = json.loads(OUT.read_text(encoding="utf-8"))
        old.pop("fetched", None)
        if old == new:
            print("programme unchanged")
            return
    new["fetched"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    OUT.write_text(json.dumps(new, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT}: {len(new['sessions'])} sessions, {len(new['presenters'])} presenters")


if __name__ == "__main__":
    main()
