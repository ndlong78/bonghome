'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Autosave nhận BongProgress đã bọc phần thưởng: e2e/page-modules.spec.js (thứ tự nạp) và các E2E gameplay
// (thắng thật thì hộp thắng có tóm tắt phần thưởng).

test('all completion dialogs expose the shared win-dialog structure', () => {
  for (let game = 1; game <= 10; game += 1) {
    const html = fs.readFileSync(path.join(__dirname, '..', `game${game}.html`), 'utf8');
    assert.match(html, /class="man-thang"/, `game${game} is missing .man-thang`);
    assert.match(html, /class="hop-thang"/, `game${game} is missing .hop-thang`);
    assert.match(html, /class="nhom-nut"/, `game${game} is missing .nhom-nut`);
  }
});
