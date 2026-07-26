const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'shared-ui.js'), 'utf8');

assert.match(source, /const STORAGE_KEY = 'bonghome_sound_enabled'/, 'Thiết lập âm thanh phải dùng khóa cục bộ ổn định');
assert.match(source, /localStorage\.getItem\(STORAGE_KEY\) !== 'false'/, 'Âm thanh phải mặc định bật khi chưa có lựa chọn');
assert.match(source, /localStorage\.setItem\(STORAGE_KEY, enabled \? 'true' : 'false'\)/, 'Lựa chọn âm thanh phải được lưu cục bộ');
assert.match(source, /bonghome:soundchange/, 'Thay đổi âm thanh phải phát sự kiện dùng chung');
assert.match(source, /speechSynthesis\.cancel\(\)/, 'Tắt âm thanh phải dừng giọng đọc đang phát');
assert.match(source, /button\.setAttribute\('aria-pressed'/, 'Nút âm thanh phải công bố trạng thái bật hoặc tắt');
assert.match(source, /button\.setAttribute\('aria-label'/, 'Nút âm thanh phải có nhãn hành động truy cập được');

console.log('✓ Hợp đồng thiết lập âm thanh dùng chung hợp lệ');
