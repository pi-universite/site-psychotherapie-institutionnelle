import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { RESSOURCE_CATEGORIES, type AGENDA_TYPES } from '../content.config';
import { isoDay } from './dates';

export type Evenement = CollectionEntry<'agenda'>;
export type Ressource = CollectionEntry<'ressources'>;
type AgendaType = (typeof AGENDA_TYPES)[number];
type RessourceCategorie = (typeof RESSOURCE_CATEGORIES)[number];

// Label and card color per agenda type (colors are @theme tokens).
export const AGENDA_TYPE_META: Record<AgendaType, { label: string; bg: string }> = {
  colloque: { label: 'Colloque', bg: 'bg-rose' },
  appel: { label: 'Appel à communications', bg: 'bg-jaune' },
  'journee-etude': { label: "Journées d'étude", bg: 'bg-vert' },
  seminaire: { label: 'Séminaire', bg: 'bg-bleu' },
  autre: { label: 'Actualité', bg: 'bg-sable' },
};

export const RESSOURCE_CATEGORY_META: Record<RessourceCategorie, { label: string; anchor: string }> = {
  textes: { label: 'Textes', anchor: 'textes' },
  podcasts: { label: 'Podcasts', anchor: 'podcasts' },
  filmographie: { label: 'Filmographie', anchor: 'filmographie' },
  partenaires: { label: 'Ressources partenaires', anchor: 'ressources-partenaires' },
};

// Last day an event is still "upcoming": its end date, or its start date.
export const lastDay = (e: Evenement) => isoDay(e.data.date_fin ?? e.data.date_debut);

// Upcoming events first (soonest first), then past ones (most recent first).
// The split is computed at build time; a small inline script re-applies it in
// the browser so the page stays correct between rebuilds (no cron needed).
export async function getAgenda(): Promise<Evenement[]> {
  const today = isoDay(new Date());
  const events = await getCollection('agenda', ({ data }) => data.publie);
  const upcoming = events
    .filter((e) => lastDay(e) >= today)
    .sort((a, b) => a.data.date_debut.getTime() - b.data.date_debut.getTime());
  const past = events
    .filter((e) => lastDay(e) < today)
    .sort((a, b) => b.data.date_debut.getTime() - a.data.date_debut.getTime());
  return [...upcoming, ...past];
}

// Published resources grouped by category, in RESSOURCE_CATEGORIES order.
// Texts are sorted by author then title, the rest by title.
export async function getRessourcesParCategorie() {
  const all = await getCollection('ressources', ({ data }) => data.publie);
  const byTitle = (a: Ressource, b: Ressource) => a.data.titre.localeCompare(b.data.titre, 'fr');
  return RESSOURCE_CATEGORIES.map((categorie) => {
    const items = all.filter((r) => r.data.categorie === categorie);
    items.sort(
      categorie === 'textes'
        ? (a, b) => (a.data.auteur ?? '').localeCompare(b.data.auteur ?? '', 'fr') || byTitle(a, b)
        : byTitle,
    );
    return { categorie, ...RESSOURCE_CATEGORY_META[categorie], items };
  });
}

export async function getSettings() {
  const entry = await getEntry('reglages', 'site');
  if (!entry) throw new Error('Missing content/reglages/site.yml');
  return entry.data;
}

export async function getAccueil(id: 'hero' | 'a-propos') {
  const entry = await getEntry('accueil', id);
  if (!entry) throw new Error(`Missing content/accueil/${id}.yml`);
  return entry.data;
}

export async function getPartenaires() {
  const entry = await getEntry('partenaires', 'partenaires');
  if (!entry) throw new Error('Missing content/accueil/partenaires.yml');
  return entry.data;
}
