# Contributing

Small repo, small rules.

## What this tool is for
A quick, call-friendly calculator so agents can explain April 2026 bill increases (before/after/diff) without doing mental maths live.

## What this tool is not for
- Replacing Lighthouse
- Implementing customer cohort/exemption logic
- Embedding long policy content in the UI

## How to contribute
1. Create a branch
2. Make the smallest change that solves the problem
3. Test the example calculations listed in `AGENTS.md`
4. Update:
   - `VERSION`
   - `CHANGELOG.md`
5. Open a PR with:
   - What changed
   - Why it changed
   - Screenshots if the UI changed (optional but helpful)

## Code style
- No dependencies
- Vanilla JS
- Pence-safe integer maths
- British English
