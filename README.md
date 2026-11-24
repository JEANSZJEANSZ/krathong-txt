# ลอยกระทง.txt (krathong-txt)

A virtual Loy Krathong festival in ASCII. Build your krathong (9 bases, 3 leaf folds, 9 flowers in your colours, candles, incense, flags, a pinwheel, lanterns, fireflies and an accent colour), write a wish, light a candle, and float it on a shared live river with everyone else.

**Live site:** [https://krathong-txt.marqotone.space](https://krathong-txt.marqotone.space)

**Stack:** Svelte 5 + Vite + TypeScript, served by a Cloudflare Worker. The shared river is a Durable Object with the WebSocket Hibernation API. A server-side word filter blocks rude or spammy wishes.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`). The live river needs the Worker too:

```bash
npx wrangler dev
```

Other commands:

```bash
npm test           # share-link, protocol, sprite and moderation tests
npm run check      # TypeScript + svelte-check
npm run build      # production files go to dist/
```

## Deploy

Requires Wrangler, logged in to the Cloudflare account that owns `krathong-txt.marqotone.space`.

```bash
npm run deploy     # vite build && wrangler deploy
```
