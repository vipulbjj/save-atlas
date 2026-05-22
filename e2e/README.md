# E2E tests

## Public flows (no credentials)

```bash
npm run test:e2e -- e2e/public-flows.spec.js
```

Runs against `https://save-atlas.vercel.app` by default. Override with `PLAYWRIGHT_BASE_URL`.

## Authenticated flows

Set credentials via environment variables (never commit passwords):

```bash
export PLAYWRIGHT_TEST_EMAIL="you@example.com"
export PLAYWRIGHT_TEST_PASSWORD="your-password"
npm run test:e2e -- e2e/authenticated-flows.spec.js
```

Tests sign-in, import page, dashboard, `?next=/import` redirect, forgot link, and a minimal ZIP import fixture.
