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
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'self'; frame-ancestors 'none'"
        }
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

  assert.equal(smoke.REDIRECT_PATHS.length, 32, '16 trang phải kiểm tra cả URL không đuôi và dấu / cuối');
  assert.equal(results.length, smoke.HTML_PATHS.length + smoke.REDIRECT_PATHS.length + 2);
  assert.deepEqual(
    calls.filter((call) => call.redirect === 'manual').map((call) => call.pathname),
    smoke.REDIRECT_PATHS.map((route) => route.pathname)
  );
  assert.ok(calls.some((call) => call.pathname === '/'));
  assert.ok(calls.some((call) => call.pathname === '/game11.html'));
  assert.ok(calls.some((call) => call.pathname === '/parents'));
  assert.ok(calls.some((call) => call.pathname === '/collection/'));
  assert.ok(calls.some((call) => call.pathname === '/game11/'));
  assert.ok(calls.some((call) => call.pathname === '/game12.html'));
  assert.ok(calls.some((call) => call.pathname === '/game12/'));
  assert.ok(calls.some((call) => call.pathname === '/game13.html'));
  assert.ok(calls.some((call) => call.pathname === '/game13/'));
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

  // Kiểm tra phiên bản Service Worker đang chạy trên production.
  const swResult = results.find((item) => item.type === 'service-worker');
  assert.equal(swResult.version, 'test');
  assert.equal(swResult.expectedVersion, null, 'không truyền phiên bản mong đợi thì chỉ ghi log');
  assert.ok(logs.includes('✓ /sw.js — version test (not compared)'));

  const matchedLogs = [];
  const matched = await smoke.runDeploymentSmoke('https://example.test', {
    fetchImpl,
    logger: { log: (message) => matchedLogs.push(message) },
    timeoutMs: 100,
    expectedVersion: 'test'
  });
  assert.equal(matched.find((item) => item.type === 'service-worker').expectedVersion, 'test');
  assert.ok(matchedLogs.includes('✓ /sw.js — version test matches'));

  await assert.rejects(
    smoke.runDeploymentSmoke('https://example.test', {
      fetchImpl,
      logger: { log() {} },
      timeoutMs: 100,
      expectedVersion: 'release-999-new'
    }),
    /\/sw\.js: expected version release-999-new, received test/
  );

  const repoVersion = /const PHIEN_BAN = "([^"]+)";/.exec(read('sw.js'))[1];
  assert.equal(smoke.resolveExpectedVersion('local'), repoVersion, '"local" phải lấy PHIEN_BAN từ sw.js của bản checkout');
  assert.equal(smoke.resolveExpectedVersion(' LOCAL '), repoVersion);
  assert.equal(smoke.resolveExpectedVersion('skip'), null);
  assert.equal(smoke.resolveExpectedVersion(''), null);
  assert.equal(smoke.resolveExpectedVersion(undefined), null);
  assert.equal(smoke.resolveExpectedVersion('release-1-x'), 'release-1-x');
  assert.throws(() => smoke.resolveExpectedVersion('local', () => 'no version here'), /does not declare PHIEN_BAN/);
  assert.equal(smoke.extractServiceWorkerVersion('const PHIEN_BAN = "release-76-a";'), 'release-76-a');
  assert.equal(smoke.extractServiceWorkerVersion('const OTHER = 1;'), null);

  const noVersionFetch = async (input, options = {}) => {
    if (new URL(input).pathname === '/sw.js') {
      return new Response('const PHIEN_BAN = PREFIX + 1; self.addEventListener("x", () => {});', { status: 200 });
    }
    return fetchImpl(input, options);
  };
  await assert.rejects(
    smoke.runDeploymentSmoke('https://example.test', { fetchImpl: noVersionFetch, logger: { log() {} }, timeoutMs: 100 }),
    /PHIEN_BAN value could not be read/
  );

  assert.match(workflow, /expected_version:\n\s+description:[^\n]+\n\s+required: false\n\s+default: local/);
  assert.match(workflow, /EXPECTED_SW_VERSION: \$\{\{ inputs\.expected_version \}\}/);

  // Trang HTML thiếu header bảo mật từ _headers thì smoke phải fail.
  for (const [header, pattern] of [['x-content-type-options', /nosniff is missing/], ['content-security-policy', /Content-Security-Policy/]]) {
    const missingHeaderFetch = async (input, options = {}) => {
      const response = await fetchImpl(input, options);
      if (new URL(input).pathname !== '/game3.html') return response;
      const headers = new Headers(response.headers);
      headers.delete(header);
      return new Response(await response.text(), { status: response.status, headers });
    };
    await assert.rejects(
      smoke.runDeploymentSmoke('https://example.test', { fetchImpl: missingHeaderFetch, logger: { log() {} }, timeoutMs: 100 }),
      pattern
    );
  }

  console.log('Production deployment smoke checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
