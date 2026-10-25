const assert = require('node:assert/strict');

const engine = require('../js/game3-engine.js');

/** RNG có hạt giống để test lặp lại được. */
function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

// Kho hình giữ đúng id cũ vì bản lưu ghi id.
assert.deepEqual(engine.SHAPES.map((shape) => shape.id),
  ['ngoiSao', 'traiTim', 'vuongMien', 'caiNam', 'conCa', 'chiecLa', 'ngoiNha', 'trangLuoi']);
assert.equal(engine.PIECE_COUNT, 6);
assert.equal(engine.shapeById('nope'), null);
assert.equal(engine.shapeById('toString'), null);

// Ván mới: 6 hình khác nhau, khay và hàng bóng là cùng một bộ; rng kém (kể cả trả về 1) không làm hỏng.
for (let seed = 1; seed <= 50; seed += 1) {
  const state = engine.createGame(seededRng(seed));
  assert.equal(new Set(state.colorOrder).size, 6);
  assert.deepEqual([...state.shadowOrder].sort(), [...state.colorOrder].sort());
  assert.deepEqual([state.matched, state.wrong, state.seconds, state.started, state.finished], [[], 0, 0, false, false]);
}
for (const constant of [0, 0.5, 0.999999, 1]) {
  const state = engine.createGame(() => constant);
  assert.equal(new Set(state.colorOrder).size, 6);
  assert.deepEqual([...state.shadowOrder].sort(), [...state.colorOrder].sort());
}
// Fisher–Yates: mỗi hình đều có lúc đứng đầu khay và đều có lúc bị bỏ ra khỏi ván.
{
  const first = new Set();
  const left = new Set();
  for (let seed = 1; seed <= 200; seed += 1) {
    const state = engine.createGame(seededRng(seed));
    first.add(state.colorOrder[0]);
    engine.SHAPES.forEach((shape) => { if (!state.colorOrder.includes(shape.id)) left.add(shape.id); });
  }
  assert.equal(first.size, 8);
  assert.equal(left.size, 8);
}

// Luồng chơi: nhấc hình, thả ra ngoài, thả nhầm, ghép đúng hết, thắng.
{
  let state = engine.createGame(seededRng(7));
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa nhấc hình');
  const [first, second] = state.colorOrder;

  let result = engine.pickUp(state, first);
  assert.deepEqual([result.event, result.startedNow], ['picked', true]);
  state = engine.tick(result.state);
  assert.equal(state.seconds, 1);

  assert.equal(engine.drop(state, first, null).event, 'ignored', 'thả ra ngoài thì bỏ qua, không tính nhầm');
  result = engine.drop(state, first, second);
  assert.equal(result.event, 'wrong');
  state = result.state;
  assert.equal(state.wrong, 1);

  state.colorOrder.forEach((id, index) => {
    assert.equal(engine.pickUp(state, id).startedNow, false);
    result = engine.drop(state, id, id);
    assert.equal(result.event, index === 5 ? 'completed' : 'correct');
    state = result.state;
    assert.equal(engine.canSave(state), index < 5);
  });
  assert.equal(state.finished, true);
  assert.equal(engine.moves(state), 7, 'giữ công thức số lượt cũ: ghép nhầm + đã ghép');
  assert.equal(engine.tick(state).seconds, 1, 'đồng hồ dừng khi ghép xong');
  assert.equal(engine.pickUp(state, first).event, 'ignored');
}

// Hình đã ghép không nhấc lại được; thả lên bóng đã ghép thì bỏ qua (như bản cũ); id lạ bị bỏ qua.
{
  let state = engine.createGame(seededRng(3));
  const [a, b] = state.colorOrder;
  state = engine.drop(state, a, a).state;
  assert.equal(engine.pickUp(state, a).event, 'ignored');
  assert.equal(engine.drop(state, a, a).event, 'ignored');
  assert.equal(engine.drop(state, b, a).event, 'ignored', 'thả lên bóng đã ghép không tính nhầm');
  assert.equal(engine.drop(state, b, a).state.wrong, 0);
  const outside = engine.SHAPES.map((shape) => shape.id).find((id) => !state.colorOrder.includes(id));
  for (const id of [outside, 'toString', '', null, undefined, 3]) {
    assert.equal(engine.pickUp(state, id).event, 'ignored');
    assert.equal(engine.drop(state, b, id).event, 'ignored');
    assert.equal(engine.drop(state, id, b).event, 'ignored');
  }
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.matched) && Object.isFrozen(state.colorOrder));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine; `matched` theo thứ tự bóng trên màn hình.
{
  let state = engine.createGame(seededRng(11));
  const reversed = [...state.shadowOrder].reverse();
  state = engine.pickUp(state, reversed[0]).state;
  state = engine.drop(engine.drop(state, reversed[0], reversed[0]).state, reversed[1], reversed[1]).state;
  state = engine.tick(engine.drop(state, reversed[2], reversed[3]).state);
  const saved = engine.serialize(state, 'game3-abc');
  assert.deepEqual(Object.keys(saved).sort(), ['colorOrder', 'matched', 'schemaVersion', 'seconds', 'sessionId', 'shadowOrder', 'started', 'wrong']);
  assert.deepEqual(saved.matched, [reversed[1], reversed[0]], 'thứ tự như các bóng .dung trên màn hình');
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(engine.serialize(restored, 'game3-abc'), saved);
  assert.equal(engine.drop(restored, reversed[2], reversed[2]).event, 'correct', 'chơi tiếp được');
}

// Bản lưu do adapter cũ tạo ra vẫn khôi phục được.
const legacy = {
  schemaVersion: 1,
  sessionId: 'game3-legacy',
  colorOrder: ['conCa', 'ngoiSao', 'chiecLa', 'traiTim', 'ngoiNha', 'caiNam'],
  shadowOrder: ['traiTim', 'caiNam', 'conCa', 'ngoiNha', 'ngoiSao', 'chiecLa'],
  matched: ['caiNam', 'ngoiSao'],
  wrong: 2,
  seconds: 37,
  started: true
};
{
  const restored = engine.restore(legacy);
  assert.deepEqual(restored.matched, ['caiNam', 'ngoiSao']);
  assert.deepEqual([restored.wrong, restored.seconds, restored.started, restored.finished], [2, 37, true, false]);
}

// Bản lưu hỏng thì bỏ (bé chơi ván mới); id lạ trong matched bị bỏ thay vì đếm sai.
{
  const broken = [
    null,
    'x',
    { ...legacy, colorOrder: legacy.colorOrder.slice(1) },
    { ...legacy, shadowOrder: [...legacy.shadowOrder, 'trangLuoi'] },
    { ...legacy, colorOrder: ['conCa', 'conCa', 'chiecLa', 'traiTim', 'ngoiNha', 'caiNam'] },
    { ...legacy, colorOrder: ['conCa', 'ngoiSao', 'chiecLa', 'traiTim', 'ngoiNha', 'trangLuoi'] },
    { ...legacy, shadowOrder: ['traiTim', 'caiNam', 'conCa', 'ngoiNha', 'ngoiSao', '<img onerror=x>'] },
    { ...legacy, matched: [...legacy.shadowOrder] }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
  const cleaned = engine.restore({ ...legacy, matched: ['caiNam', 'trangLuoi', 'caiNam', 7], wrong: -1, seconds: 4.8 });
  assert.deepEqual([cleaned.matched, cleaned.wrong, cleaned.seconds], [['caiNam'], 0, 4]);
  assert.deepEqual(engine.restore({ ...legacy, matched: undefined }).matched, []);
}

console.log('Game 3 engine checks passed.');
