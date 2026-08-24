'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter((name) => name.endsWith('.html')).sort();

assert.equal(pages.length, 13, 'dự án có 13 trang: chủ, phụ huynh, bộ sưu tập và 10 game');

/**
 * Mọi trang đều phải khai báo đủ để cài lên Màn hình chính. Trước đây chỉ 3/13
 * trang có: mở thẳng link một game rồi "Thêm vào MH chính" sẽ ra biểu tượng ảnh
 * chụp màn hình thay vì icon app, và thanh trạng thái sai màu.
 */
const REQUIRED = [
  { label: 'manifest', pattern: /<link rel="manifest" href="\.\/manifest\.json">/ },
  { label: 'theme-color', pattern: /<meta name="theme-color" content="#FFB7C5">/ },
  { label: 'favicon', pattern: /<link rel="icon" href="\.\/favicon\.ico">/ },
  { label: 'icon 192', pattern: /<link rel="icon" type="image\/png" sizes="192x192" href="\.\/icon-192\.png">/ },
  { label: 'apple-touch-icon', pattern: /<link rel="apple-touch-icon" href="\.\/apple-touch-icon\.png">/ },
  { label: 'mobile-web-app-capable', pattern: /<meta name="mobile-web-app-capable" content="yes">/ },
  { label: 'apple-mobile-web-app-capable', pattern: /<meta name="apple-mobile-web-app-capable" content="yes">/ },
  { label: 'status-bar-style', pattern: /<meta name="apple-mobile-web-app-status-bar-style" content="default">/ },
  { label: 'app-title', pattern: /<meta name="apple-mobile-web-app-title" content="Bông Home's">/ }
];

for (const page of pages) {
  const source = fs.readFileSync(path.join(root, page), 'utf8');
  const head = source.slice(0, source.indexOf('</head>'));
  assert.ok(head.length > 0, `${page} phải có thẻ head`);

  for (const { label, pattern } of REQUIRED) {
    assert.match(head, pattern, `${page} thiếu khai báo ${label}`);
  }

  // Khai báo trùng lặp gây khó lần khi sửa; mỗi loại chỉ được xuất hiện một lần.
  assert.equal((head.match(/<link rel="manifest"/g) || []).length, 1, `${page} khai báo manifest trùng`);
  assert.equal((head.match(/<meta name="theme-color"/g) || []).length, 1, `${page} khai báo theme-color trùng`);
  assert.equal((head.match(/<link rel="apple-touch-icon"/g) || []).length, 1, `${page} khai báo apple-touch-icon trùng`);
}

// Tệp được trỏ tới phải tồn tại thật và nằm trong danh sách cache ngoại tuyến.
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const asset of ['manifest.json', 'favicon.ico', 'icon-192.png', 'apple-touch-icon.png']) {
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} phải tồn tại`);
  assert.ok(serviceWorker.includes(`./${asset}`), `${asset} phải được cache ngoại tuyến`);
}

// theme-color phải khớp manifest, nếu không thanh trạng thái đổi màu khi mở game.
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.theme_color, '#FFB7C5', 'theme_color trong manifest phải khớp thẻ meta của các trang');

console.log(`✓ PWA meta checks passed (${pages.length} trang)`);
