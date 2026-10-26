#!/usr/bin/env node
'use strict';

/*
 * Đếm các phép so chuỗi/regex trên mã nguồn JS trong tests/*.test.js (assert.match, assert.doesNotMatch,
 * .includes trên biến giữ nội dung một tệp .js đọc bằng readFileSync). Hợp đồng cấu hình (sw.js, HTML, CSS,
 * _headers…) không tính. Dùng để theo dõi việc chuyển test sang kiểm tra hành vi (docs/refactor-plan.md).
 *
 *   node scripts/count-source-assertions.js           # tổng
 *   node scripts/count-source-assertions.js --files   # chi tiết từng tệp test
 *   node scripts/count-source-assertions.js --markup  # đếm trên HTML/CSS thay vì JS
 */
const fs = require('node:fs');
const path = require('node:path');

const testsDir = path.join(__dirname, '..', 'tests');
const rows = [];
const markup = process.argv.includes('--markup');
const sourceFile = markup ? /['"`]([^'"`]+\.(?:html|css))['"`]/ : /['"`]([^'"`]+\.js)['"`]/;

for (const name of fs.readdirSync(testsDir).filter((file) => file.endsWith('.test.js')).sort()) {
  const source = fs.readFileSync(path.join(testsDir, name), 'utf8');
  const variables = {};
  for (const match of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:fs\.)?(?:readFileSync|read|readText|readSource|source)\(([^;\n]*)/g)) {
    const file = (match[2].match(sourceFile) || [])[1];
    if (file && path.basename(file) !== 'sw.js') variables[match[1]] = file;
  }
  let count = 0;
  const files = [];
  for (const [variable, file] of Object.entries(variables)) {
    const pattern = new RegExp(`assert\\.(?:match|doesNotMatch)\\(\\s*${variable}\\b|\\b${variable}\\.includes\\(`, 'g');
    const found = (source.match(pattern) || []).length;
    if (found) { count += found; files.push(`${file}:${found}`); }
  }
  if (count) rows.push({ name, count, files });
}

rows.sort((a, b) => b.count - a.count);
if (process.argv.includes('--files')) {
  rows.forEach((row) => console.log(`${String(row.count).padStart(4)}  ${row.name.padEnd(44)} ${row.files.join(' ')}`));
}
console.log(`${rows.length} tệp test, ${rows.reduce((sum, row) => sum + row.count, 0)} phép so chuỗi trên ${markup ? 'HTML/CSS' : 'mã JS'}`);
