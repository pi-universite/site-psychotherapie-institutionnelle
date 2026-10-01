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

// Resource categories, in display order on /ressources/.
export const RESSOURCE_CATEGORIES = [
  'textes',
  'podcasts',
  'filmographie',
  'partenaires',
] as const;

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
  bio: z.string().optional(),
});

const partenaires = defineCollection({
  loader: glob({ pattern: 'partenaires.yml', base: './content/accueil' }),
  schema: z.object({
    titre: z.string(),
    // List order is the display order (drag & drop in the CMS).
    laboratoires: z
      .array(
        z.object({
          etablissement: z.string(),
          laboratoire: z.string(),
          url: z.string().optional(),
          logo: z.string().optional(),
          equipe_label: z.string().optional(),
          membres: z.array(membre).default([]),
        }),
      )
      .default([]),
    // Funders and supporters (e.g. the City of Marseille), logos only.
    soutiens: z
      .array(
        z.object({
          nom: z.string(),
          logo: z.string().optional(),
          url: z.string().optional(),
        }),
      )
      .default([]),
  }),
});

const reglages = defineCollection({
  loader: glob({ pattern: 'site.yml', base: './content/reglages' }),
  schema: z.object({
    titre_court: z.string(),
    meta_description: z.string(),
    adresse: z.string().optional(),
    email: z.string().optional(),
    telephone: z.string().optional(),
    // Hosted signup form (e.g. Brevo). The link is hidden when empty.
    newsletter_url: z.string().optional(),
    newsletter_label: z.string().default("Formulaire d'inscription"),
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
    // Optional poster (used by the alternative "list" layout).
    image: z.string().optional(),
    publie: z.boolean().default(true),
  }),
});

const ressources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/ressources' }),
  schema: z.object({
    titre: z.string(),
    categorie: z.enum(RESSOURCE_CATEGORIES),
    // Texts are grouped by author ("Oury Jean").
    auteur: z.string().optional(),
    annee: z.number().optional(),
    source: z.string().optional(), // e.g. "Cairn", "France Culture"
    // Optional: a film may be listed by title only. PDFs live on the
    // client's Google Drive, never in this repo.
    url: z.string().optional(),
    description: z.string().optional(),
    publie: z.boolean().default(true),
  }),
});

export const collections = { accueil, partenaires, reglages, agenda, ressources };
