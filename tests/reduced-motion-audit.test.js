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
  const hasSharedReducedMotion = /css\/common\.css/.test(source);
  const hasInlineReducedMotion = /prefers-reduced-motion\s*:\s*reduce/.test(source);
  assert.ok(
    hasSharedReducedMotion || hasInlineReducedMotion,
    `${file} phải dùng common.css hoặc khai báo prefers-reduced-motion`
  );
}

console.log('✓ 12 trang đều có chính sách giảm chuyển động');
