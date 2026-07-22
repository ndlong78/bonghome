const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('parents.html');
const dashboard = read('js/parent-dashboard.js');
const profileUi = read('js/profile-ui.js');
const profileCss = read('css/profile.css');
const parentCss = read('css/parent-dashboard.css');
const serviceWorker = read('sw.js');

assert.match(html, /<main class="bh-parent"/);
assert.match(html, /id="completedCount"/);
assert.match(html, /id="starCount"/);
assert.match(html, /Dữ liệu hồ sơ, tiến độ và phần thưởng chỉ được lưu/);
assert.doesNotMatch(html, /email|số điện thoại|ngày sinh|trường học/i, 'Trang không được yêu cầu trường dữ liệu cá nhân');
assert.match(html, /\.\/shared-ui\.js/);
assert.match(html, /\.\/js\/parent-dashboard\.js/);

assert.match(dashboard, /BongModulesReady/);
assert.match(dashboard, /getProfile/);
assert.match(dashboard, /getSummary/);
assert.match(dashboard, /stickerIds/);
assert.match(dashboard, /badgeIds/);
assert.doesNotMatch(dashboard, /localStorage|fetch\(/, 'Dashboard chỉ đọc qua module dùng chung');

assert.match(profileUi, /\.\/parents\.html/);
assert.match(profileUi, /Dành cho phụ huynh/);
assert.match(profileCss, /\.bh-parent-link/);
assert.match(profileCss, /min-height:var\(--bh-touch-target,44px\)/);
assert.match(parentCss, /prefers-reduced-motion/);
assert.match(parentCss, /focus-visible/);

['./parents.html', './js/parent-dashboard.js', './css/parent-dashboard.css'].forEach((asset) => {
  assert.ok(serviceWorker.includes(asset), `${asset} must be cached offline`);
});
assert.match(serviceWorker, /const PHIEN_BAN = "bonghome-v\d+-[a-z0-9-]+";/);

console.log('Parent dashboard checks passed.');
