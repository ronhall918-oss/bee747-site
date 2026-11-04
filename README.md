# bee747.com — site source

The public site for Bee 747 Apiaries: the apiary, the honey, a live panel from
the hive monitor, and the farm gallery. One Cloudflare Worker serves the static
pages from `public/` and answers `/api/apiary` for the live panel.

```
Bee747/site/
├── public/
│   ├── index.html      the whole site (CSS + JS inline)
│   └── img/            web-sized copies of the photos in ../Bee Photos, ../Farm Photos
├── src/worker.js       /api/apiary (GET public, PUT with token); everything else → public/
├── wrangler.jsonc      Worker config: assets dir, KV binding, custom domains
├── package.json        wrangler as the only dependency; npm run dev / deploy
├── .dev.vars.example   local-dev token template (copy to .dev.vars, never commit)
├── LIVE_DATA_PLAN.md   how the live panel gets its numbers (Pi publisher ↔ Worker ↔ page)
└── README.md
```

## Design notes

- Palette, type, and motifs come from the honey label: label navy `#1b2440`,
  gold leaf `#c9962b`, parchment `#eee3c6`, a honeycomb behind the live panel,
  and the winged wordmark. Type: Barlow Condensed (headings), Lora (body),
  IBM Plex Mono (instrument readouts). Google Fonts.
- The live panel is drawn as 747-100 style round gauges (SVG): 270° scale,
  numerals at the majors, drum readout, striped "NO RPT" flag on a silent hive,
  dimmed "NO SENSOR" on a reading the hive can't make.
- The forage strip is ordered by the month each photo was taken.
- Dark mode follows the viewer's OS setting.

## Copy to check before it goes public

Search `public/index.html` for `RON:` comments: the swarm story in the Honey
section, and the contact address (`hello@bee747.com` is right once Email
Routing exists).

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Opens on http://localhost:8787 with a local KV and the token from `.dev.vars`.
To feed it real numbers, run the Pi publisher against it (see LIVE_DATA_PLAN.md).

## Going live (free plan throughout)

Cloudflare needs your login for the one-time setup, so these run in your own
terminal from this folder:

1. `npx wrangler login`
2. `npx wrangler kv namespace create LIVE` → paste the printed `id` into
   `wrangler.jsonc`.
3. `npx wrangler secret put PUBLISH_TOKEN` → paste the token that lives in
   `/home/ronhall918/.bee747_token` on the Pi.
4. `npx wrangler deploy` → the Worker goes live on `bee747.workers.dev`, and,
   because the domain is on this Cloudflare account, on `bee747.com` and
   `www.bee747.com` (the `routes` in `wrangler.jsonc` create the DNS records and
   certificate).

### Deploy on push (GitHub)

Once it works by hand: Cloudflare dashboard → Workers & Pages → the `bee747`
Worker → Settings → Build → connect the GitHub repo. Build command empty, deploy
command `npx wrangler deploy`. Every push to `main` redeploys; pull requests get
preview URLs. The KV id and secret are already on the Worker, so the repo holds
no secrets.

### Pi side

See `Pi5_Hive_Monitor/site_publisher.py` (header comment) and
`site-publisher.service` for the install steps.
