'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sharedUi = fs.readFileSync(path.join(__dirname, '..', 'shared-ui.js'), 'utf8');

for (const group of ['games2-4', 'games5-7', 'games8-10']) {
  test(`${group} autosave receives reward-aware BongProgress`, () => {
    const escaped = group.replace('-', '\\-');
    const pattern = new RegExp(
      `loadSharedScript\\('\\.\\/js\\/${escaped}-rewards\\.js'[\\s\\S]*?modules\\.progress = window\\.BongProgress[\\s\\S]*?loadSharedScript\\('\\.\\/js\\/${escaped}-autosave\\.js'`
    );
    assert.match(sharedUi, pattern);
  });
}

test('all completion dialogs expose the shared win-dialog structure', () => {
  for (let game = 1; game <= 10; game += 1) {
    const html = fs.readFileSync(path.join(__dirname, '..', `game${game}.html`), 'utf8');
    assert.match(html, /class="man-thang"/, `game${game} is missing .man-thang`);
    assert.match(html, /class="hop-thang"/, `game${game} is missing .hop-thang`);
    assert.match(html, /class="nhom-nut"/, `game${game} is missing .nhom-nut`);
  }
});
