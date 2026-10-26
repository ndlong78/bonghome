'use strict';

/*
 * Hợp đồng offline: mọi tệp JS/CSS chạy trên trang (gốc repo, js/, css/) đều có trong danh sách precache của sw.js.
 * Thay cho các dòng "tệp X phải có offline" rải trong từng test. Chiều ngược lại (mọi đường dẫn precache đều tồn
 * tại) được bước "Verify PWA files and offline cache paths" của CI kiểm.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// Không chạy trên trang: chính Service Worker và cấu hình test.
const NOT_SHIPPED = new Set(['sw.js', 'playwright.config.js']);

const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const precached = new Set([...serviceWorker.matchAll(/"\.\/([^"\n]+)"/g)].map((match) => match[1]));

const runtimeFiles = [
  ...fs.readdirSync(root).filter((file) => /\.(?:js|css)$/.test(file) && !NOT_SHIPPED.has(file)),
  ...fs.readdirSync(path.join(root, 'js')).filter((file) => file.endsWith('.js')).map((file) => `js/${file}`),
  ...fs.readdirSync(path.join(root, 'css')).filter((file) => file.endsWith('.css')).map((file) => `css/${file}`),
  ...fs.readdirSync(path.join(root, 'css', 'pages')).filter((file) => file.endsWith('.css')).map((file) => `css/pages/${file}`)
];

assert.ok(runtimeFiles.length > 50, 'phải quét được các tệp JS/CSS của trang');
assert.deepEqual(runtimeFiles.filter((file) => !precached.has(file)), [], 'tệp JS/CSS chưa có trong precache (sw.js)');

// Mọi trang HTML cũng phải có offline.
const pages = fs.readdirSync(root).filter((file) => file.endsWith('.html'));
assert.deepEqual(pages.filter((file) => !precached.has(file)), [], 'trang HTML chưa có trong precache (sw.js)');

console.log(`Service worker precache coverage checks passed (${runtimeFiles.length} tệp JS/CSS, ${pages.length} trang).`);
