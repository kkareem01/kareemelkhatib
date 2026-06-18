# Images

Drop your real photos in this folder and they'll replace the placeholder
blocks. Recommended files (filenames referenced in the HTML TODO comments):

| Filename | Used on | Suggested size | Notes |
| --- | --- | --- | --- |
| `hero.jpg` | `index.html` hero band | 2000×1100 (landscape) | Your strongest wide shot — wedding or portrait |
| `portrait.jpg` | `about.html` | 1200×1500 (portrait, 4:5) | A clean photo of you |
| `lsm.jpg` | `business.html` | 1200×1500 (portrait, 4:5) | Logo, dashboard, or a website you built |

## How to swap a placeholder for a real photo
In the relevant `.html` file, find the block that looks like:
```html
<!-- TODO: replace with real image → assets/img/hero.jpg -->
<div class="frame frame--placeholder" data-label="Hero image — replace"></div>
```
Replace it with:
```html
<div class="frame">
  <img src="assets/img/hero.jpg" alt="Describe the photo here" />
</div>
```
The `.frame` wrapper keeps the correct aspect ratio and rounding automatically.
Always write a short, descriptive `alt` for accessibility and SEO.

## Tips
- Export JPGs at ~80% quality; keep each under ~400 KB for fast loading.
- Use consistent color/tone across photos for a cohesive, premium feel.
