const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const common = read('css/common.css');
const quality = read('pwa-quality.js');
const serviceWorker = read('sw.js');

assert.match(common, /\[role="button"\]\s*\{[\s\S]*min-width:\s*var\(--bh-touch-target\);[\s\S]*min-height:\s*var\(--bh-touch-target\);/);
assert.match(common, /:focus-visible\s*\{/);
assert.match(common, /prefers-reduced-motion:\s*reduce/);

assert.match(quality, /function setupCustomButtons\(\)/);
assert.match(quality, /button\.click\(\)/);
assert.match(quality, /event\.defaultPrevented/);
assert.match(quality, /aria-disabled/);

assert.match(quality, /function setupDialogFocus\(\)/);
assert.match(quality, /dialog\.setAttribute\('aria-hidden'/);
assert.match(quality, /item\.inert = true/);
assert.match(quality, /item\.inert = false/);
assert.match(quality, /event\.key !== 'Tab'/);
assert.match(quality, /previousFocus\?\.isConnected/);
assert.match(quality, /setupCustomButtons\(\);/);
assert.match(quality, /setupDialogFocus\(\);/);

assert.ok(serviceWorker.includes('./pwa-quality.js'), 'accessibility runtime must remain cached offline');
assert.ok(serviceWorker.includes('./css/common.css'), 'shared accessibility CSS must remain cached offline');
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Shared accessibility control checks passed.');
