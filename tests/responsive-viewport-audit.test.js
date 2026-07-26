const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = [
  'index.html',
  'parents.html',
  ...Array.from({ length: 10 }, (_, index) => `game${index + 1}.html`)
];

for (const file of pages) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const viewport = source.match(/<meta\b[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  assert.ok(viewport, `${file} phải có meta viewport`);
  assert.match(viewport[1], /width\s*=\s*device-width/i, `${file} phải dùng device-width`);
  assert.match(viewport[1], /initial-scale\s*=\s*1(?:\.0)?/i, `${file} phải dùng initial-scale=1`);
  assert.match(viewport[1], /viewport-fit\s*=\s*cover/i, `${file} phải hỗ trợ safe area iPhone/iPad`);
}

console.log('✓ 12 trang có cấu hình viewport và safe area đầy đủ');
