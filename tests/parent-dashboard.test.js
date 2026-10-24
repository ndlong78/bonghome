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
assert.doesNotMatch(html, /<form|<textarea|<select/, 'Trang phụ huynh nền tảng phải chỉ đọc');
// Ô nhập duy nhất là cổng phụ huynh trong hộp thoại xóa: chỉ để xác nhận, không lưu, không gửi đi.
{
  const inputs = html.match(/<input\b[^>]*>/g) || [];
  assert.equal(inputs.length, 1, 'Chỉ cho phép ô trả lời của cổng phụ huynh');
  assert.match(inputs[0], /id="parentGateAnswer"/);
  assert.doesNotMatch(inputs[0], /\sname=/, 'Ô cổng phụ huynh không được có name (không phải dữ liệu thu thập)');
  const dialogStart = html.indexOf('<dialog id="parentDataDialog"');
  const dialogEnd = html.indexOf('</dialog>', dialogStart);
  const inputAt = html.indexOf(inputs[0]);
  assert.ok(dialogStart >= 0 && inputAt > dialogStart && inputAt < dialogEnd, 'Ô cổng phụ huynh phải nằm trong hộp thoại xóa');
}
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
