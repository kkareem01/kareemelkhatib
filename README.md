# kareemelkhatib.com

A premium, multi-page personal portfolio for **Kareem Elkhatib** — engineer,
founder, and wedding filmmaker. Static HTML/CSS/JS, no build step, deploys
anywhere.

## Pages
| File | Purpose |
| --- | --- |
| `index.html` | Home — hero, "what I do", three-discipline index |
| `about.html` | About + Education (UGA, engineering projects, skills) |
| `business.html` | Local Service Marketers + track record |
| `photography.html` | Wedding/engagement work + embedded pic-time gallery |
| `contact.html` | Email, phone, Instagram, LinkedIn |

## Project structure
```
index.html, about.html, business.html, photography.html, contact.html
assets/
  css/  tokens.css (design variables) · styles.css (shared) · pages.css (page layouts)
  js/   nav.js (mobile menu) · reveal.js (scroll animations)
  img/  drop real photos here (see assets/img/README.md)
```

## Run locally
From this folder:
```bash
python3 -m http.server 8000
```
Then open <http://localhost:8000>. (Any static server works.)

## Editing content
- **Text** lives directly in the `.html` files — search for the section and edit.
- **Colors / fonts / spacing** are all CSS variables in `assets/css/tokens.css`.
  Change them in one place to retheme the whole site.
- **Photos**: replace the placeholder blocks — see `assets/img/README.md`. Each
  placeholder is marked in the HTML with `<!-- TODO: replace with real image -->`.

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
- Restrained by design: a few deliberate moments (hero reveal, scroll fades,
  the hover-interactive discipline index) instead of constant motion.
- Respects `prefers-reduced-motion`.
