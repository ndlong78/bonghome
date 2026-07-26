const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SERVICE_WORKER = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const BUDGETS = Object.freeze({
  javascriptFile: 128 * 1024,
  stylesheetFile: 96 * 1024,
  htmlFile: 320 * 1024,
  cachedTextTotal: 1024 * 1024
});

function cachedLocalPaths() {
  return [...SERVICE_WORKER.matchAll(/"(\.\/[^"\n]+)"/g)]
    .map((match) => match[1].replace(/^\.\//, ''))
    .filter((file) => /\.(?:html|css|js|json)$/.test(file));
}

function bytes(file) {
  return fs.statSync(path.join(ROOT, file)).size;
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)} KiB`;
}

test('mỗi tài nguyên văn bản trong offline cache nằm trong performance budget', () => {
  const files = cachedLocalPaths();
  assert.ok(files.length > 0, 'Service Worker phải khai báo tài nguyên văn bản để kiểm tra');

  const limits = {
    '.js': BUDGETS.javascriptFile,
    '.css': BUDGETS.stylesheetFile,
    '.html': BUDGETS.htmlFile
  };

  for (const file of files) {
    const extension = path.extname(file);
    const limit = limits[extension];
    if (!limit) continue;

    const size = bytes(file);
    assert.ok(
      size <= limit,
      `${file} có kích thước ${formatBytes(size)}, vượt ngân sách ${formatBytes(limit)}`
    );
  }
});

test('tổng tài nguyên văn bản cache offline không vượt 1 MiB', () => {
  const files = [...new Set(cachedLocalPaths())];
  const total = files.reduce((sum, file) => sum + bytes(file), 0);

  assert.ok(
    total <= BUDGETS.cachedTextTotal,
    `Tổng tài nguyên văn bản là ${formatBytes(total)}, vượt ngân sách ${formatBytes(BUDGETS.cachedTextTotal)}`
  );

  console.log(`✓ Performance budget: ${files.length} tệp, tổng ${formatBytes(total)}`);
});
