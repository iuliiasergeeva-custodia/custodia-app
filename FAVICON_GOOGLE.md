# Favicon: tab vs Google

- **Browser tab:** The site uses `logo_tab.svg` so the icon in the tab stays sharp. No change needed.
- **Google search:** The small icon next to your result is chosen by Google. They work best with a **small PNG**, not SVG.

So: tab = SVG (already set). Google = add a PNG as below.

## Add a PNG for Google (optional but recommended)

Google prefers a **PNG** at **48×48** or **96×96** pixels for the search-result icon. One file is enough; 48×48 is fine.

**Steps:**
1. Export your Custodia logo as PNG at **48×48** pixels (Figma, Illustrator, or any SVG→PNG tool).
2. Save it as: `frontend/assets/images/favicon_48.png`
3. In `frontend/pages/landing/index.html`, inside `<head>`, add this **before** the existing favicon lines:
   ```html
   <link rel="icon" type="image/png" sizes="48x48" href="/frontend/assets/images/favicon_48.png">
   ```
4. Do the same in `frontend/index.html` if you want the root page to send the same icon to Google.

## 2. Ask Google to recrawl

- Open [Google Search Console](https://search.google.com/search-console).
- Add your property `https://custodia.world` if needed.
- Use **URL Inspection** → enter `https://custodia.world` → **Request indexing**.

## 3. Wait

Favicon updates in search can take **several days** after the page is recrawled.

## 4. Check what Google is using

- `https://www.google.com/s2/favicons?domain=custodia.world&sz=128`  
  This shows the favicon Google is using for your domain (may be cached).
