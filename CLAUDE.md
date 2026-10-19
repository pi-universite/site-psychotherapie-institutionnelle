# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

Two-page static site for the 2025 Marseille (AMU) colloquium on institutional psychotherapy:
home (hero, À propos, Partenaires, Sites amis, Membres associé·es, Agenda et actualités, footer Contacts)
and `/ressources/` (one filterable, searchable table), plus a `/mentions-legales/` page
(legal notice + GDPR notice for the Brevo newsletter form linked from the footer; CMS singleton).
Astro SSG + Sveltia CMS (self-hosted bundle, GitHub backend), Cloudflare Pages. Editors sign in with
GitHub through this site's own OAuth Worker (`auth/`, Cloudflare Workers); token sign-in is a fallback.
Hard constraints: zero recurring cost, zero maintenance after delivery, several non-technical editors.

Full spec, editor guide and security model live in `README.md` (French) — read it before structural changes.

## Architecture

```
content/                      ← written by Sveltia CMS
├── accueil/{hero,a-propos,partenaires,sites-amis,membres-associes}.yml   ← singletons ("files" collections)
├── agenda/*.md               ← one file per event (frontmatter only)
├── ressources/*.md           ← one file per resource (frontmatter only)
└── reglages/{site,mentions-legales}.yml   ← contacts, newsletter URL, meta; legal notice (markdown)
public/admin/                 ← Sveltia bundle (committed) + config.yml
public/deco/*.svg             ← hero shapes exported from Figma (Desktop - 8), placed in Hero.astro
src/
├── content.config.ts         ← Zod schemas — mirror of public/admin/config.yml
├── lib/content.ts            ← queries, agenda upcoming/past ordering, type/category labels
├── lib/markdown.ts           ← renderMarkdown(): the ONLY path from CMS markdown to set:html
├── lib/dates.ts              ← French date ranges, formatted in UTC
├── components/               ← Hero (deco layer), Section, APropos, Partenaires, Laboratoire (card shared with MembresAssocies), SitesAmis, Agenda(Card), Header, Footer
├── pages/{index,ressources}.astro, pages/rss.xml.ts
auth/                         ← OAuth Worker (zero deps, deployed by hand with wrangler; excluded from tsconfig)
```

## Key rules

- **Dual schema**: any content-model change goes to BOTH `public/admin/config.yml` and
  `src/content.config.ts`.
- **Security invariant**: admin and site share one origin and editors' GitHub tokens live in
  localStorage. Any HTML from CMS content must go through `renderMarkdown()` (sanitize-html).
  Keep `public/_headers` rules.
- **No scheduled jobs**: the agenda upcoming/past split is computed at build AND re-applied
  client-side by an inline script (`Agenda.astro`). Never add a cron/GitHub scheduled workflow.
- **No files in the repo for resources**: PDFs live on the client's Google Drive; entries store links.
- **OAuth Worker**: single-site, stateless (HMAC state), token posted only to an exact
  `ALLOWED_ORIGINS` match. Keep it dependency-free and its `compatibility_date` frozen.
- **No CDN at runtime**: Sveltia bundle and fonts (Fontsource) are self-hosted.
- **Install with `npm ci`**; no dependency auto-updates.
- Design reference: Figma file `wXJJcRBwpwfdONSaRG1mwl` (read it through the Figma MCP), frame "Desktop - 8"
  (home) and "Desktop - 9" (`/ressources/`). Tokens in `src/styles/global.css` `@theme`.
- **Spacing and type come from tokens, never one-off px values**: `page` (side margin),
  `section` (vertical rhythm, title → content), `gutter` (grid gaps, blocks in a card),
  `card` (card padding = gutter/2); type scale `text-display/title/headline/subhead/card/nav/lead/body/small/note`.
  Layout grid: 3 columns with `gutter` (partners; "side" sections = title 1 col + content 2 cols),
  4 columns for agenda and footer. Only exception: the hero composition (`Hero.astro`), tied to the artwork.
- Code comments and identifiers in English; UI copy in French.
