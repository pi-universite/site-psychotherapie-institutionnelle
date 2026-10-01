// GitHub OAuth client for Sveltia CMS, as a Cloudflare Worker.
//
// Single-site by design: one GitHub OAuth App per site, one Worker per site.
// Stateless (HMAC-signed `state`, 10 min expiry), zero dependencies (Web
// Crypto + fetch), so there is nothing to update after deployment.
//
// Flow: /auth → GitHub authorize → /callback → code exchanged for a token →
// token handed to the CMS window through the postMessage protocol shared by
// Decap and Sveltia ("authorization:github:success:{...}").

export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  // Random string used to sign `state` (openssl rand -hex 32).
  STATE_SECRET: string;
  // Comma-separated exact origins allowed to receive the token,
  // e.g. "https://example.pages.dev,http://localhost:4321".
  ALLOWED_ORIGINS: string;
  // GitHub OAuth scope: "public_repo" for a public repository, "repo" otherwise.
  OAUTH_SCOPE?: string;
}

const STATE_TTL_SECONDS = 600;
const encoder = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison of two hex strings.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function createState(secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  return `${timestamp}.${nonce}.${await hmac(secret, `${timestamp}.${nonce}`)}`;
}

async function isValidState(secret: string, state: string): Promise<boolean> {
  const [timestamp, nonce, signature] = state.split('.');
  if (!timestamp || !nonce || !signature) return false;
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_SECONDS) return false;
  return safeEqual(signature, await hmac(secret, `${timestamp}.${nonce}`));
}

// Popup page that hands the result to the CMS window. The token is only
// posted to the opener once it has proven (by replying) that its origin is
// in the allow-list, and only to that exact origin.
function messagePage(origins: string[], status: 'success' | 'error', content: unknown): Response {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const html = `<!doctype html><html><body><script>
(() => {
  const allowed = ${JSON.stringify(origins)};
  const message = ${JSON.stringify(message)};
  window.addEventListener('message', (event) => {
    if (!allowed.includes(event.origin)) return;
    window.opener.postMessage(message, event.origin);
  }, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

async function handleAuth(request: Request, env: Env): Promise<Response> {
  const callback = new URL('/callback', request.url);
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callback.toString(),
    scope: env.OAUTH_SCOPE || 'repo',
    state: await createState(env.STATE_SECRET),
  });
  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
}

async function handleCallback(request: Request, env: Env, origins: string[]): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  if (!state || !(await isValidState(env.STATE_SECRET, state))) {
    return new Response('Invalid or expired state', { status: 400 });
  }

  const error = url.searchParams.get('error');
  if (error) {
    return messagePage(origins, 'error', url.searchParams.get('error_description') ?? error);
  }

  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code parameter', { status: 400 });

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'sveltia-cms-oauth-worker',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    return messagePage(origins, 'error', data.error_description ?? data.error ?? 'Token exchange failed');
  }
  return messagePage(origins, 'success', { token: data.access_token, provider: 'github' });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.STATE_SECRET) {
      return new Response('Server misconfiguration', { status: 500 });
    }
    const origins = parseOrigins(env.ALLOWED_ORIGINS);
    if (origins.length === 0) return new Response('Server misconfiguration: no origins', { status: 500 });

    const { pathname } = new URL(request.url);
    // The CMS calls `${base_url}/${auth_endpoint}` (default "auth") and may
    // append query parameters such as ?provider=github: they are ignored.
    if (pathname === '/auth') return handleAuth(request, env);
    if (pathname === '/callback') return handleCallback(request, env, origins);
    return new Response('Not found', { status: 404 });
  },
};
