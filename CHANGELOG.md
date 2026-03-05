# Changelog

All notable changes to this project will be documented in this file.

This project loosely follows **Keep a Changelog** and **SemVer** (pre‑1.0).

## [0.0.14] - 2026-03-05
### Fixed
- Restored robust LSR importer:
  - Handles 4dp rates and converts to pence safely.
  - Preserves maintenance PINs (M0...) and alphanumeric account refs.
  - Expands scientific notation PINs (e.g. 1E+12).
  - Restores missing leading zeros on UK numbers.
  - Removes starter blank row before importing.

## [0.0.13] - 2026-03-05
### Fixed
- Restored missing LSR importer processing function after table refactor.
- LSR uploads now correctly populate service rows again.

## [0.0.12] - 2026-03-05
### Changed
- Removed per-unit columns from service table to simplify layout.
- Expanded service description column for better readability.

### Improved
- Customer explanation now includes the services contributing most to the increase.
- Removed row colour coding to reduce visual noise.

### Kept
- Largest increase row highlighting.

## [0.0.11] - 2026-03-04
### Added
- Sticky totals bar for easier viewing while scrolling.
- Row colour coding to visually highlight increases.
- Automatic highlight of the largest service increase.
- CRM-ready summary copy button.
- Customer-friendly explanation copy button.
- Version display in UI.
- Basic usage analytics stored locally.

### Improved
- Smart price formatting during input.
- Input validation to prevent unrealistic values.

## [0.0.10] - 2026-03-04
### Fixed
- Corrected LSR importer PIN parsing when Excel exports numbers in scientific notation (e.g. `1E+12`).
- PIN values are now expanded using string-safe logic instead of numeric conversion, preventing precision loss.

### Improved
- Added validation warning for PINs potentially corrupted by Excel numeric truncation.

## [0.0.9] - 2026-03-04
### Added
- LSR importer now detects and displays account number and company name from Live Service Reports.
- Automatic restoration of missing leading zeros for UK phone numbers.
- Automatic identification of mobile numbers starting with 07.
- Automatic detection of Maintenance services via M0 PIN prefix.

### Changed
- LSR importer now normalises Excel scientific-notation PIN values.

### Fixed
- Administrative services ("Charge for Paper Invoicing", "Non DD Payer", "Recurring Credit Card Charge") are now ignored during import.

### Removed
- None.

## [0.0.8] - 2026-03-04
### Added
- None.

### Changed
- None.

### Fixed
- LSR importer now supports Daisy "Live Services and Calls by Account" format.
- Correctly reads ServiceDescription, Quantity, and Pre-discount Total Rate columns.
- Handles Excel scientific notation PIN values.
- Filters out £0 administrative service rows.

### Removed
- None.

## [0.0.7] - 2026-03-04
### Added
- Basic LSR importer for automatic service population.
- Automatic service type detection from service description.

### Changed
- Added an Import LSR toolbar action with spreadsheet upload support for .xlsx, .xls, and .csv files.

### Fixed
- None.

### Removed
- None.

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
