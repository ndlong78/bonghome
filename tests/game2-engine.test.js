const assert = require('node:assert/strict');

const engine = require('../js/game2-engine.js');

/**
 * RNG có hạt giống (mulberry32) để test lặp lại được. Không dùng LCG đơn giản: với các hạt giống liên tiếp,
 * số đầu tiên của LCG gần như bằng nhau nên Fisher–Yates luôn đổi cùng một vật và vật đó không bao giờ được chọn.
 */
function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const ids = engine.OBJECTS.map((item) => item.id);
assert.deepEqual(ids, ['matTroi', 'may', 'ngoiSao', 'nhaKeo', 'kyLan', 'buom', 'cay', 'hoaTrai', 'meoCon', 'nam']);
assert.equal(engine.objectById('toString'), null);
// Vùng chạm các vật không chồng lên nhau: một lần chạm chỉ trúng tối đa một vật.
engine.OBJECTS.forEach((a, i) => engine.OBJECTS.slice(i + 1).forEach((b) => {
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r, `${a.id} và ${b.id} chồng vùng chạm`);
}));

// Ván mới: 5 vật khác nhau; mọi vật đều có lúc được chọn; rng kém (kể cả trả về 1) không làm hỏng.
{
  const chosen = new Set();
  for (let seed = 1; seed <= 60; seed += 1) {
    const state = engine.createGame(seededRng(seed));
    assert.equal(new Set(state.differences).size, 5);
    state.differences.forEach((id) => chosen.add(id));
    assert.deepEqual([state.found, state.wrong, state.hintsLeft, state.seconds, state.started], [[], 0, 2, 0, false]);
  }
  assert.equal(chosen.size, 10);
  for (const constant of [0, 0.5, 0.999999, 1]) assert.equal(new Set(engine.createGame(() => constant).differences).size, 5);
}

// Luồng chơi: chạm sai, chạm trúng, chạm lại chỗ đã tìm (vẫn tính sai như cũ), tìm đủ, thắng.
{
  let state = engine.createGame(seededRng(7));
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa chạm');
  const [first, ...rest] = state.differences.map(engine.objectById);
  const empty = engine.OBJECTS.find((item) => !state.differences.includes(item.id)); // vật không đổi

  let result = engine.tap(state, empty.x, empty.y);
  assert.deepEqual([result.event, result.startedNow], ['wrong', true]);
  state = engine.tick(result.state);

  result = engine.tap(state, first.x + first.r - 1, first.y);
  assert.deepEqual([result.event, result.object.id, result.startedNow], ['found', first.id, false]);
  state = result.state;
  result = engine.tap(state, first.x, first.y);
  assert.equal(result.event, 'wrong', 'giữ hành vi cũ: chạm lại chỗ đã tìm ra tính là chấm sai');
  state = result.state;
  assert.equal(engine.tap(state, first.x + first.r + 1, first.y).event, 'wrong', 'ngoài vùng chạm');

  rest.forEach((item, index) => {
    result = engine.tap(state, item.x, item.y);
    assert.equal(result.event, index === rest.length - 1 ? 'completed' : 'found');
    state = result.state;
    assert.equal(engine.canSave(state), index < rest.length - 1);
  });
  assert.deepEqual([state.finished, state.found.length, state.wrong, state.seconds], [true, 5, 2, 1]);
  assert.equal(engine.moves(state), 7, 'giữ công thức số lượt cũ: chấm sai + điểm đã tìm');
  assert.equal(engine.tick(state).seconds, 1, 'đồng hồ dừng khi tìm đủ');
  // Trước đây chạm trong lúc chờ màn thắng bị tính chấm sai; giờ bỏ qua.
  assert.equal(engine.tap(state, empty.x, empty.y).event, 'ignored');
  assert.equal(engine.hint(state).object, null);
  for (const [x, y] of [[NaN, 1], [1, Infinity]]) assert.equal(engine.tap(engine.createGame(), x, y).event, 'ignored');
}

// Gợi ý: chỉ điểm chưa tìm, tối đa 2 lượt, không bắt đầu đồng hồ; trạng thái không bị sửa tại chỗ.
{
  let state = engine.createGame(seededRng(3));
  const [first] = state.differences.map(engine.objectById);
  state = engine.tap(state, first.x, first.y).state;
  for (const value of [0, 0.5, 0.99]) {
    const { object } = engine.hint(state, () => value);
    assert.ok(state.differences.includes(object.id) && object.id !== first.id);
  }
  const fresh = engine.createGame(seededRng(3));
  let result = engine.hint(fresh, () => 0);
  assert.deepEqual([result.state.hintsLeft, result.state.started, fresh.hintsLeft], [1, false, 2]);
  result = engine.hint(result.state, () => 0);
  assert.equal(result.state.hintsLeft, 0);
  assert.equal(engine.hint(result.state).object, null, 'hết lượt gợi ý');
  assert.ok(Object.isFrozen(fresh) && Object.isFrozen(fresh.differences) && Object.isFrozen(fresh.found));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = engine.createGame(seededRng(11));
  const target = engine.objectById(state.differences[2]);
  state = engine.tick(engine.hint(engine.tap(state, target.x, target.y).state, () => 0).state);
  const saved = engine.serialize(state, 'game2-abc');
  assert.deepEqual(Object.keys(saved).sort(), ['differences', 'found', 'hintsLeft', 'schemaVersion', 'seconds', 'sessionId', 'started', 'wrong']);
  assert.deepEqual([saved.found, saved.hintsLeft, saved.seconds, saved.started], [[target.id], 1, 1, true]);
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(engine.serialize(restored, 'game2-abc'), saved);
}

// Bản lưu do adapter cũ tạo ra vẫn khôi phục được.
const legacy = {
  schemaVersion: 1, sessionId: 'game2-legacy', differences: ['may', 'cay', 'nam', 'buom', 'matTroi'],
  found: ['nam', 'may'], wrong: 3, hintsLeft: 1, seconds: 64, started: true
};
{
  const restored = engine.restore(legacy);
  assert.deepEqual([restored.found, restored.wrong, restored.hintsLeft, restored.seconds, restored.started], [['nam', 'may'], 3, 1, 64, true]);
  assert.deepEqual(engine.remaining(restored), ['cay', 'buom', 'matTroi']);
}

// Bản lưu hỏng thì bỏ (bé chơi tranh mới); giá trị lạ được làm sạch như adapter cũ.
{
  const broken = [
    null, 'x',
    { ...legacy, differences: legacy.differences.slice(1) },
    { ...legacy, differences: ['may', 'may', 'may', 'may', 'may'] },
    { ...legacy, differences: ['may', 'cay', 'nam', 'buom', 'toString'] },
    { ...legacy, differences: 'may' },
    { ...legacy, found: [...legacy.differences] }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
  const cleaned = engine.restore({ ...legacy, found: ['nam', 'ngoiSao', 'nam', 7], wrong: -1, hintsLeft: 9, seconds: 2.6 });
  assert.deepEqual([cleaned.found, cleaned.wrong, cleaned.hintsLeft, cleaned.seconds], [['nam'], 0, 2, 2]);
  assert.deepEqual(engine.restore({ ...legacy, found: 'x', hintsLeft: 'x' }).found, []);
  assert.equal(engine.restore({ ...legacy, hintsLeft: undefined }).hintsLeft, 2);
}

console.log('Game 2 engine checks passed.');
