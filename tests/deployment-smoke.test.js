const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

(async () => {
  const assetsIgnore = read('.assetsignore');
  const packageJson = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/deployment-smoke.yml');
  assert.match(assetsIgnore, /^scripts\/$/m, 'Deployment scripts must not be published as static assets');
  assert.equal(packageJson.scripts?.['test:deployment'], 'node scripts/verify-deployment.mjs');
  assert.match(workflow, /^  workflow_dispatch:$/m, 'Deployment smoke workflow must be manually triggered');
  assert.doesNotMatch(workflow, /^  pull_request:$/m, 'Production network checks must not run on every pull request');

  const smoke = await import('../scripts/verify-deployment.mjs');
  const html = '<!DOCTYPE html><html lang="vi"><head><title>Bông Home\'s</title></head><body>OK</body></html>';
  const calls = [];
  const redirectMap = new Map(smoke.REDIRECT_PATHS.map((route) => [route.pathname, route.target]));

  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ pathname: url.pathname, redirect: options.redirect });

    const redirectTarget = redirectMap.get(url.pathname);
    if (redirectTarget) {
      return new Response('', {
        status: 301,
        headers: { location: redirectTarget }
      });
    }
    if (url.pathname === '/manifest.json') {
      return new Response(JSON.stringify({ name: "Bông Home's", start_url: './index.html', icons: [{ src: './icon.png' }] }), {
        status: 200,
        headers: { 'content-type': 'application/manifest+json' }
      });
    }
    if (url.pathname === '/sw.js') {
      return new Response("const PHIEN_BAN = 'test'; self.addEventListener('install', () => {});", {
        status: 200,
        headers: { 'content-type': 'application/javascript' }
      });
    }
    if (smoke.HTML_PATHS.includes(url.pathname)) {
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }
    return new Response('Not found', { status: 404 });
  };

  const logs = [];
  const results = await smoke.runDeploymentSmoke('https://example.test', {
    fetchImpl,
    logger: { log: (message) => logs.push(message) },
    timeoutMs: 100
  });

  assert.equal(smoke.REDIRECT_PATHS.length, 26, '13 trang phải kiểm tra cả URL không đuôi và dấu / cuối');
  assert.equal(results.length, smoke.HTML_PATHS.length + smoke.REDIRECT_PATHS.length + 2);
  assert.deepEqual(
    calls.filter((call) => call.redirect === 'manual').map((call) => call.pathname),
    smoke.REDIRECT_PATHS.map((route) => route.pathname)
  );
  assert.ok(calls.some((call) => call.pathname === '/'));
  assert.ok(calls.some((call) => call.pathname === '/game10.html'));
  assert.ok(calls.some((call) => call.pathname === '/parents'));
  assert.ok(calls.some((call) => call.pathname === '/collection/'));
  assert.ok(calls.some((call) => call.pathname === '/game10/'));
  assert.ok(logs.at(-1).includes('Deployment smoke passed'));

  await assert.rejects(
    smoke.runDeploymentSmoke('https://example.test/path', { fetchImpl, logger: { log() {} } }),
    /must be an origin without a path/
  );

  const wrongRedirectFetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname === '/parents') {
      return new Response('', { status: 301, headers: { location: '/collection.html' } });
    }
    return fetchImpl(input, options);
  };
  await assert.rejects(
    smoke.runDeploymentSmoke('https://example.test', {
      fetchImpl: wrongRedirectFetch,
      logger: { log() {} },
      timeoutMs: 100
    }),
    /\/parents: expected redirect to \/parents\.html/
  );

  const failingFetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname === '/') return new Response('Unavailable', { status: 503, headers: { 'content-type': 'text/plain' } });
    return fetchImpl(input, options);
  };
  await assert.rejects(
    smoke.runDeploymentSmoke('https://example.test', { fetchImpl: failingFetch, logger: { log() {} }, timeoutMs: 100 }),
    /expected HTTP 200, received 503/
  );

  console.log('Production deployment smoke checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
