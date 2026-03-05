# April 2026 Bill Increase Explainer

A static, call-friendly HTML tool that helps agents explain **how much a customer’s monthly bill will increase** from April 2026.

It is intentionally minimal and call-focused: enter the customer’s current charges, pick service types, and the tool calculates before/after totals and a short explanation to read back.

## What’s in this repo

- `index.html` — app markup and layout shell
- `assets/styles.css` — app styling
- `assets/app.js` — calculator logic, LSR import, rendering, and persistence
- `assets/fonts/` — place OnAir `.woff2` files here locally (not committed unless approved)
- `assets/images/` — optional static image assets
- `README.md` — this file
- `CHANGELOG.md` — version history
- `AGENTS.md` — instructions for Codex/automated edits

LSR import depends on SheetJS/XLSX loaded via CDN before `assets/app.js`.

## Key features

- Multi-line basket calculator (service rows)
- Per-row **before/after/diff** (unit and totals)
- Total **before/after/diff**
- “Copy explanation” button (clipboard + toast)
- Pence-safe maths (integers internally)
- Static app with no build tooling

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

No build tooling required.

1. Download/clone the repo
2. For best compatibility, serve the folder with a simple static server (for example `python -m http.server`) and open the local URL
3. You can also open `index.html` directly, but some browsers may restrict font loading in `file://` mode

## Deploying

Any static hosting works (GitHub Pages, SharePoint, internal web server, etc.).

For GitHub Pages (basic approach):
- Keep `index.html` at repo root
- Commit `assets/` alongside it
- Enable Pages in repo settings (Deploy from branch)

## Updating the rules

Rules live in the `SERVICE_TYPES` config inside `assets/app.js`.

- Flat uplift (+£12.50) is stored as **1250 pence**
- Percent uplifts are stored as integer multipliers over 1000:
  - 6.9% = 1069/1000
  - 10% = 1100/1000
  - 20% = 1200/1000
  - 25% = 1250/1000

## Versioning

This repo uses a lightweight pre‑1.0 versioning approach:
- `VERSION` file holds the current version string
- `CHANGELOG.md` records changes

See `AGENTS.md` for required change steps.

## Disclaimer

Estimation tool only. Confirm final charges and customer communications in Lighthouse/Daisy Central.
