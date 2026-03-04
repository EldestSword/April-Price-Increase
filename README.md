# April 2026 Bill Increase Explainer

A single-file, offline-friendly HTML tool that helps agents explain **how much a customer’s monthly bill will increase** from April 2026.

It is intentionally minimal and call-focused: enter the customer’s current charges, pick service types, and the tool calculates before/after totals and a short explanation to read back.

## What’s in this repo

- `index.html` — the tool (HTML + CSS + vanilla JS in one file)
- `README.md` — this file
- `CHANGELOG.md` — version history (current: v0.0.3)
- `AGENTS.md` — instructions for Codex/automated edits
- Supporting repo hygiene files (`LICENSE`, `.editorconfig`, etc.)

## Key features

- Multi-line basket calculator (service rows)
- Per-row **before/after/diff** (unit and totals)
- Total **before/after/diff**
- “Copy explanation” button (clipboard + toast)
- Pence-safe maths (integers internally)
- No dependencies, no build step, no server required

## Pricing rules implemented (April 2026)

Base uplift (percentage-based items): **+6.9%**.

Overrides:
- **WLR Line (Single/Multi) – line only:** +£12.50 per line per month
- **ISDN2 / ISDN30 – per line:** +£12.50 per line per month
- **Maintenance:** +20%
- **Data Hosting (Co‑Location / Rack Space):** +25% (data hosting only, not hosted voice)
- **Leased Line connectivity:** +10%

Everything else uses base **+6.9%**.

## Run it locally

No tooling required.

1. Download/clone the repo
2. Open `index.html` in your browser

That’s it. Humans love unnecessary complexity, but this doesn’t.

## Deploying

Any static hosting works (GitHub Pages, SharePoint, internal web server, etc.), because it’s a single static file.

For GitHub Pages (basic approach):
- Put `index.html` in the repo root
- Enable Pages in repo settings (Deploy from branch)

## Updating the rules

Rules live in the `SERVICE_TYPES` config inside `index.html`.

- Flat uplift (+£12.50) is stored as **1250 pence**
- Percent uplifts are stored as integer multipliers over 1000:
  - 6.9% = 1069/1000
  - 10% = 1100/1000
  - 20% = 1200/1000
  - 25% = 1250/1000

## Versioning

This repo uses a lightweight pre‑1.0 versioning approach:
- `VERSION` file holds the current version string (e.g., `0.0.3`)
- `CHANGELOG.md` records changes

See `AGENTS.md` for the required steps when making changes.

## Disclaimer

Estimation tool only. Confirm final charges and customer communications in Lighthouse/Daisy Central.
