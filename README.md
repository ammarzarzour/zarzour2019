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
