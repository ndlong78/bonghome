'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const createProfile = require(path.join(root, 'js', 'profile.js'));

function memoryStorage() {
  let value = null;
  return {
    get: () => value,
    set: (key, next) => { value = next; return next; }
  };
}

// Tầng dữ liệu cố tình KHÔNG escape: tên là văn bản thuần, việc hiển thị an toàn
// là trách nhiệm của tầng render. Test này khóa lại tiền đề đó để lý do dùng
// textContent ở profile-ui.js không bị quên.
{
  const profile = createProfile(memoryStorage());

  const payload = '<svg onload=alert()>';
  const saved = profile.saveProfile({ displayName: payload });
  assert.equal(saved.displayName, payload, 'tên được giữ nguyên dạng văn bản');
  assert.equal(saved.displayName.length, 20, 'payload vừa khít giới hạn 20 ký tự');

  assert.equal(profile.saveProfile({ displayName: 'A < B & C' }).displayName, 'A < B & C');
  assert.equal(profile.saveProfile({ displayName: '  ' }).displayName, 'Bông', 'tên rỗng quay về mặc định');
  assert.equal(
    profile.saveProfile({ displayName: 'x'.repeat(40) }).displayName.length,
    20,
    'tên dài bị cắt còn 20 ký tự'
  );
}

/**
 * Bất biến chung: không file giao diện nào được gán innerHTML bằng chuỗi có nội
 * suy `${...}`. Chuỗi tĩnh vẫn được phép; mọi giá trị động phải đi qua
 * textContent. Bắt được cả cách viết mới lẫn cách viết cũ.
 */
const INTERPOLATED_INNERHTML = /\.innerHTML\s*=\s*`[^`]*\$\{/;

for (const file of ['js/profile-ui.js', 'js/theme-picker.js', 'js/profile.js']) {
  const source = read(file);
  assert.equal(
    INTERPOLATED_INNERHTML.test(source),
    false,
    `${file} không được gán innerHTML từ chuỗi có nội suy`
  );
}

// Nút hồ sơ và nút chủ đề phải dựng bằng textContent.
const profileUi = read('js/profile-ui.js');
assert.match(profileUi, /name\.textContent = current\.displayName;/, 'tên hiển thị phải đi qua textContent');
assert.match(profileUi, /button\.replaceChildren\(icon, name\);/);
assert.equal(
  profileUi.includes('<strong>${current.displayName}</strong>'),
  false,
  'không được giữ lại bản chèn tên bằng innerHTML'
);

const themePicker = read('js/theme-picker.js');
assert.match(themePicker, /name\.textContent = theme\.name;/);
assert.match(themePicker, /icon\.textContent = theme\.icon \|\| '🎨';/);

// Danh sách avatar cũng dựng bằng nút DOM thay vì chuỗi HTML.
assert.match(profileUi, /radio\.type = 'radio';/);
assert.match(profileUi, /name\.textContent = avatar\.name;/);
assert.match(profileUi, /label\.append\(radio, icon, name\);/);

console.log('✓ User content escaping checks passed');
