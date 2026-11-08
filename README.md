# Zarzour Travel

Bilingual (Arabic/English) public preview for **Zarzour Travel, Tourism, Hajj & Umrah**.

## Current public preview

- Responsive landing page with Arabic RTL and English LTR language toggle.
- Travel, visas, Hajj and Umrah, Syrian tourism, partnership and operations sections.
- Separate Zarzour Soft product presentation at `docs/soft/`.
- No bookings or payments are enabled.
- Admin portal and database access remain closed while authentication and access policies are being prepared.

## GitHub Pages

The deployment workflow uses the `docs/` directory and deploys on pushes to `master`. GitHub Pages is not active yet: the first run cannot create the Pages site because the Actions token lacks permission for that setup step. Enable Pages once in the repository settings, then rerun the workflow and verify the published URL.

Current project page URL (before repository rename):  
https://ammarzarzour.github.io/zarzour2019/

After renaming the repository to `zarzour-travel`, the expected project page URL is:  
https://ammarzarzour.github.io/zarzour-travel/

## Supabase

The dedicated project is **Zarzour Travel & Zarzour Soft**. Keep client-side code limited to publishable keys; never commit service-role or secret keys. Add authentication and row-level access policies before enabling any customer, pilgrim, contract or accounting data in a public client.

## Project boundaries

Zarzour Travel and Zarzour Soft are developed independently from Maison She Bride and Sanad Syria.
