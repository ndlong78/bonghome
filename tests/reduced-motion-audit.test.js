const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = [
  'index.html',
  'parents.html',
  ...Array.from({ length: 10 }, (_, index) => `game${index + 1}.html`)
];

function hasReducedMotionPolicy(source) {
  return /prefers-reduced-motion\s*:\s*reduce/.test(source);
}

function linkedStylesheets(html) {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((href) => !/^(?:https?:)?\/\//i.test(href))
    .map((href) => href.replace(/^\.\//, '').split(/[?#]/, 1)[0]);
}

for (const file of pages) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const stylesheets = linkedStylesheets(source);
  const hasLinkedReducedMotion = stylesheets.some((stylesheet) => {
    const stylesheetPath = path.join(root, stylesheet);
    return fs.existsSync(stylesheetPath) && hasReducedMotionPolicy(fs.readFileSync(stylesheetPath, 'utf8'));
  });

  assert.ok(
    hasReducedMotionPolicy(source) || hasLinkedReducedMotion,
    `${file} phải khai báo prefers-reduced-motion trực tiếp hoặc qua stylesheet liên kết`
  );
}

console.log('✓ 12 trang đều có chính sách giảm chuyển động');