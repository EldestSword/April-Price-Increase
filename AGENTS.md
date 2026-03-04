# AGENTS.md

Instructions for Codex (and any other automated assistant) working on this repo.

If you ignore these, the tool will become a complicated mess and nobody will use it. So please, for the sake of everyone’s blood pressure, follow them.

## Prime directive

Keep the tool **fast, minimal, and call-friendly**.

This repo is not a billing engine, not a policy wiki, and not a place to recreate Lighthouse in HTML. It’s a quick explainer tool that helps agents answer: “How much is my bill going up by?”

## Project constraints

- **Single-file app:** `index.html` contains HTML + CSS + vanilla JS.
- **No external libraries** (no CDN, no build step, no frameworks).
- **Offline-friendly:** must run by opening `index.html` in a browser.
- **British English** and **£** currency formatting.
- **Pence-safe maths:** do all calculations in **integer pence**.

## When you make changes

### 1) Update the version
This repo tracks the version in:
- `VERSION` (single line, e.g. `0.0.3`)
- `CHANGELOG.md` (add a new entry at the top)

Bump versions like:
- Patch: `0.0.x` for small fixes / UI tweaks
- Minor: `0.x.0` for meaningful new capabilities
- Major: `1.0.0` only if the tool is stable and “done”

### 2) Update the changelog
- Add a new section under a new version heading with today’s date.
- Use clear bullet points under **Added / Changed / Fixed / Removed**.

### 3) Keep rules explicit and central
Service rules must remain in one simple config structure inside `index.html` (currently `SERVICE_TYPES`).
If rules change, update that config and keep labels explicit.

### 4) Preserve the “quick call” flow
Do not reintroduce:
- MicroSME / Non‑MicroSME cohort logic
- pre/post 17 Jan 2025 complexity
- exit rights logic
- exemptions handling
- contract uplift inputs
- long FAQs/policy text
Unless the product owner explicitly requests it.

### 5) Manual test checklist (required)
Before you finalise changes, verify these examples (pence-safe):
- £10.00 WLR Line -> £22.50
- £10.00 base 6.9% -> £10.69
- £54.99 base 6.9% -> £58.78
- £379.99 leased line 10% -> £417.99
- Quantity multiplies correctly across unit and totals.

### 6) Don’t break the basics
The following must remain:
- “Lighthouse (source)” link in the header (opens in new tab)
- Add row / remove row / reset
- Totals before/after/diff
- Copy explanation (clipboard + small toast)
- Footer disclaimer

## Style rules (keep code maintainable)
- Prefer small, pure functions (parse/format/applyRule/recalc).
- Avoid cleverness. This is support tooling, not a coding interview.
- If you add UI, keep it accessible: sensible focus states, no alert() popups.

## Output format when responding as Codex
When returning changes, output the **full updated `index.html`** (not patches).
If you changed docs, output the full updated files too.
