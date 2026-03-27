#!/usr/bin/env python3
"""
build_catalog.py

Fetches all MP3 track metadata from the MP3.com Rescue Barge collection
on Internet Archive and writes tracks.json for the radio app.

Usage:
    python build_catalog.py

Output:
    tracks.json  (written to current directory)

Requires: requests
    pip install requests
"""

import json
import time
import requests
from requests.utils import quote

IA_SEARCH   = "https://archive.org/advancedsearch.php"
IA_META     = "https://archive.org/metadata/{identifier}"
COLLECTION  = "mp3-com-rescue-barge"
OUTPUT_FILE = "tracks.json"


def get_collection_items(collection):
    items = []
    page = 1
    page_size = 100
    while True:
        params = {
            "q": f"collection:{collection}",
            "fl[]": "identifier",
            "rows": page_size,
            "page": page,
            "output": "json"
        }
        resp = requests.get(IA_SEARCH, params=params, timeout=30)
        resp.raise_for_status()
        docs = resp.json().get("response", {}).get("docs", [])
        if not docs:
            break
        items.extend(d["identifier"] for d in docs if "identifier" in d)
        print(f"  Page {page}: {len(docs)} items (total: {len(items)})")
        if len(docs) < page_size:
            break
        page += 1
        time.sleep(0.5)
    return items


def get_tracks_from_item(identifier):
    url  = IA_META.format(identifier=identifier)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    meta = resp.json()

    item_creator = meta.get("metadata", {}).get("creator", "")
    if isinstance(item_creator, list):
        item_creator = item_creator[0] if item_creator else ""

    tracks = []
    for f in meta.get("files", []):
        name = f.get("name", "")
        if not name.lower().endswith(".mp3"):
            continue
        title   = f.get("title") or name.replace(".mp3", "")
        creator = f.get("creator") or f.get("artist") or item_creator or "Unknown"
        if isinstance(creator, list):
            creator = creator[0] if creator else "Unknown"
        track_url = f"https://archive.org/download/{identifier}/{quote(name)}"
        tracks.append({
            "id":      f"{identifier}/{name}",
            "title":   title,
            "creator": creator,
            "item":    identifier,
            "url":     track_url
        })
    return tracks


def main():
    print(f"Fetching items from: {COLLECTION}")
    items = get_collection_items(COLLECTION)
    print(f"Found {len(items)} items.\n")

    all_tracks = []
    for i, identifier in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {identifier}")
        try:
            tracks = get_tracks_from_item(identifier)
            all_tracks.extend(tracks)
            print(f"  -> {len(tracks)} tracks (running total: {len(all_tracks)})")
        except Exception as e:
            print(f"  ERROR: {e}")
        time.sleep(0.3)

    print(f"\nWriting {len(all_tracks)} tracks to {OUTPUT_FILE} ...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(all_tracks, fh, ensure_ascii=False, indent=2)
    print("Done!")


if __name__ == "__main__":
    main()
