import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Every collection mirrors public/admin/config.yml (Sveltia CMS): the CMS
// writes files under content/ at the repo root, the glob loader reads them
// back. Keep both files in sync whenever the content model changes.

// Agenda entry types. The label and card color are derived in code
// (src/lib/content.ts), so adding a type is a dev change on purpose.
export const AGENDA_TYPES = [
  'colloque',
  'appel',
  'journee-etude',
  'seminaire',
  'autre',
] as const;

// Resource categories, in display order of the /ressources/ filters.
export const RESSOURCE_CATEGORIES = ['documents', 'video', 'podcast'] as const;

// Singletons: one YAML file each, read with getEntry(<collection>, <file id>).
const accueil = defineCollection({
  loader: glob({ pattern: '{hero,a-propos}.yml', base: './content/accueil' }),
  schema: z.object({
    titre: z.string(),
    sous_titre: z.string().optional(),
    // Markdown, rendered through renderMarkdown() (sanitized).
    texte: z.string().optional(),
  }),
});

const membre = z.object({
  nom: z.string(),
  url: z.string().optional(),
});

// A laboratory card, shared by partners and associate members.
const laboratoire = z.object({
  etablissement: z.string(),
  etablissement_url: z.string().optional(),
  // May span several lines (e.g. name, then research axis); line breaks are kept.
  laboratoire: z.string(),
  url: z.string().optional(),
  equipe_label: z.string().optional(),
  membres: z.array(membre).default([]),
});

const partenaires = defineCollection({
  loader: glob({ pattern: 'partenaires.yml', base: './content/accueil' }),
  schema: z.object({
    titre: z.string(),
    // List order is the display order (drag & drop in the CMS).
    laboratoires: z.array(laboratoire).default([]),
  }),
});

const sitesAmis = defineCollection({
  loader: glob({ pattern: 'sites-amis.yml', base: './content/accueil' }),
  schema: z.object({
    titre: z.string(),
    // Short call to action under the section title.
    note: z.string().optional(),
    sites: z.array(z.object({ nom: z.string(), url: z.string().optional() })).default([]),
  }),
});

const membresAssocies = defineCollection({
  loader: glob({ pattern: 'membres-associes.yml', base: './content/accueil' }),
  schema: z.object({
    titre: z.string(),
    note: z.string().optional(),
    laboratoires: z.array(laboratoire).default([]),
  }),
});

const reglages = defineCollection({
  loader: glob({ pattern: 'site.yml', base: './content/reglages' }),
  schema: z.object({
    // Full title, shown in the page header.
    titre_court: z.string(),
    // Short site name: browser tab, Google results, social previews.
    nom_site: z.string(),
    meta_description: z.string(),
  }),
});

// Footer contacts and newsletter link (CMS: Pied de page).
const piedDePage = defineCollection({
  loader: glob({ pattern: 'pied-de-page.yml', base: './content' }),
  schema: z.object({
    adresse: z.string().optional(),
    email: z.string().optional(),
    telephone: z.string().optional(),
    // Hosted signup form (e.g. Brevo). The link is hidden when empty.
    newsletter_url: z.string().optional(),
    newsletter_label: z.string().default("Formulaire d'inscription"),
  }),
});

// Legal notice page (/mentions-legales/), one markdown text.
const mentionsLegales = defineCollection({
  loader: glob({ pattern: 'mentions-legales.yml', base: './content' }),
  schema: z.object({
    titre: z.string(),
    // Markdown, rendered through renderMarkdown() (sanitized).
    texte: z.string(),
  }),
});

const agenda = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/agenda' }),
  schema: z.object({
    titre: z.string(),
    type: z.enum(AGENDA_TYPES),
    // Event date, or deadline for a call for papers. Drives the sort and the
    // upcoming/past split.
    date_debut: z.coerce.date(),
    date_fin: z.coerce.date().optional(),
    horaire: z.string().optional(), // e.g. "9h30 — 17h30"
    lieu: z.string().optional(),
    description: z.string().optional(),
    lien: z.string().optional(),
    lien_label: z.string().optional(),
    publie: z.boolean().default(true),
  }),
});

const ressources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/ressources' }),
  schema: z.object({
    titre: z.string(),
    categorie: z.enum(RESSOURCE_CATEGORIES),
    auteur: z.string().optional(),
    editeur: z.string().optional(), // e.g. "Érès", "France Culture"
    annee: z.number().optional(),
    // File or media type shown in the "Type" column (PDF, Vidéo, Audio…).
    format: z.string().optional(),
    // Optional: a film may be listed by title only. PDFs live on the
    // client's Google Drive, never in this repo.
    url: z.string().optional(),
    publie: z.boolean().default(true),
  }),
});

export const collections = {
  accueil,
  partenaires,
  'sites-amis': sitesAmis,
  'membres-associes': membresAssocies,
  reglages,
  'pied-de-page': piedDePage,
  'mentions-legales': mentionsLegales,
  agenda,
  ressources,
};
