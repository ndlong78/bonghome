const assert = require('node:assert/strict');

const engine = require('../js/game6-engine.js');

/** RNG có hạt giống để test lặp lại được. */
function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

const twinIndexes = (cells) => {
  const code = engine.twinCode(cells);
  return cells.map((item, index) => (item === code ? index : -1)).filter((index) => index >= 0);
};

// Mỗi vòng: đúng số ô, mã hợp lệ, đúng một cặp sinh đôi, còn lại khác nhau.
for (let seed = 1; seed <= 50; seed += 1) {
  engine.ROUNDS.forEach((config, round) => {
    const cells = engine.createRound(round, seededRng(seed * 31 + round));
    assert.equal(cells.length, config.cells);
    assert.ok(cells.every((code) => engine.parseCode(code)), 'mọi ô phải là tổ hợp hình-màu hợp lệ');
    assert.ok(engine.twinCode(cells), 'phải có đúng một cặp sinh đôi');
    assert.equal(new Set(cells).size, config.cells - 1);
  });
}
assert.throws(() => engine.createRound(5), RangeError);
assert.equal(engine.twinCode(['0-0', '0-1', '0-2']), null, 'không có cặp nào');
assert.equal(engine.twinCode(['0-0', '0-0', '0-1', '0-1']), null, 'hai cặp thì không hợp lệ');
assert.equal(engine.twinCode(['0-0', '0-0', '0-0']), null, 'ba ô giống nhau không phải cặp sinh đôi');
assert.equal(engine.parseCode('8-0'), null, 'chỉ có 8 kiểu hình');
assert.equal(engine.parseCode('0-6'), null, 'chỉ có 6 màu');

// Cỡ ô: vòng dày nhất vẫn ≥ 44px trên iPhone (390px), tối đa 96px trên màn rộng.
for (const config of engine.ROUNDS) {
  assert.ok(engine.cellSize(390, config.columns) >= 44, `${config.columns} cột trên 390px phải ≥ 44px`);
  assert.equal(engine.cellSize(1440, config.columns) <= 96, true);
}
assert.equal(engine.cellSize(390, 6), 48);

// Luồng chơi: chọn, bỏ chọn, chọn nhầm, tìm đúng, qua vòng, thắng.
{
  const rng = seededRng(7);
  let state = engine.createGame(rng);
  assert.deepEqual([state.round, state.wrong, state.seconds, state.started], [0, 0, 0, false]);
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa chạm');

  const [first, second] = twinIndexes(state.cells);
  const other = state.cells.findIndex((code, index) => index !== first && index !== second);

  let result = engine.select(state, first);
  assert.equal(result.event, 'selected');
  assert.equal(result.startedNow, true);
  state = result.state;
  assert.equal(engine.tick(state).seconds, 1);

  result = engine.select(state, first);
  assert.equal(result.event, 'deselected');
  assert.equal(result.startedNow, false);
  state = result.state;

  state = engine.select(state, first).state;
  result = engine.select(state, other);
  assert.equal(result.event, 'mismatch');
  assert.deepEqual(result.pair, [first, other]);
  state = result.state;
  assert.equal(state.wrong, 1);
  assert.equal(state.selectedIndex, -1);

  state = engine.select(state, first).state;
  result = engine.select(state, second);
  assert.equal(result.event, 'match');
  state = result.state;
  assert.equal(state.locked, true);
  assert.equal(engine.canSave(state), false, 'không lưu khi vừa tìm đúng (đang chờ sang vòng)');
  assert.equal(engine.select(state, other).event, 'ignored', 'vòng đã khóa thì bỏ qua chạm');

  state = engine.nextRound(state, rng);
  assert.equal(state.round, 1);
  assert.equal(state.cells.length, engine.ROUNDS[1].cells);
  assert.equal(engine.canSave(state), true);

  for (let round = 1; round < engine.ROUNDS.length; round += 1) {
    const [a, b] = twinIndexes(state.cells);
    state = engine.select(engine.select(state, a).state, b).state;
    state = engine.nextRound(state, rng);
  }
  assert.equal(state.finished, true);
  assert.equal(engine.moves(state), 5 + 1, 'số lượt = 5 vòng + 1 lần chọn nhầm (như bản cũ)');
  assert.equal(engine.tick(state).seconds, state.seconds, 'đồng hồ dừng khi thắng');
  assert.equal(engine.canSave(state), false);
}

// Chạm ngoài lưới hoặc chỉ số lạ thì bỏ qua.
{
  const state = engine.createGame(seededRng(3));
  for (const index of [-1, 12, 1.5, '2', null]) assert.equal(engine.select(state, index).event, 'ignored');
}

// Trạng thái không bị sửa tại chỗ.
{
  const state = engine.createGame(seededRng(5));
  const next = engine.select(state, 0).state;
  assert.equal(state.selectedIndex, -1);
  assert.equal(next.selectedIndex, 0);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.cells));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = engine.createGame(seededRng(11));
  state = engine.select(state, 2).state;
  state = engine.tick(engine.tick(state));
  const saved = engine.serialize(state, 'game6-abc');
  assert.deepEqual(Object.keys(saved).sort(), ['cells', 'round', 'schemaVersion', 'seconds', 'selectedIndex', 'sessionId', 'started', 'wrong']);
  assert.equal(saved.schemaVersion, 1);
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(
    { round: restored.round, cells: [...restored.cells], selectedIndex: restored.selectedIndex, seconds: restored.seconds, started: restored.started },
    { round: 0, cells: [...state.cells], selectedIndex: 2, seconds: 2, started: true }
  );
}

// Bản lưu do adapter cũ (trước khi tách engine) tạo ra vẫn khôi phục được.
{
  const legacy = {
    schemaVersion: 1,
    sessionId: 'game6-legacy',
    round: 1,
    cells: ['0-0', '1-1', '2-2', '3-3', '4-4', '5-5', '6-0', '7-1', '0-2', '1-3', '2-4', '3-5', '4-0', '5-1', '6-2', '2-2'],
    selectedIndex: 4,
    wrong: 3,
    seconds: 75,
    started: true
  };
  const restored = engine.restore(legacy);
  assert.equal(restored.round, 1);
  assert.equal(restored.selectedIndex, 4);
  assert.equal(restored.wrong, 3);
  assert.equal(restored.seconds, 75);
  assert.equal(engine.twinCode(restored.cells), '2-2');
}

// Bản lưu hỏng thì bỏ (bé bắt đầu ván mới), không làm hỏng trò chơi.
{
  const valid = engine.serialize(engine.createGame(seededRng(13)), 's');
  const broken = [
    null,
    'x',
    { ...valid, round: 5 },
    { ...valid, round: -1 },
    { ...valid, cells: valid.cells.slice(1) },
    { ...valid, cells: valid.cells.map((code, index) => (index === 0 ? '9-9' : code)) },
    { ...valid, cells: valid.cells.map((code, index) => (index === 0 ? '<img onerror=x>' : code)) },
    { ...valid, cells: [...new Set(valid.cells), '7-5'] }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
  const clamped = engine.restore({ ...valid, wrong: -4, seconds: 'x', selectedIndex: 99 });
  assert.deepEqual([clamped.wrong, clamped.seconds, clamped.selectedIndex], [0, 0, -1]);
}

console.log('Game 6 engine checks passed.');
