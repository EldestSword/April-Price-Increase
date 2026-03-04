# Changelog

All notable changes to this project will be documented in this file.

This project loosely follows **Keep a Changelog** and **SemVer** (pre‑1.0).

## [0.0.6] - 2026-03-04
### Added
- Added a dedicated disclaimer panel beneath Results to highlight estimate-only usage and operational checks before advising customers.

### Changed
- Updated the copied explanation text with a concise Checks section covering contract-term precedence, Daisy Central letter verification, and possible exclusions.
- Added clearer disclaimer wording that estimates only apply where increases are not already specified in the customer contract terms and to verify the customer letter in Daisy Central.

### Fixed
- None.

### Removed
- None.

## [0.0.5] - 2026-03-04
### Changed
- Increased the main layout container max width to 1500px so the service table area sits more centrally on wide screens.
- Centered the scrollable table wrapper with flex alignment while preserving horizontal scrolling behaviour and responsive layout.

## [0.0.4] - 2026-03-04
### Added
- New "Microsoft Products (Excluded – no increase)" service type that explicitly applies no April 2026 uplift.
- Optional "Service name / description" field per row.
- Duplicate row action for quickly copying service lines.
- Row persistence via localStorage with automatic restore on reload.
- Annual increase total box (monthly difference × 12).
- New "Copy table" action that copies a plain-text TSV table for CRM notes.

### Changed
- Explanation output is now multi-line and paste-ready, including totals, logic summary, Microsoft exclusion, CLI list, and concise row breakdowns.
- Price input now auto-formats to canonical GBP format on blur when valid.
- Difference total now uses subtle positive/zero/negative visual emphasis.
- Added inline comments explaining integer percent scaling as numerator/1000 for pence-safe maths.

### Fixed
- Maintained exact no-change behaviour for excluded products (Before == After and Diff == £0.00).

## [0.0.3] - 2026-03-04
### Added
- Per-row before/after/diff display (unit and totals).
- “Number/CLI” field as the first column per row.
- Improved UI styling (cards, sticky header, table polish) and a small “Copied” toast.

### Changed
- Streamlined the call flow so agents can see per-row changes without leaving the table.

## [0.0.2] - 2026-03-04
### Changed
- Simplified the tool to a fast “bill increase explainer” calculator.
- Removed customer cohort logic, exit rights, exemptions, and long policy text.
- Kept a single Lighthouse source link and a short disclaimer.
- Implemented a minimal 6-option service type model with base +6.9% assumption and overrides.

## [0.0.1] - 2026-03-04
### Added
- Initial version of the April 2026 price increase helper with broader policy coverage (later removed to keep the tool call-friendly).
