// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Canonical origin of the deployed site (Astro.site, sitemap, RSS…).
  // Production URL (Cloudflare Pages project name = subdomain, fixed at creation).
  site: 'https://psychotherapie-institutionnelle.pages.dev',
  // sitemap-index.xml, referenced from public/robots.txt (update both if the domain changes).
  integrations: [sitemap()],
  // Tailwind v4 is wired in through its Vite plugin (no separate integration).
  vite: {
    plugins: [tailwindcss()],
  },
});
