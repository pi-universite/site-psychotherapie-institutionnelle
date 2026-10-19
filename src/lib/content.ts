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
  appel: { label: 'Appel à projets', bg: 'bg-jaune' },
  'journee-etude': { label: "Journées d'étude", bg: 'bg-vert' },
  seminaire: { label: 'Séminaire', bg: 'bg-bleu' },
  autre: { label: 'Actualité', bg: 'bg-sable' },
};

export const RESSOURCE_CATEGORY_META: Record<RessourceCategorie, { label: string }> = {
  documents: { label: 'Documents' },
  video: { label: 'Vidéo' },
  podcast: { label: 'Podcast' },
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

// Published resources in one table, sorted by title. Categories (in
// RESSOURCE_CATEGORIES order) feed the filters with their counts.
export async function getRessources() {
  const items = await getCollection('ressources', ({ data }) => data.publie);
  items.sort((a, b) => a.data.titre.localeCompare(b.data.titre, 'fr'));
  const categories = RESSOURCE_CATEGORIES.map((categorie) => ({
    categorie,
    ...RESSOURCE_CATEGORY_META[categorie],
    count: items.filter((r) => r.data.categorie === categorie).length,
  }));
  return { items, categories };
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

export async function getSitesAmis() {
  const entry = await getEntry('sites-amis', 'sites-amis');
  if (!entry) throw new Error('Missing content/accueil/sites-amis.yml');
  return entry.data;
}

export async function getMembresAssocies() {
  const entry = await getEntry('membres-associes', 'membres-associes');
  if (!entry) throw new Error('Missing content/accueil/membres-associes.yml');
  return entry.data;
}

export async function getPartenaires() {
  const entry = await getEntry('partenaires', 'partenaires');
  if (!entry) throw new Error('Missing content/accueil/partenaires.yml');
  return entry.data;
}
