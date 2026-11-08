# Zarzour Travel

Bilingual (Arabic/English) public preview for **Zarzour Travel, Tourism, Hajj & Umrah**.

## Current public preview

- Responsive landing page with Arabic RTL and English LTR language toggle.
- Travel, visas, Hajj and Umrah, Syrian tourism, partnership and operations sections.
- Separate Zarzour Soft product presentation at `docs/soft/`.
- No bookings or payments are enabled.
- Admin portal and database access remain closed while authentication and access policies are being prepared.

## GitHub Pages

The site is deployed from the `docs/` directory by `.github/workflows/zarzour-pages.yml`. The workflow enables GitHub Pages and deploys on pushes to `master`.

Current project page URL (before repository rename):  
https://ammarzarzour.github.io/zarzour2019/

After renaming the repository to `zarzour-travel`, the expected project page URL is:  
https://ammarzarzour.github.io/zarzour-travel/

## Supabase

The dedicated project is **Zarzour Travel & Zarzour Soft**. Keep client-side code limited to publishable keys; never commit service-role or secret keys. Add authentication and row-level access policies before enabling any customer, pilgrim, contract or accounting data in a public client.

## Project boundaries

Zarzour Travel and Zarzour Soft are developed independently from Maison She Bride and Sanad Syria.
