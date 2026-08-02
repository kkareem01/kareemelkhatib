# kareemelkhatib.com

The personal site of **Kareem Elkhatib** — electrical engineering student at
the University of Georgia and founder of Local Service Marketers. Simple,
professional, static HTML/CSS/JS — no build step, deploys anywhere.

## Pages
| File | Purpose |
| --- | --- |
| `index.html` | Home — profile: photo, identity line, short bio, links |
| `resume.html` | Embedded resume PDF viewer + download button |
| `contact.html` | Email, phone, Instagram, LinkedIn |

## Project structure
```
index.html, resume.html, contact.html
assets/
  Kareem-Elkhatib-Resume.pdf   (embedded + downloadable on resume.html — replace to update)
  css/  tokens.css (design variables) · styles.css (shared) · pages.css (page layouts)
  js/   nav.js (mobile menu) · reveal.js (scroll animations)
  img/  favicon.svg · drop profile.jpg here (see assets/img/README.md)
```

## Run locally
From this folder:
```bash
python3 -m http.server 8000
```
Then open <http://localhost:8000>. (Any static server works.)

## Editing content
- **Text** lives directly in the `.html` files — search for the section and edit.
- **Resume**: the page embeds `assets/Kareem-Elkhatib-Resume.pdf` directly —
  replace that one file to update both the viewer and the download.
- **Colors / fonts / spacing** are all CSS variables in `assets/css/tokens.css`.
  Change them in one place to retheme the whole site.
- **Profile photo**: replace the placeholder — see `assets/img/README.md`.

## Deploy
Upload the whole folder to any static host — your existing kareemelkhatib.com,
Netlify, Vercel, GitHub Pages, or Cloudflare Pages. No server or build required.

## Design notes
- White-primary with earth-tone accents (sand + a single bronze accent).
- Fraunces (display serif) + Hanken Grotesk (body), via Google Fonts.
- Restrained by design: a few deliberate moments (hero reveal, scroll fades)
  instead of constant motion.
- Respects `prefers-reduced-motion`.
