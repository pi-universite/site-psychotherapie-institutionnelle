// CMS coverage tests. Usage: npm run test:cms
//
// 1. Schema parity: every field of public/admin/config.yml (Sveltia) exists in
//    the Zod schema of src/content.config.ts (read from the JSON schemas Astro
//    generates in .astro/collections/), with the same nesting, options and
//    "required" flags, and vice versa.
// 2. Rendering: on a throwaway copy of the project, every CMS field gets a
//    unique marker value; after a full build, each marker must appear in the
//    output (pages, <head>, RSS). A field whose marker is missing is never
//    shown on the site. Selects are checked option by option, "Publié" by
//    unpublishing an entry. The real content is never touched.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse, stringify } from 'yaml';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cms = parse(fs.readFileSync(path.join(root, 'public/admin/config.yml'), 'utf8'));

// CMS entry (file or folder) → Astro collection, by content path.
const COLLECTION_BY_PATH = {
  'content/accueil/hero.yml': 'accueil',
  'content/accueil/a-propos.yml': 'accueil',
  'content/accueil/partenaires.yml': 'partenaires',
  'content/accueil/sites-amis.yml': 'sites-amis',
  'content/accueil/membres-associes.yml': 'membres-associes',
  'content/pied-de-page.yml': 'pied-de-page',
  'content/mentions-legales.yml': 'mentions-legales',
  'content/reglages/site.yml': 'reglages',
  'content/agenda': 'agenda',
  'content/ressources': 'ressources',
};

// Flatten the CMS config into units: one per file, or one per folder.
const units = cms.collections.flatMap((c) =>
  c.files
    ? c.files.map((f) => ({ label: `${c.label} → ${f.label}`, path: f.file, fields: f.fields, kind: 'file' }))
    : [{ label: c.label, path: c.folder, fields: c.fields, kind: 'folder' }],
);

const errors = [];
const warnings = [];

// --- 1. Schema parity -------------------------------------------------------

execFileSync('npx', ['astro', 'sync'], { cwd: root, stdio: 'ignore' });
const schemaOf = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, '.astro/collections', `${name}.schema.json`), 'utf8'));

function compareFields(fields, schema, where) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  for (const f of fields) {
    const p = props[f.name];
    const at = `${where}.${f.name}`;
    if (!p) {
      errors.push(`[schéma] ${at} : champ du CMS absent du schéma du site (ignoré au build)`);
      continue;
    }
    const cmsRequired = f.required !== false && f.widget !== 'boolean' && f.widget !== 'list';
    if (!cmsRequired && required.has(f.name)) {
      errors.push(`[schéma] ${at} : facultatif dans le CMS mais obligatoire pour le site (laisser vide casserait le build)`);
    } else if (cmsRequired && !required.has(f.name) && p.default === undefined) {
      warnings.push(`[schéma] ${at} : obligatoire dans le CMS mais facultatif pour le site`);
    }
    if (f.widget === 'list') {
      if (p.type !== 'array' || !p.items?.properties) errors.push(`[schéma] ${at} : liste dans le CMS, pas dans le schéma`);
      else compareFields(f.fields, p.items, `${at}[]`);
    }
    if (f.widget === 'select' && p.enum) {
      const opts = f.options.map((o) => (typeof o === 'object' ? o.value : o));
      const missing = opts.filter((o) => !p.enum.includes(o));
      const extra = p.enum.filter((o) => !opts.includes(o));
      if (missing.length) errors.push(`[schéma] ${at} : options du CMS refusées par le site : ${missing.join(', ')}`);
      if (extra.length) warnings.push(`[schéma] ${at} : valeurs acceptées par le site mais absentes du CMS : ${extra.join(', ')}`);
    }
  }
}

// Fields the site expects that no CMS entry provides (union per collection).
const cmsFieldsByCollection = {};
for (const u of units) {
  const name = COLLECTION_BY_PATH[u.path];
  if (!name) {
    errors.push(`[schéma] ${u.label} (${u.path}) : aucune collection du site ne lit ce fichier`);
    continue;
  }
  const schema = schemaOf(name);
  compareFields(u.fields, schema, name);
  cmsFieldsByCollection[name] ??= new Set();
  for (const f of u.fields) cmsFieldsByCollection[name].add(f.name);
}
for (const [name, names] of Object.entries(cmsFieldsByCollection)) {
  for (const key of Object.keys(schemaOf(name).properties ?? {})) {
    if (key !== '$schema' && !names.has(key)) {
      errors.push(`[schéma] ${name}.${key} : attendu par le site mais absent du CMS (impossible à modifier)`);
    }
  }
}

// --- 2. Rendering ------------------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-cms-'));
for (const item of ['src', 'public', 'content', 'astro.config.mjs', 'package.json', 'tsconfig.json']) {
  fs.cpSync(path.join(root, item), path.join(tmp, item), { recursive: true });
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(tmp, 'node_modules'));

let n = 0;
const checks = []; // { label, needle, present }
const isUrl = (f) => /url$|^lien$/.test(f.name);
const marker = (label, f) => {
  const id = `ZQ${++n}ZQ`;
  const value = isUrl(f) ? `https://example.org/${id}` : f.widget === 'number' ? 2000 + n : id;
  checks.push({ label, needle: String(isUrl(f) ? id : value), present: true });
  return value;
};

// Fill every field of an object with a marker (lists get one marked item).
function fill(fields, obj, where, opts = {}) {
  for (const f of fields) {
    const label = `${where} → ${f.label}`;
    if (f.widget === 'list') {
      const item = {};
      fill(f.fields, item, label, opts);
      obj[f.name] = [item];
    } else if (f.widget === 'select') {
      obj[f.name] ??= opts.select?.[f.name] ?? (typeof f.options[0] === 'object' ? f.options[0].value : f.options[0]);
    } else if (f.widget === 'boolean') {
      obj[f.name] = true;
    } else if (f.widget === 'datetime') {
      // Distinct, recognisable dates (start 2031-07-11, end 2031-07-23).
      obj[f.name] = f.name === 'date_debut' ? '2031-07-11' : '2031-07-23';
      checks.push({ label, needle: obj[f.name], present: true });
    } else {
      obj[f.name] = marker(label, f);
    }
  }
}

const writeEntry = (dir, name, data) =>
  fs.writeFileSync(path.join(tmp, dir, `${name}.md`), `---\n${stringify(data)}---\n`);

for (const u of units) {
  if (u.kind === 'file') {
    const data = {};
    fill(u.fields, data, u.label);
    fs.writeFileSync(path.join(tmp, u.path), stringify(data));
    continue;
  }
  // Folder: one fully marked entry with the first value of each select (the
  // agenda's "call" type hides venue and time, so prefer a regular event).
  const prefer = { type: 'colloque' };
  const entry = {};
  fill(u.fields, entry, u.label, { select: prefer });
  writeEntry(u.path, 'zz-test-complet', entry);

  // Each option of each select: an entry carrying that value, which must show.
  for (const sel of u.fields.filter((f) => f.widget === 'select')) {
    for (const o of sel.options) {
      const value = typeof o === 'object' ? o.value : o;
      const e = { ...entry, [sel.name]: value, titre: `ZQsel${++n}ZQ` };
      writeEntry(u.path, `zz-test-${sel.name}-${n}`, e);
      checks.push({ label: `${u.label} → ${sel.label} = « ${value} »`, needle: value, present: true, near: e.titre });
    }
  }

  // "Publié" unchecked: the entry must disappear.
  const hidden = { ...entry, titre: `ZQcache${++n}ZQ`, publie: false };
  writeEntry(u.path, 'zz-test-depublie', hidden);
  checks.push({ label: `${u.label} → Publié (décoché)`, needle: hidden.titre, present: false });
}

let built = true;
try {
  execFileSync('npx', ['astro', 'build'], { cwd: tmp, stdio: 'pipe' });
} catch (e) {
  built = false;
  errors.push(`[rendu] le build échoue avec les valeurs de test :\n${String(e.stdout ?? '')}${String(e.stderr ?? '')}`.slice(0, 3000));
}

// Every <li> (agenda card) or <tr> (resource row) of the HTML pages that
// contains `text` (the RSS feed also lists titles, so it is not searched).
function blocksAround(pages, text) {
  const blocks = [];
  for (const html of pages) {
    for (let i = html.indexOf(text); i >= 0; i = html.indexOf(text, i + 1)) {
      const start = Math.max(html.lastIndexOf('<li', i), html.lastIndexOf('<tr', i));
      const ends = [html.indexOf('</li>', i), html.indexOf('</tr>', i)].filter((x) => x >= 0);
      blocks.push(html.slice(start, Math.min(...ends)));
    }
  }
  return blocks;
}

if (built) {
  const files = fs.readdirSync(path.join(tmp, 'dist'), { recursive: true }).filter((f) => /\.(html|xml)$/.test(f));
  const contents = files.map((f) => fs.readFileSync(path.join(tmp, 'dist', f), 'utf8'));
  const output = contents.join('\n');
  const pages = contents.filter((_, i) => files[i].endsWith('.html'));
  // Values as they may be written in HTML (apostrophes, quotes, ampersands escaped).
  const variants = (v) => [v, v.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;')];
  for (const c of checks) {
    let found = variants(c.needle).some((v) => output.includes(v));
    // Select values must show next to their own entry (an attribute or text in
    // the same list item / table row), not just anywhere on the site.
    if (c.near) found = blocksAround(pages, c.near).some((b) => variants(c.needle).some((v) => b.includes(v)));
    c.ok = found === c.present;
  }
}

fs.rmSync(tmp, { recursive: true, force: true });

// --- Report -------------------------------------------------------------------

const ok = checks.filter((c) => c.ok);
const ko = checks.filter((c) => !c.ok);
console.log(`\nTest 1 – cohérence CMS ↔ schéma du site : ${errors.filter((e) => e.startsWith('[schéma]')).length ? 'ÉCHEC' : 'OK'}`);
console.log(`Test 2 – chaque champ s'affiche : ${built ? `${ok.length}/${checks.length} vérifications OK` : 'ÉCHEC (build)'}`);
for (const c of ko) {
  console.log(`  ✗ ${c.label} : ${c.present ? "la valeur saisie n'apparaît nulle part sur le site" : "l'entrée reste visible alors qu'elle est dépubliée"}`);
}
for (const e of errors) console.log(`  ✗ ${e}`);
for (const w of warnings) console.log(`  ! ${w}`);
if (process.argv.includes('--verbose')) for (const c of ok) console.log(`  ✓ ${c.label}`);
process.exit(errors.length || ko.length ? 1 : 0);
