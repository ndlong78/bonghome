const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const serviceWorker = read('sw.js');

// Vùng nội dung chính có tên, chỉ đọc (ô nhập duy nhất là cổng phụ huynh trong hộp thoại xoá, không có name), ghi
// chú quyền riêng tư: e2e/page-structure.spec.js. Bảng số liệu hiển thị đúng dữ liệu, chỉ đọc qua module dùng chung
// (không tự gọi localStorage/fetch), trang chủ có lối vào: e2e/parent-dashboard.spec.js. Module nạp đúng:
// e2e/page-modules.spec.js. Vùng chạm, focus ring, giảm chuyển động: e2e/touch-targets.spec.js,
// e2e/focus-visible.spec.js, e2e/reduced-motion-all-pages.spec.js.

['./parents.html', './js/parent-dashboard.js', './css/parent-dashboard.css'].forEach((asset) => {
  assert.ok(serviceWorker.includes(asset), `${asset} must be cached offline`);
});
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Parent dashboard checks passed.');
