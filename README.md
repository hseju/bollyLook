# bollyLook

Saw an outfit in a Bollywood film or song? BollyLook finds it — or a budget dupe — on Myntra, AJIO and Amazon.in.

## Current state

`index.html` is the self-contained preview, copied from the BollyLook Preview artifact:

- **Trending scenes** — six made-up films with sample looks, broken down garment by garment.
- **Closest match / Dupes tabs** — sample products (made-up brands and prices); each card opens a real search on the store.
- **Upload a still** — analysis by Claude. This only works inside the Claude artifact runtime (`window.claude`); opened as a plain web page, the upload button is disabled and the sample catalog still works.

Open `index.html` in a browser to view it. No build step.

## Next steps

- Backend endpoint that calls the Claude API for image analysis, so uploads work on the real site.
- Real product feeds and affiliate links with click tracking.
- Hosting.
