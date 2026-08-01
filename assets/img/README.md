# Images

This folder holds `favicon.svg` (the browser-tab icon) and, once you add it,
your profile photo.

## The one photo the site needs

| Filename | Used on | Suggested size | Notes |
| --- | --- | --- | --- |
| `profile.jpg` | `index.html` hero | Square, ≥600×600 | A clean headshot — it's shown in a circle |

## How to swap the placeholder for your photo
In `index.html`, find:
```html
<!-- TODO: replace with real portrait → assets/img/profile.jpg -->
<div class="frame frame--placeholder frame--round" data-label="Profile"></div>
```
Replace it with:
```html
<div class="frame frame--round">
  <img src="assets/img/profile.jpg" alt="Kareem Elkhatib" />
</div>
```

## Tips
- Export JPGs at ~80% quality; keep it under ~400 KB for fast loading.
- Later nice-to-have: an `og.jpg` (1200×630) for link previews — then add the
  `og:image` meta tag where the HTML `TODO` comments mention it.
