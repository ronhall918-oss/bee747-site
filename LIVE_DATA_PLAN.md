# bee747.com live data — how the panel gets its numbers

Decided 2026-11-03 (Path B): the site is one Cloudflare Worker that serves the
static pages **and** a single JSON endpoint. The Pi publishes a snapshot to that
endpoint; the page polls it. No Firebase on the public site, no public API key,
nothing in the app's Firestore rules changes.

```
Pi 5                                  Cloudflare                        Browser
site_publisher.py ──PUT /api/apiary──► Worker (src/worker.js) ──► KV "apiary"
 every 120 s, only on change            bearer token checked            │
                                                                        ▼
                                        GET /api/apiary ◄──── page polls every 60 s
                                        (public, cached 30 s)
```

## The pieces

| Piece | Where | Job |
|-|-|-|
| `site_publisher.py` | `Pi5_Hive_Monitor/` → `/home/ronhall918/` on the Pi | Reads the tail of `hive_data.csv` and `garden_wx.csv`, builds the snapshot, PUTs it when it changes |
| `site_publisher.json` | Pi home dir (example in `Pi5_Hive_Monitor/site_publisher.example.json`) | hive_id → hive number + public name; which scales to hide |
| `.bee747_token` | Pi home dir, `chmod 600` | The bearer token, 32 random bytes hex |
| `site-publisher.service` | `/etc/systemd/system/` | Runs the publisher at boot, restarts on failure |
| `src/worker.js` | this repo | `/api/apiary` GET (public) and PUT (token); everything else is the static site |
| `wrangler.jsonc` | this repo | Worker name, assets directory, KV binding, custom domains |
| `PUBLISH_TOKEN` | Cloudflare secret on the Worker | Must equal the Pi's token |

## Snapshot shape (INTERFACE_CONTRACTS.md Link 6, schema 1)

```json
{
  "schema": 1,
  "updated": "2026-11-03T19:15:29-05:00",
  "hives": {
    "1": { "name": "Bee747",       "temp_f": 75.9, "humidity": null, "weight_lb": 111.3, "ts": "2026-11-03T19:07:31-05:00" },
    "4": { "name": "Little Orphan Annie", "temp_f": 77.8, "humidity": 78, "weight_lb": null, "ts": "2026-11-03T19:13:18-05:00" }
  },
  "weather": { "oat_f": 69.9, "humidity": 80, "baro_hpa": 993.5, "ts": "2026-11-03T19:10:03-05:00" }
}
```

- Keys under `hives` are the **public hive number** (the box in the yard), not
  the hive_id a node transmits. The publisher's config does that mapping.
- Everything the Pi sends onward is **°F** (CLAUDE.md invariant). The page never converts.
- `null` means "no usable reading": the `-99` sentinel, a negative weight, or a
  scale the journal says not to trust. The page draws that gauge dimmed with
  "NO SENSOR"; a hive silent for more than 90 min gets a striped "NO RPT" flag.
- `updated` is the newest `ts` in the snapshot, not the wall clock, so an
  unchanged snapshot hashes the same and isn't re-sent.
- Bump `schema` on any shape change and update this file and Link 6 together.

## Write budget (free plan)

Workers KV allows 1,000 writes/day free. The publisher sends only when the
snapshot changed and at most once per poll (120 s): hard cap 720/day, expected
400–500 with four hives plus weather. Reads are 100,000/day; the page polls
once a minute per open tab and the browser caches each answer 30 s.

## Local test (done 2026-11-03)

`npm run dev` in this folder runs the Worker with a local KV and the token from
`.dev.vars`. Against it: GET before any publish → 503; wrong token → 401; bad
body → 400; `site_publisher.py --once` with the Pi's real CSV tails → 204; GET
→ the snapshot with `Cache-Control: public, max-age=30`; the page flipped from
"Sample readings" to "Live".
