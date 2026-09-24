# Brandelier Assets & Images Structure

Place your uploaded image assets into these directories:

```
src/assets/images/
├── hero/         # Hero banner images & production camera setups
├── portfolio/    # Client case study images (Beanery, campaigns, branding)
├── services/     # Service feature graphics & icons
├── blog/         # Blog post thumbnails and featured graphics
├── team/         # Team member portraits and avatars
└── bts/          # Behind-the-scenes photography and gallery shots
```

### How to use local images with Astro `<Image />`:

```astro
---
import { Image } from 'astro:assets';
import heroImg from '../assets/images/hero/hero-production.jpg';
---

<Image src={heroImg} alt="Hero banner" class="hero-image" />
```
Astro will automatically:
- Optimize the image resolution
- Convert to next-gen formats (.webp / .avif)
- Compute intrinsic aspect ratios to eliminate layout shift (CLS)
