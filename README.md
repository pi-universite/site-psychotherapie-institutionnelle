# Comment la psychothérapie institutionnelle existe-t-elle aujourd'hui à l'université ?

Site issu du colloque des 2 et 3 octobre 2025 à Marseille (AMU), coporté par cinq laboratoires.
Site statique **Astro** + CMS **Sveltia** (git-based), édité via `/admin`, déployé sur **Cloudflare Pages**.

Objectif de conception : **0 € récurrent, édition autonome, aucune maintenance après livraison.**

Deux pages : l'accueil (titre, À propos, Partenaires, Agenda et actualités, Contacts en pied de page)
et `/ressources/` (Textes, Podcasts, Filmographie, Ressources partenaires). Un flux `/rss.xml`
reprend l'agenda et les ressources.

## Stack

| Brique | Choix | Rôle |
|---|---|---|
| Astro | 7.x | génération statique |
| Tailwind | 4.x | styles (tokens dans `src/styles/global.css`) |
| Polices | Inter + Gelasio via Fontsource | auto-hébergées, aucun CDN |
| marked + sanitize-html | au build | rendu sûr du markdown saisi dans le CMS |
| Sveltia CMS | **0.227.0, auto-hébergé** (`public/admin/sveltia-cms.js`) | édition du contenu |
| Backend CMS | GitHub, branche `main` | chaque enregistrement = un commit |
| Hébergement | Cloudflare Pages | rebuild automatique à chaque commit |

## Où est le contenu

| Contenu | Fichier(s) | Dans l'admin |
|---|---|---|
| Titre et sous-titre | `content/accueil/hero.yml` | Page d'accueil → En-tête |
| À propos | `content/accueil/a-propos.yml` | Page d'accueil → À propos |
| Laboratoires et soutiens | `content/accueil/partenaires.yml` | Page d'accueil → Partenaires (ordre par glisser-déposer) |
| Agenda et actualités | `content/agenda/*.md` | Agenda et actualités |
| Ressources | `content/ressources/*.md` | Ressources |
| Contacts, newsletter, description | `content/reglages/site.yml` | Réglages |

Le modèle est défini **dans deux fichiers à garder synchronisés** :
`public/admin/config.yml` (Sveltia) et `src/content.config.ts` (validation au build).

## Guide éditeur

- **Agenda** : la date est celle de l'événement, ou la **date limite** pour un appel à communications.
  Le classement est automatique : les événements à venir passent d'abord, les événements passés restent
  visibles mais estompés. Il n'y a rien à ranger ni à supprimer. Pour retirer un événement, décochez **Publié**.
- **Ressources** : **aucun PDF dans le site.** Les textes sont déposés dans le Google Drive partagé
  (dossier TEXTES), puis on crée une fiche ressource avec le lien du fichier. Pour un texte payant, mettez
  le lien Cairn. Les podcasts pointent vers Radio France, les films vers YouTube ou ne portent qu'un titre.
  Les textes sont regroupés par auteur·rice : écrivez le nom toujours de la même façon (« OURY Jean »).
- **Images** (logos, affiches) : JPG ou PNG, de poids raisonnable (< 1 Mo), nommés sans espaces.
- **Newsletter** : collez dans Réglages le lien du formulaire d'inscription hébergé (Brevo ou autre).
  Si le champ est vide, le lien n'apparaît pas.
- Après un enregistrement, le site est en ligne en 1 à 2 minutes.

## Accès éditeurs (connexion GitHub)

Les éditeur·rices se connectent sur `/admin` avec le bouton **« Se connecter avec GitHub »**. Ils n'ont
aucun token à créer ni à copier. La connexion passe par un petit script hébergé sur Cloudflare
(`auth/`, voir plus bas) et par une application OAuth GitHub propre à ce site.

- **Qui peut éditer** : tout compte GitHub qui a le droit **Write** sur le dépôt. Un simple
  collaborateur du dépôt suffit, pas besoin d'organisation.
- **Ajouter un·e éditeur·rice (≈ 5 min)** : la personne crée un compte GitHub. Le compte propriétaire
  du dépôt l'invite (Settings → Collaborators → *Add people*, rôle *Write*). La personne accepte
  l'invitation, puis se connecte sur `/admin`. À la première connexion, GitHub demande d'autoriser
  l'application.
- **Retirer un accès** : retirer la personne des collaborateurs du dépôt. Son ancienne session ne
  peut alors plus rien modifier.
- **Session** : GitHub révoque un jeton OAuth inutilisé pendant un an. Il suffit alors de cliquer de
  nouveau sur « Se connecter avec GitHub ». Il n'y a rien à renouveler.

⚠️ Le jeton de session est stocké dans le **localStorage du navigateur**. Ne pas se connecter sur un
poste partagé sans se déconnecter ensuite.

⚠️ **Portée du jeton.** Une application OAuth GitHub ne peut pas être limitée à un seul dépôt : le
jeton donne accès en écriture à **tous les dépôts publics** (portée `public_repo`) ou à **tous les
dépôts** (portée `repo`) du compte qui se connecte. Pour limiter le risque :
- garder **ce dépôt public**, avec `OAUTH_SCOPE = "public_repo"`. Le contenu est public de toute façon ;
- utiliser des comptes GitHub **dédiés à ce site**, qui n'ont pas d'autres dépôts.

**Secours** : la connexion par token reste possible (bouton « Se connecter avec un jeton d'accès »).
Pour un token sur un dépôt personnel, il faut être le propriétaire du dépôt. Les fine-grained tokens
ne fonctionnent pas pour un collaborateur.

### Connexion GitHub (Worker OAuth) — installation, une fois

Tout se fait avec le compte Cloudflare du client (le même que pour Pages) et le compte GitHub
propriétaire du dépôt. Le Worker est déployé à la main ; le build du site ne le touche pas.

1. **Déployer le Worker** : il obtient son URL, par exemple `https://cms-auth.<compte>.workers.dev`.
   ```bash
   cd auth
   npx wrangler login          # compte Cloudflare du client
   npx wrangler deploy
   ```
2. **Créer l'application OAuth** : GitHub (compte propriétaire du dépôt) → Settings →
   Developer settings → OAuth Apps → *New OAuth App* :
   - Homepage URL : l'URL du site ;
   - **Authorization callback URL** : `https://cms-auth.<compte>.workers.dev/callback`.

   Noter le *Client ID* et générer un *Client secret*.
3. **Secrets du Worker** :
   ```bash
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put STATE_SECRET     # valeur : openssl rand -hex 32
   ```
4. **`auth/wrangler.toml`** :
   - `ALLOWED_ORIGINS` = l'URL exacte du site, sans `/` final, plus `http://localhost:4321` pour le dev ;
   - `OAUTH_SCOPE` = `public_repo` si le dépôt est public.

   Puis `npx wrangler deploy` une nouvelle fois.
5. **`public/admin/config.yml`** : `base_url` = l'URL du Worker. Commit : le site se redéploie.
6. **Test** : sur `<site>/admin`, cliquer sur « Se connecter avec GitHub » avec un compte collaborateur,
   puis modifier un texte et vérifier le commit.

Le Worker n'a aucune dépendance et sa date de compatibilité est figée (Cloudflare garantit que les
anciennes dates restent prises en charge). Il n'y a rien à mettre à jour. En cas de fuite du secret :
GitHub → OAuth App → *Generate a new client secret*, puis `npx wrangler secret put GITHUB_CLIENT_SECRET`.

## Modèle de sécurité (à conserver)

L'admin (`/admin`) et le site public partagent **la même origine**, et le token vit dans le localStorage
de cette origine. Toute faille XSS sur le site permettrait donc de voler le token. Les garde-fous,
tous posés une fois pour toutes :

1. **Tout markdown saisi dans le CMS passe par `renderMarkdown()`** (`src/lib/markdown.ts` :
   marked + sanitize-html) avant `set:html`. Aucun autre `set:html` sur du contenu éditeur.
2. **`public/_headers`** : CSP `default-src 'none'` sur `/uploads/*` (un SVG ou HTML téléversé ne peut
   pas exécuter de script), `nosniff`, anti-clickjacking sur `/admin/*`. Format pris en charge par
   Cloudflare Pages.
3. **Admin non indexé** : `noindex` dans `public/admin/index.html` et `Disallow` dans `robots.txt`.

### Sveltia auto-hébergé (pas de CDN)

`public/admin/index.html` charge `/admin/sveltia-cms.js` en local. Le fichier (~2 Mo) est commité,
c'est voulu : la version est figée et il n'y a aucune dépendance à un CDN.
Il n'y a pas de mise à jour automatique, seulement une veille : sur GitHub,
[sveltia/sveltia-cms](https://github.com/sveltia/sveltia-cms) → Watch → Custom → **Releases**.
On n'agit qu'en cas de faille de sécurité annoncée. Mise à jour vérifiée (intégrité contrôlée par npm) :

```bash
npm pack @sveltia/cms@<VERSION>
tar xzf sveltia-cms-<VERSION>.tgz
cp package/dist/sveltia-cms.js public/admin/sveltia-cms.js
rm -rf package sveltia-cms-<VERSION>.tgz
```

puis mettre à jour la version dans ce README et commit.

### Dépendances et reproductibilité

- `package-lock.json` est commité et fait foi. Pour réinstaller, utiliser **`npm ci`**.
- La version de Node est figée (`.nvmrc` et variable `NODE_VERSION` sur Cloudflare) pour que les
  évolutions de l'image de build ne cassent rien.
- **Pas** de Dependabot ni de Renovate en fusion automatique.

## Décors

Les formes du titre (`src/assets/deco/*.svg`) sont **provisoires**. Elles ont été redessinées d'après la
maquette et sont placées selon les positions du cadre Figma *Desktop 8* (`src/components/Hero.astro`).
Il faut les remplacer par les exports SVG du Figma, à fichier et nom identiques.

## Dev local

```bash
npm ci         # installe à l'identique du lockfile
npm run dev    # site sur localhost:4321, admin sur /admin (« Work with Local Repository » dans Chrome)
npm run build  # build statique dans dist/
npm run check  # vérification des types
```

## Mise en production (Cloudflare Pages)

1. Dans `public/admin/config.yml`, remplacer `repo: OWNER/REPO` par `proprietaire/depot`.
2. Cloudflare (compte du client) → Workers & Pages → *Create* → Pages → *Connect to Git*. Autoriser
   l'application GitHub de Cloudflare sur le compte propriétaire du dépôt, puis choisir ce dépôt,
   branche `main`.
3. Build command : `npm run build`. Output : `dist`. Variable d'environnement `NODE_VERSION` = `22`.
4. Reporter l'URL finale (`*.pages.dev` ou domaine universitaire) dans `astro.config.mjs` (`site:`).
5. Installer la connexion GitHub (voir « Connexion GitHub (Worker OAuth) »).
6. Vérifier les en-têtes : `curl -I <site>/uploads/<fichier>` doit renvoyer
   `Content-Security-Policy: default-src 'none'`.
