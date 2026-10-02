// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://brandelier.in',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'always'
  },
  image: {
    remotePatterns: [
      { protocol: 'https', hostname: 'brandelier.in' },
      { protocol: 'https', hostname: 'cms.brandelier.in' },
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  },
  vite: {
    plugins: [tailwindcss()]
  }
});