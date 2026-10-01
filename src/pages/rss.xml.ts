import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { getSettings, RESSOURCE_CATEGORY_META } from '../lib/content';

// Feed of agenda entries and resources, newest first. Lets a newsletter
// service send "new on the site" digests automatically (RSS-to-email).
export async function GET(context: APIContext) {
  const settings = await getSettings();
  const [agenda, ressources] = await Promise.all([
    getCollection('agenda', ({ data }) => data.publie),
    getCollection('ressources', ({ data }) => data.publie),
  ]);

  const items = [
    ...agenda.map((e) => ({
      title: e.data.titre,
      description: e.data.description,
      pubDate: e.data.date_debut,
      link: e.data.lien || '/#agenda',
      categories: ['Agenda'],
    })),
    ...ressources.map((r) => ({
      title: r.data.titre,
      description: r.data.description,
      link: r.data.url || `/ressources/#${RESSOURCE_CATEGORY_META[r.data.categorie].anchor}`,
      categories: ['Ressources', RESSOURCE_CATEGORY_META[r.data.categorie].label],
    })),
  ];

  return rss({
    title: settings.nom_site,
    description: settings.meta_description,
    site: context.site!,
    items,
  });
}
