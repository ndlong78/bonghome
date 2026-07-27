const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'profile-ui.js'), 'utf8');

assert.match(source, /dialog\.tabIndex\s*=\s*-1/, 'dialog phải có điểm focus dự phòng');
assert.match(source, /item\.inert\s*=\s*true/, 'nền trang phải bị khóa khi mở dialog');
assert.match(source, /item\.inert\s*=\s*false/, 'nền trang phải được mở khóa khi đóng dialog');
assert.match(source, /event\.key\s*===\s*['"]Escape['"]/, 'Escape phải đóng dialog');
assert.match(source, /event\.key\s*!==\s*['"]Tab['"]/, 'dialog phải xử lý vòng focus bằng Tab');
assert.match(source, /previousFocus/, 'dialog phải ghi nhớ và khôi phục focus trước đó');

console.log('✓ Profile dialog focus contract passed');
