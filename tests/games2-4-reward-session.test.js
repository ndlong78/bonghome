'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js/games2-4-autosave.js'), 'utf8');

test('Games 2-4 create a new reward transaction for every new round', () => {
  assert.match(source, /function createSessionId\(\)/);
  assert.match(source, /function resetRewardSession\(\)[\s\S]*sessionId = createSessionId\(\)/);
  assert.match(source, /#nutVanMoi, #nutChoiLai/);
  assert.match(source, /queueMicrotask\(\(\) => \{[\s\S]*resetRewardSession\(\)/);
  assert.match(source, /transactionId: `\$\{gameId\}-finish-\$\{sessionId\}`/);
});

test('starting a new round clears the old reward summary and restarts autosave', () => {
  assert.match(source, /\.man-thang \.bh-reward-summary/);
  assert.match(source, /summary\.replaceChildren\(\)/);
  assert.match(source, /summary\.hidden = true/);
  assert.match(source, /clearInterval\(saveTimer\)[\s\S]*save\(\)[\s\S]*saveTimer = setInterval\(save, SAVE_INTERVAL_MS\)/);
});
