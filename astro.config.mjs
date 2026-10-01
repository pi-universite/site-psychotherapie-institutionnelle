// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Canonical origin of the deployed site (Astro.site, sitemap, RSS…).
  // TODO: replace with the production URL (*.pages.dev or the university domain).
  site: 'https://example.com',
  // Tailwind v4 is wired in through its Vite plugin (no separate integration).
  vite: {
    plugins: [tailwindcss()],
  },
});
