# bollyLook

Saw an outfit in a Bollywood film or song? BollyLook finds it — or a budget dupe — on Myntra, AJIO and Amazon.in.

## Run it

Requires Node 20+ and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Then open http://localhost:3000.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for screenshot analysis |
| `PORT` | `3000` | Port to listen on |
| `RATE_LIMIT_PER_HOUR` | `20` | Analyses allowed per visitor IP per hour |
| `TRUST_PROXY` | unset | Set to `1` behind a reverse proxy so the rate limit uses `X-Forwarded-For` |
| `BOLLYLOOK_MODEL` | `claude-opus-5-5` | Claude model used for analysis |

## How it works

- `index.html` — the whole front end (no build step): trending-scene catalog, garment breakdowns, product cards, and the upload form.
- `server/server.js` — a dependency-free Node HTTP server. Serves the page, `GET /api/health`, and `POST /api/analyze`.
- `server/analyze.js` — sends the screenshot to Claude with a fixed prompt and a JSON schema (structured outputs), so the reply is always a well-formed list of garments with shop-ready search queries. Refusals fall back server-side to Anthropic's recommended model.

`POST /api/analyze` takes `{ image: <base64>, mediaType: "image/jpeg" | "image/png" | "image/webp", movie?, scene? }` (image up to 5 MB) and returns `{ summary, garments: [...] }`, or `{ error: <code> }` with a 4xx/5xx status.

The page detects where it's running: with the server it uses `/api/analyze`; inside a Claude artifact it uses the viewer's Claude account; opened as a plain file, uploads are disabled and the sample catalog still works.

## Still sample data

The trending scenes and the products under each garment are made up. Each product card opens a real search on the store.

## Next steps

- Real product feeds and affiliate links with click tracking.
- Hosting.
