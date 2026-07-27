const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const wrangler = JSON.parse(read('wrangler.jsonc'));
const redirects = read('_redirects');
const assetsIgnore = read('.assetsignore');

assert.equal(wrangler.name, 'bonghome');
assert.equal(wrangler.assets?.directory, '.');
assert.equal(
  wrangler.assets?.html_handling,
  'none',
  'Cloudflare must preserve .html paths used by the current route detection logic'
);

for (const page of ['index', 'parents', 'collection', ...Array.from({ length: 10 }, (_, index) => `game${index + 1}`)]) {
  const escaped = page.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    redirects,
    new RegExp(`^/${escaped} /${escaped}\\.html 301$`, 'm'),
    `Extensionless /${page} must redirect to /${page}.html`
  );
}

assert.match(assetsIgnore, /^wrangler\.jsonc$/m, 'Wrangler config must not be published as a browser asset');
assert.doesNotMatch(assetsIgnore, /^_redirects$/m, '_redirects must remain available to Cloudflare during deployment');

console.log('Cloudflare HTML routing checks passed.');
