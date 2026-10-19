import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// The only way CMS markdown may reach `set:html`. marked lets raw HTML through,
// and the GitHub token of every editor lives in localStorage on this origin:
// sanitize at build time so a careless or compromised entry can never inject
// scripts.
export async function renderMarkdown(source: string | undefined): Promise<string> {
  if (!source) return '';
  return sanitizeHtml(await marked.parse(source), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
    },
    // External links open in a new tab, like every other link of the site.
    transformTags: {
      a: (tagName, attribs) =>
        /^https?:\/\//.test(attribs.href ?? '')
          ? { tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }
          : { tagName, attribs },
    },
  });
}
