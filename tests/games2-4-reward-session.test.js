'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js/games2-4-autosave.js'), 'utf8');
// Vòng đời phiên thưởng do khung chung điều phối; phần riêng của Game 2-4 chỉ
// còn việc dọn bảng thưởng và khai báo nút nào kích hoạt ván mới.
const core = fs.readFileSync(path.join(__dirname, '..', 'js/autosave-core.js'), 'utf8');

test('Games 2-4 create a new reward transaction for every new round', () => {
  assert.match(core, /function createSessionId\(gameId\)/);
  assert.match(core, /function resetSession\(\)[\s\S]*sessionId = createSessionId\(gameId\)/);
  assert.match(source, /resetSelectors: \['#nutVanMoi', '#nutChoiLai'\]/);
  assert.match(source, /onSessionReset: resetRewardSession/);
  assert.match(core, /queueMicrotask\(resetSession\)/);
  assert.match(core, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
});

test('starting a new round clears the old reward summary and restarts autosave', () => {
  assert.match(source, /\.man-thang \.bh-reward-summary/);
  assert.match(source, /summary\.replaceChildren\(\)/);
  assert.match(source, /summary\.hidden = true/);
  assert.match(source, /restartTimerOnReset: true/);
  assert.match(core, /clearInterval\(saveTimer\);[\s\S]*save\(\);[\s\S]*startTimer\(\);/);
});
