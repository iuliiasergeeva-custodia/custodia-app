# Favicon in Google Search Results

Google often shows your **favicon** (the small icon next to your site in search results). To improve the chance your Custodia logo appears:

## 1. Use a PNG for Google (recommended)

Google supports **PNG** favicons and tends to use them reliably. Your `logo_tab.svg` is very large; a small PNG works better.

**Steps:**
1. Export your logo as PNG at **48×48** and **96×96** pixels (e.g. from Figma/Illustrator or an SVG→PNG tool).
2. Save as:
   - `frontend/assets/images/favicon_48.png`
   - `frontend/assets/images/favicon_96.png`
3. In `frontend/pages/landing/index.html` (and other pages), add **before** the other favicon lines:
   ```html
   <link rel="icon" type="image/png" sizes="48x48" href="/frontend/assets/images/favicon_48.png">
   <link rel="icon" type="image/png" sizes="96x96" href="/frontend/assets/images/favicon_96.png">
   ```

## 2. Ask Google to recrawl

- Open [Google Search Console](https://search.google.com/search-console).
- Add your property `https://custodia.world` if needed.
- Use **URL Inspection** → enter `https://custodia.world` → **Request indexing**.

## 3. Wait

Favicon updates in search can take **several days** after the page is recrawled.

## 4. Check what Google is using

- `https://www.google.com/s2/favicons?domain=custodia.world&sz=128`  
  This shows the favicon Google is using for your domain (may be cached).
