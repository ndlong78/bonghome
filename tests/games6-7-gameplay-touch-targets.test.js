'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const game6Engine = require('../js/game6-engine.js');

const MIN_TARGET_PX = 44;
const PHONE_WIDTH_PX = 390;

test('Game 6 keeps every round above 44px on iPhone width', () => {
  // Dùng đúng hàm cỡ ô và cấu hình vòng mà giao diện Game 6 dùng (js/game6-engine.js).
  assert.deepEqual(game6Engine.ROUNDS.at(-1), { cells: 30, columns: 6 });
  for (const round of game6Engine.ROUNDS) {
    const size = game6Engine.cellSize(PHONE_WIDTH_PX, round.columns);
    assert.ok(size >= MIN_TARGET_PX, `Ô Game 6 (${round.columns} cột) chỉ ${size}px, cần tối thiểu ${MIN_TARGET_PX}px`);
  }
});

// Lựa chọn Game 7 xếp 4 cột (màn hẹp 2 cột), hình lấp đầy nút: e2e/gameplay-layout.spec.js; vùng chạm ≥44px:
// e2e/games6-7-gameplay-touch-targets.spec.js.
