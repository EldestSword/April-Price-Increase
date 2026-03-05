# Security Policy

This is an internal-style static tool. There is no authentication, no backend, and no customer data storage by design.

## Reporting a vulnerability
If you discover a security issue (e.g. XSS vector, unsafe clipboard behaviour, accidental storage of sensitive data):
- Raise an internal ticket, or
- Create a private security issue in the repo (if supported), or
- Contact the repo owner/maintainers.

## Scope
- `index.html`
- `assets/styles.css`
- `assets/app.js`
- Repo workflow files (if any)

## Notes
- No backend and no auth surface are present.
- Avoid storing sensitive customer data in `localStorage`.
- Fonts and other assets are static local files.

Please do not publicly disclose security issues without giving maintainers time to respond.
