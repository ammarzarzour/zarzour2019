# Zarzour Travel

Bilingual (Arabic/English) public preview for **Zarzour Travel, Tourism, Hajj & Umrah**.

## Current public preview

- Responsive landing page with Arabic RTL and English LTR language toggle.
- Travel, visas, Hajj and Umrah, Syrian tourism, partnership and operations sections.
- Separate Zarzour Soft product presentation at `docs/soft/`.
- Local demo registers cover bookings, visas, customers, campaigns, pilgrim groups, contracts, guarantees, partners, directory, commissions and accounting. No real booking submission or payments are enabled.
- Admin portal and database access remain closed while authentication and access policies are being prepared.

## GitHub Pages

The deployment workflow publishes `docs/` on pushes to `master`, after validation and module tests pass. GitHub Pages is active at the current project URL below.

Current project page URL (before repository rename):  
https://ammarzarzour.github.io/zarzour2019/

After renaming the repository to `zarzour-travel`, the expected project page URL is:  
https://ammarzarzour.github.io/zarzour-travel/

## Supabase

The dedicated project is **Zarzour Travel & Zarzour Soft**. Keep client-side code limited to publishable keys; never commit service-role or secret keys. Add authentication and row-level access policies before enabling any customer, pilgrim, contract or accounting data in a public client.

## Project boundaries

Zarzour Travel and Zarzour Soft are developed independently from Maison She Bride and Sanad Syria.


## Trip planning tool

`docs/request.html` provides an Arabic/English trip brief for travel, tourism, visas,
Hajj and Umrah. It validates future dates and group sizes, allows review, text download
and printing. It does not submit requests or store visitor entries. A reviewed summary
is invalidated when the form changes. No booking or payment is created.

## Release checks

```sh
node scripts/check-static-site.mjs
node --test scripts/request.test.mjs
node --check docs/request.mjs
```

Both validation and Pages workflows run trip-planning tests. The Pages job validates
before uploading. Repository rename remains pending. Keep the current URL until redirects and deployment paths are verified.

## Independent Soft deployment

`docs/soft/index.html` is self-contained, with no shared scripts, Travel data access,
or required navigation to the Travel application. Publish that directory as its own
static site when a separate Soft host/repository is available. This does not yet
establish a separate backend or a separate GitHub repository.

## Portable Zarzour Soft release package

Run `node scripts/build-soft-standalone.mjs` to assemble an allowlisted,
seven-file static release at `dist/zarzour-soft/`. Run
`node --test scripts/build-soft-standalone.test.mjs` to test the isolation
rules. The builder rejects parent-relative/absolute/external navigation and
module dependencies outside the Soft package; it never copies Travel assets
or touches customer data. Deploy the **contents** of that output directory
to a separate Soft hosting root when available. This prepares portable
hosting but does not create a new repository, domain, backend or deployment,
and does not enable real project submission or payments.

## Trip date input hardening (2026-11-18)

The trip brief validator accepts departure and optional return dates only as real
`YYYY-MM-DD` strings. Malformed JSON values (numbers, arrays, objects, booleans)
are rejected with field errors rather than causing a JavaScript exception.
Regression coverage: `node --test scripts/request.test.mjs`. This is a local
planning preview only; it does not submit bookings or process payments.

## Offline traveler return tracking rules (2026-11-18)

`scripts/return-tracking.mjs` provides pure functions to validate expected/actual return dates, flag overdue groups for review, and validate explicit status transitions (`planned`, `departed`, `return_due`, `follow_up`, `returned`). It does **not** store traveler information, automatically change statuses, contact travelers, connect to Supabase, or perform financial actions. A late return is only a suggested status until an authorized operator confirms it. Tests run via `node --test scripts/request.test.mjs` in the existing validation path, or individually via `node --test scripts/return-tracking.test.mjs`. This is a preparatory domain module, **not** a live return monitoring system. Production integration requires authenticated operators, approved RLS policies, an audit trail, and explicit consent/permissions before any real records are used.

## Offline return queue summary (2026-11-18)

`summarizeReturnQueue(records, today)` in `scripts/return-tracking.mjs` provides
an **offline, read-only** aggregate for a future operator dashboard. It returns
counts by state, overdue count and review count; it does not return names,
identifiers, or source records. The entire summary fails if any record is
invalid, rather than silently omitting records. The caller must provide an
ISO calendar date and an array of status/date records. The function does not
persist data, authenticate staff, issue alerts or make status changes.
Run `node --test scripts/return-tracking.test.mjs` to check the new behavior.
Do not connect real traveler data before approved authentication, RLS and
audit logging are implemented and tested.

## Offline return deadline overview (2026-11-21)

`summarizeReturnDeadlines(records, today)` in `scripts/return-tracking.mjs` produces identity-free counts of active trips that are overdue, due today, due within the next seven UTC calendar days, or due later. Planned and completed trips are excluded. Invalid records reject the entire batch. This is a pure, read-only planning helper, not an alert service or a production traveler tracker; it never stores personal data or changes a booking/status. Tests: `node --test scripts/return-tracking.test.mjs`. Live use still requires operator authentication, approved RLS, audit logging, and privacy review.

## Return tracking dashboard sample

The Travel control center (`docs/dashboard.html`) now shows a separate bilingual return-tracking panel using seven fixed fictional groups and an editable review date. It displays deadline and escalation counts through the shared `docs/return-tracking.mjs` rules. The existing `scripts/return-tracking.mjs` entry point re-exports those rules; run `node --test scripts/return-tracking.test.mjs`. Sample metrics are not included in the local register totals. The panel never reads traveler records, sends alerts, writes data, or performs payments. It is not a production tracker. Authentication, approved access policies and audit logging are still prerequisites for live integration.
