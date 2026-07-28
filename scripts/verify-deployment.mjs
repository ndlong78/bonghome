import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://bong.no.id.vn';
export const DEFAULT_TIMEOUT_MS = 15_000;

export const HTML_PATHS = Object.freeze([
  '/',
  '/index.html',
  ...Array.from({ length: 10 }, (_, index) => `/game${index + 1}.html`),
  '/parents.html',
  '/collection.html'
]);

const REDIRECT_PAGES = Object.freeze([
  'index',
  'parents',
  'collection',
  ...Array.from({ length: 10 }, (_, index) => `game${index + 1}`)
]);

export const REDIRECT_PATHS = Object.freeze(
  REDIRECT_PAGES.flatMap((page) => [
    Object.freeze({ pathname: `/${page}`, target: `/${page}.html` }),
    Object.freeze({ pathname: `/${page}/`, target: `/${page}.html` })
  ])
);

function normalizeBaseUrl(value) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Deployment URL must use http or https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError('Deployment URL must not include credentials, query parameters, or a fragment');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new TypeError('Deployment URL must be an origin without a path');
  }
  return new URL(url.origin);
}

function requestUrl(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl.origin}/`);
}

function contentType(response) {
  return (response.headers.get('content-type') || '').toLowerCase();
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  try {
    return await fetchImpl(url, {
      ...options,
      headers: {
        accept: '*/*',
        'cache-control': 'no-cache',
        ...(options?.headers || {})
      },
      signal: options?.signal || AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new Error(`${url.pathname}: request failed (${error.message})`, { cause: error });
  }
}

async function checkHtml(fetchImpl, baseUrl, pathname, timeoutMs) {
  const url = requestUrl(baseUrl, pathname);
  const response = await fetchWithTimeout(fetchImpl, url, { redirect: 'error' }, timeoutMs);
  if (response.status !== 200) throw new Error(`${pathname}: expected HTTP 200, received ${response.status}`);
  if (!contentType(response).includes('text/html')) {
    throw new Error(`${pathname}: expected text/html, received ${contentType(response) || 'no content-type'}`);
  }

  const body = await response.text();
  if (!/<!doctype html>/i.test(body) || !/<html\b/i.test(body)) {
    throw new Error(`${pathname}: response is not a complete HTML document`);
  }
  if (/(?:<title>\s*(?:404|not found)|cloudflare ray id|chrome-error:\/\/chromewebdata)/i.test(body)) {
    throw new Error(`${pathname}: response looks like an error page`);
  }
  if ((pathname === '/' || pathname === '/index.html') && !body.includes("Bông Home's")) {
    throw new Error(`${pathname}: Bông Home title marker is missing`);
  }
  return { pathname, status: response.status, type: 'html' };
}

async function checkManifest(fetchImpl, baseUrl, timeoutMs) {
  const pathname = '/manifest.json';
  const response = await fetchWithTimeout(fetchImpl, requestUrl(baseUrl, pathname), { redirect: 'error' }, timeoutMs);
  if (response.status !== 200) throw new Error(`${pathname}: expected HTTP 200, received ${response.status}`);

  let manifest;
  try {
    manifest = JSON.parse(await response.text());
  } catch (error) {
    throw new Error(`${pathname}: response is not valid JSON`, { cause: error });
  }
  if (!manifest.name || !manifest.start_url || !Array.isArray(manifest.icons) || !manifest.icons.length) {
    throw new Error(`${pathname}: required PWA fields are missing`);
  }
  return { pathname, status: response.status, type: 'manifest' };
}

async function checkServiceWorker(fetchImpl, baseUrl, timeoutMs) {
  const pathname = '/sw.js';
  const response = await fetchWithTimeout(fetchImpl, requestUrl(baseUrl, pathname), { redirect: 'error' }, timeoutMs);
  if (response.status !== 200) throw new Error(`${pathname}: expected HTTP 200, received ${response.status}`);

  const body = await response.text();
  if (!body.includes('const PHIEN_BAN =') || !body.includes('addEventListener')) {
    throw new Error(`${pathname}: service worker markers are missing`);
  }
  return { pathname, status: response.status, type: 'service-worker' };
}

async function checkRedirect(fetchImpl, baseUrl, route, timeoutMs) {
  const response = await fetchWithTimeout(
    fetchImpl,
    requestUrl(baseUrl, route.pathname),
    { redirect: 'manual' },
    timeoutMs
  );
  if (response.status !== 301) {
    throw new Error(`${route.pathname}: expected HTTP 301, received ${response.status}`);
  }

  const location = response.headers.get('location');
  if (!location) throw new Error(`${route.pathname}: redirect location is missing`);
  const redirected = new URL(location, requestUrl(baseUrl, route.pathname));
  const expected = requestUrl(baseUrl, route.target);
  if (redirected.href !== expected.href) {
    throw new Error(`${route.pathname}: expected redirect to ${route.target}, received ${redirected.href}`);
  }
  return {
    pathname: route.pathname,
    status: response.status,
    type: 'redirect',
    location: redirected.href
  };
}

export async function runDeploymentSmoke(value = DEFAULT_BASE_URL, options = {}) {
  const baseUrl = normalizeBaseUrl(value);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const logger = options.logger || console;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');

  logger.log(`Checking Bông Home deployment: ${baseUrl.origin}`);
  const results = [];
  for (const pathname of HTML_PATHS) {
    results.push(await checkHtml(fetchImpl, baseUrl, pathname, timeoutMs));
    logger.log(`✓ ${pathname} — HTTP 200 HTML`);
  }

  results.push(await checkManifest(fetchImpl, baseUrl, timeoutMs));
  logger.log('✓ /manifest.json — valid PWA manifest');
  results.push(await checkServiceWorker(fetchImpl, baseUrl, timeoutMs));
  logger.log('✓ /sw.js — service worker markers found');

  for (const route of REDIRECT_PATHS) {
    const redirect = await checkRedirect(fetchImpl, baseUrl, route, timeoutMs);
    results.push(redirect);
    logger.log(`✓ ${route.pathname} — HTTP 301 to ${new URL(redirect.location).pathname}`);
  }

  logger.log(`Deployment smoke passed: ${results.length} checks`);
  return results;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runDeploymentSmoke(process.argv[2] || process.env.DEPLOYMENT_URL || DEFAULT_BASE_URL)
    .catch((error) => {
      console.error(`Deployment smoke failed: ${error.message}`);
      process.exitCode = 1;
    });
}
