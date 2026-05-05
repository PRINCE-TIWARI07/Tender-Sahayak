# Deploying CRPF Tender Upload Portal

This app is an Express server: static SPA at `/`, multipart uploads at **`POST /upload`**, eligibility at **`POST /evaluate`**, and a load-balancer probe at **`GET /health`**.

## Prerequisites

- **Node.js 22** (production: LTS-aligned).
- **`OPENAI_API_KEY`** stored as a secret in your host environment (needed for extracting eligibility criteria from tender text after PDF/image extraction).
- **Writable `./uploads`** directory (already created in Docker Compose / image).

## Automated tests

From the repo root:

```bash
npm ci
npm test
```

CI runs tests and a Docker image build when you push to `main` or `master` (`.github/workflows/ci.yml`).

## Option A — Docker Compose (recommended for VPS / internal hosting)

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`, `HOST=0.0.0.0` if exposing to the network.
2. Launch:

```bash
docker compose up --build -d
```

Open `http://<host>:3000`. Uploads persist in the named volume `tender_uploads`.

3. Operational checks:

- `curl -sf http://127.0.0.1:3000/health` → JSON `status: ok`
- Submit a tender + optional bidder JSON from the UI; confirm JSON responses match expectations.

For HTTPS in production, terminate TLS with **nginx**, **Caddy**, or **Traefik** in front of this service and set **`TRUST_PROXY=1`** if the app must see correct client IPs.

## Option B — Fly.io

1. Install the [Fly CLI](https://fly.io/docs/getting-started/).
2. Change `app` in `fly.toml` to your app name (`fly apps create <name>`).
3. Provide secrets:

```bash
fly secrets set OPENAI_API_KEY=sk-...
```

4. Deploy:

```bash
fly deploy
```

Fly probes `/health` as configured in `fly.toml`.

## Option C — Railway / Render / similar PaaS

- **Build**: Dockerfile (root) **or** `npm ci`, `npm start`.
- **Start command**: `node src/server.js` (default from `npm start`).
- **Port**: set from `PORT`; bind **`HOST=0.0.0.0`** in the dashboard.
- Add **`OPENAI_API_KEY`** as an environment secret.
- **Health check URL**: `/health`.

## Operational notes

- **Disk**: ephemeral filesystems reset on redeploy unless you attach a persistent volume mapped to `/app/uploads`.
- **OCR / PDF**: first OCR via `tesseract.js` may lazy-load WASM; allow cold-start time behind health checks with a grace period.
- **Concurrency**: OCR is serialized internally; high traffic may queue; scale out or offload uploads if needed.
