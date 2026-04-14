# Frontend Security Guide (Angular)

This project is currently frontend-only. The goal of this guide is to ensure the UI is prepared for secure backend integration without introducing backend dependencies.

## 1) Client-Side Validation and Sanitization

### What is already safe by default in Angular
- Template interpolations like `{{ value }}` are escaped by Angular.
- Avoid introducing `[innerHTML]` or `DomSanitizer.bypassSecurityTrust*` unless you have a strong reason and a strict allowlist.

### What has been added in this project
- Reactive form validators include:
  - Required, email format, trimmed minimum length, max length, and basic “no HTML-like input” checks.
  - Control-character rejection to prevent hidden/invisible payloads.
- Sanitization is applied on submit for booking and contact payloads:
  - Strips `<` and `>` and control characters, normalizes whitespace, trims, and caps length.
  - This is defense-in-depth only. Server-side validation remains mandatory.

Where:
- Utilities live in `src/app/shared/security/`:
  - `input-sanitizer.ts`
  - `security-validators.ts`

## 2) Secure Backend Integration Hooks (HTTP Patterns)

### Recommended pattern for POSTing JSON
- Use Angular `HttpClient` with typed DTOs.
- Prefer a thin API layer (`/core/api/…`) that:
  - Accepts a well-defined request type.
  - Sanitizes/normalizes again before sending.
  - Handles errors in one place (shared error handler/interceptor).

### Error handling without leaking details
- UI should show a generic message: “An error occurred. Please try again later.”
- Log details only in development. In production, avoid dumping request bodies, tokens, PII, or stack traces to the console.
- This project includes `SafeLoggerService` to reduce accidental leakage.

### HTTPS enforcement
Frontend-only HTTPS “enforcement” can be done, but hosting-level redirects are preferred.
- Preferred: enforce HTTPS at the CDN/hosting layer (301/308 redirect, HSTS).
- Optional frontend guard:
  - During app bootstrap, if `environment.production === true` and `location.protocol !== 'https:'`, redirect to the HTTPS origin.
  - Avoid redirecting in local development.

### API base URLs
- Keep all API origins in `environment.*.ts`.
- Never store secrets in environment files; assume anything shipped to the browser is public.

## 3) Handling Future Sensitive Data (Design Guidance)

### Data storage rules
- Do not store personal data in `localStorage` (high XSS impact). Prefer in-memory state.
- If persistence is required, store the minimum needed and consider short-lived storage with explicit user action.

### Database security (backend guidance)
- Always validate and sanitize on the server, regardless of client checks.
- Use parameterized queries or an ORM; never concatenate user strings into SQL.
- Apply allowlists for enums (service slug, frequency, subject).

### Encryption / careful handling candidates
- Email, phone, address, and any customer notes are PII.
- Encrypt at rest in the database (or use a managed service with encryption at rest).
- Use TLS in transit (HTTPS), and rotate any service keys regularly.

### Admin/auth structure (future)
- Use a dedicated auth provider (OIDC) or a secure, well-reviewed implementation.
- Prefer HttpOnly secure cookies for session tokens where possible.
- Add route guards for admin routes and server-side authorization checks.
- Separate “public booking” endpoints from “admin management” endpoints.

## 4) Preventive Measures (Bots, Abuse, Operational Safety)

### Rate limiting and bot protection
- Enforce server-side rate limiting per IP/user-agent/device fingerprint.
- Add bot mitigation for public forms (reCAPTCHA/hCaptcha/Turnstile) after backend integration.
- Consider an invisible honeypot field only as a secondary signal (server decides).

### Logging and telemetry
- Never log full form payloads, API keys, auth headers, or tokens.
- Redact PII in production logs.

## 5) External Keys and Third-Party Scripts

### Google Maps API key
- A browser Maps key is not a “secret”, but must be restricted:
  - Restrict by allowed HTTP referrers (your domains).
  - Limit enabled APIs to only what’s needed.
  - Monitor usage and set quotas.

### Content Security Policy (CSP)
- Best applied via hosting headers.
- When you add CSP, ensure it covers Google Maps usage and other third-party scripts safely.
