# kareemelkhatib.com

The personal site of **Kareem Elkhatib** — electrical engineering student at
the University of Georgia, founder of Local Service Marketers, and wedding &
engagement photographer. Simple, professional, static HTML/CSS/JS — no build
step, deploys anywhere.

## Pages
| File | Purpose |
| --- | --- |
| `index.html` | Home — profile: photo, identity line, short bio, links |
| `resume.html` | Full resume in HTML + PDF download |
| `photography.html` | Embedded pic-time gallery (bykareem.pic-time.com) |
| `contact.html` | Email, phone, Instagram, LinkedIn |

## Project structure
```
index.html, resume.html, photography.html, contact.html
assets/
  Kareem-Elkhatib-Resume.pdf   (linked from resume.html — replace to update)
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
- **Resume**: edit `resume.html` for the on-page version AND replace
  `assets/Kareem-Elkhatib-Resume.pdf` so the download stays in sync.
- **Colors / fonts / spacing** are all CSS variables in `assets/css/tokens.css`.
  Change them in one place to retheme the whole site.
- **Profile photo**: replace the placeholder — see `assets/img/README.md`.

## The pic-time gallery
The live gallery is embedded on `photography.html` via pic-time's official
script + iframe (`bykareem.pic-time.com`). It loads its own content — nothing to
maintain here. To swap galleries, update the iframe `src`.

## Deploy
Upload the whole folder to any static host — your existing kareemelkhatib.com,
Netlify, Vercel, GitHub Pages, or Cloudflare Pages. No server or build required.

## Design notes
- White-primary with earth-tone accents (sand + a single bronze accent).
- Fraunces (display serif) + Hanken Grotesk (body), via Google Fonts.
- Restrained by design: a few deliberate moments (hero reveal, scroll fades)
  instead of constant motion.
- Respects `prefers-reduced-motion`.
