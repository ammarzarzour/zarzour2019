# Zarzour Soft — independent deployment runbook

This document covers the **standalone frontend preview**, not a production CRM, payment processor, or backend. Zarzour Soft remains a separate technology division and must not depend on Zarzour Travel's runtime, authentication, database credentials, or domain paths.

## Build and verify (Node.js 22)

From the repository root:

```sh
node --test scripts/build-soft-standalone.test.mjs
node --test scripts/test-soft-spaced-attributes.mjs
node scripts/build-soft-standalone.mjs
```

The deployable directory is `dist/zarzour-soft/`. It must contain **exactly** these seven top-level files: `index.html`, `brief.html`, `brief.mjs`, `brief-model.mjs`, `projects.html`, `projects.mjs`, `projects-model.mjs`. Do not deploy the parent travel site or its scripts as part of this package.

The dedicated [Zarzour Soft workflow](../../.github/workflows/soft-standalone.yml) runs the tests, builds the package, verifies the seven files against the checked-in source, and uploads the `zarzour-soft-standalone` artifact. A workflow definition is **not** evidence of a successful run; check the actual run conclusion and artifact before deploying.

## Deploy independently

1. Provision a **separate static site** (a separate hosting project, site, or repository) with its own deployment permissions. Do not change the existing Zarzour Travel site to make this work.
2. Set the published root to the **contents** of `dist/zarzour-soft/`, not the repository root or `docs/`. Preserve filenames and relative links.
3. Use HTTPS. Verify the homepage, `brief.html`, and `projects.html` on the independent URL, including direct refreshes.
4. Test Arabic and English, RTL/LTR switching, device-language preference on a fresh browser profile, and persistence of a manually selected language.
5. Check browser network requests: the preview must not rely on Zarzour Travel assets, APIs, authentication, or Supabase credentials. Do not add real customer data.
6. Record the deployed URL, exact Git commit, CI run URL, artifact identity, and date in the release notes **after** checking them. Do not claim a successful production deployment based only on a build.

## Operational boundaries

- The preview is static and local-only; it does **not** establish a production backend, access control, accounting, payments, customer records, or service-level guarantees.
- Never embed Supabase service-role keys, secrets, or personal records in static files. A future backend needs its own authorization design, tenant separation, and reviewed RLS policies.
- Keep Zarzour Soft's bilingual branding visible while separating hosting, deploy credentials, runtime dependencies, and administrative access from Zarzour Travel.
- Deployment rollback: retain the previously verified artifact and restore it through the independent hosting provider's normal release mechanism; do not delete travel assets or databases.
