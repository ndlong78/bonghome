const assert = require('node:assert/strict');

const engine = require('../js/game4-engine.js');

/** RNG có hạt giống để test lặp lại được. */
function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

// Màu và số kiểu giữ như cũ vì bản lưu ghi id màu và chỉ số kiểu.
assert.deepEqual(engine.COLORS.map((color) => color.id), ['hong', 'vang', 'mint', 'tim']);
assert.equal(engine.SHAPE_COUNT, 8);
assert.equal(engine.ITEM_COUNT, 12);
assert.equal(engine.colorById('toString'), null);
// Mẫu SVG chỉ dựng từ màu có sẵn: đổi màu thì đổi fill/stroke, không chèn gì khác.
assert.ok(engine.shapeSvg(6, 'tim').includes('fill="#C9B6F5" stroke="#9B85D6"'));
assert.ok(engine.shapeSvg(0, 'hong').startsWith('<svg viewBox="0 0 100 100"><circle cx="50" cy="55" r="34" fill="#FFB7C5"'));

// Ván mới: 12 đồ vật, mỗi màu 3 cái, kiểu hợp lệ; rng kém (kể cả trả về 1) không làm hỏng.
const perColor = (state) => engine.COLORS.map((color) => state.objects.filter((item) => item.color === color.id).length);
for (let seed = 1; seed <= 40; seed += 1) {
  const state = engine.createGame(seededRng(seed));
  assert.equal(state.objects.length, 12);
  assert.deepEqual(perColor(state), [3, 3, 3, 3]);
  assert.ok(state.objects.every((item) => Number.isInteger(item.shape) && item.shape >= 0 && item.shape < 8 && item.done === false));
  assert.deepEqual([engine.collected(state), state.wrong, state.seconds, state.started, state.finished], [0, 0, 0, false, false]);
}
for (const constant of [0, 0.5, 0.999999, 1]) {
  const state = engine.createGame(() => constant);
  assert.deepEqual(perColor(state), [3, 3, 3, 3]);
  assert.ok(state.objects.every((item) => item.shape >= 0 && item.shape < 8));
}
// Fisher–Yates: màu nào cũng có lúc đứng đầu sân.
{
  const first = new Set();
  for (let seed = 1; seed <= 100; seed += 1) first.add(engine.createGame(seededRng(seed)).objects[0].color);
  assert.equal(first.size, 4);
}

// Luồng chơi: nhấc, thả ra ngoài, bỏ nhầm giỏ, gom hết, thắng.
{
  let state = engine.createGame(seededRng(5));
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa nhấc đồ vật');
  let result = engine.pickUp(state, 0);
  assert.deepEqual([result.event, result.startedNow], ['picked', true]);
  state = engine.tick(result.state);

  assert.equal(engine.drop(state, 0, null).event, 'ignored', 'thả ra ngoài thì bỏ qua, không tính nhầm');
  const wrongColor = engine.COLORS.find((color) => color.id !== state.objects[0].color).id;
  result = engine.drop(state, 0, wrongColor);
  assert.equal(result.event, 'wrong');
  state = result.state;
  assert.equal(state.wrong, 1);

  state.objects.forEach((item, index) => {
    result = engine.drop(state, index, item.color);
    assert.equal(result.event, index === 11 ? 'completed' : 'correct');
    state = result.state;
    assert.equal(engine.collected(state), index + 1);
    assert.equal(engine.canSave(state), index < 11);
  });
  assert.deepEqual(engine.basketCounts(state), { hong: 3, vang: 3, mint: 3, tim: 3 });
  assert.equal(engine.moves(state), 13, 'giữ công thức số lượt cũ: bỏ nhầm + đã gom');
  assert.equal(state.finished, true);
  assert.equal(engine.tick(state).seconds, 1, 'đồng hồ dừng khi gom xong');
  assert.equal(engine.pickUp(state, 0).event, 'ignored');
}

// Đồ vật đã gom không nhấc/thả lại được; chỉ số hay giỏ lạ thì bỏ qua; trạng thái không bị sửa tại chỗ.
{
  const state = engine.createGame(seededRng(9));
  const next = engine.drop(state, 3, state.objects[3].color).state;
  assert.equal(state.objects[3].done, false);
  assert.equal(next.objects[3].done, true);
  assert.equal(engine.pickUp(next, 3).event, 'ignored');
  assert.equal(engine.drop(next, 3, next.objects[3].color).event, 'ignored');
  for (const index of [-1, 12, 1.5, '0', null]) assert.equal(engine.pickUp(next, index).event, 'ignored');
  for (const basket of ['do', 'toString', '', undefined]) assert.equal(engine.drop(next, 0, basket).event, 'ignored');
  assert.ok(Object.isFrozen(next) && Object.isFrozen(next.objects) && Object.isFrozen(next.objects[0]));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = engine.createGame(seededRng(21));
  state = engine.pickUp(state, 2).state;
  state = engine.drop(engine.drop(state, 2, state.objects[2].color).state, 7, state.objects[7].color).state;
  state = engine.tick(state);
  const saved = engine.serialize(state, 'game4-abc');
  assert.deepEqual(Object.keys(saved).sort(), ['basketCounts', 'collected', 'objects', 'schemaVersion', 'seconds', 'sessionId', 'started', 'wrong']);
  assert.deepEqual(Object.keys(saved.objects[0]).sort(), ['color', 'done', 'shape']);
  assert.equal(saved.collected, 2);
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(engine.serialize(restored, 'game4-abc'), saved);
}

// Bản lưu do adapter cũ tạo ra vẫn khôi phục được; số đã gom và số trong giỏ tính lại từ đồ vật.
const legacyObjects = [];
engine.COLORS.forEach((color, c) => {
  for (let i = 0; i < 3; i += 1) legacyObjects.push({ color: color.id, shape: (i + c) % 8, done: c === 1 && i < 2 });
});
const legacy = {
  schemaVersion: 1,
  sessionId: 'game4-legacy',
  objects: legacyObjects,
  basketCounts: { hong: 0, vang: 2, mint: 0, tim: 0 },
  collected: 2,
  wrong: 3,
  seconds: 42,
  started: true
};
{
  const restored = engine.restore(legacy);
  assert.equal(engine.collected(restored), 2);
  assert.deepEqual(engine.basketCounts(restored), { hong: 0, vang: 2, mint: 0, tim: 0 });
  assert.deepEqual([restored.wrong, restored.seconds, restored.started], [3, 42, true]);
  const lying = engine.restore({ ...legacy, collected: 11, basketCounts: { hong: 9, vang: 0, mint: 0, tim: 0 } });
  assert.deepEqual([engine.collected(lying), engine.basketCounts(lying).hong], [2, 0], 'không tin số đếm đã lưu');
}

// Bản lưu rất cũ chỉ có HTML: kiểu đồ vật nhận lại qua hàm của giao diện; không khớp thì bỏ bản lưu.
{
  const htmlOnly = { ...legacy, objects: legacyObjects.map(({ color, done }, index) => ({ color, html: `shape-${index % 8}`, done })) };
  const resolved = engine.restore(htmlOnly, { shapeFromHtml: (color, html) => Number(html.slice(6)) });
  assert.deepEqual(resolved.objects.map((item) => item.shape), legacyObjects.map((_, index) => index % 8));
  assert.equal(engine.restore(htmlOnly), null, 'không có hàm nhận lại thì bỏ bản lưu');
  assert.equal(engine.restore(htmlOnly, { shapeFromHtml: () => -1 }), null, 'HTML lạ thì bỏ bản lưu');
}

// Bản lưu hỏng thì bỏ (bé chơi ván mới).
{
  const broken = [
    null,
    'x',
    { ...legacy, objects: legacyObjects.slice(1) },
    { ...legacy, objects: legacyObjects.map((item, i) => (i === 0 ? { ...item, color: 'do' } : item)) },
    { ...legacy, objects: legacyObjects.map((item, i) => (i === 0 ? { ...item, shape: 8 } : item)) },
    { ...legacy, objects: legacyObjects.map((item, i) => (i === 0 ? { ...item, shape: '1' } : item)) },
    { ...legacy, objects: legacyObjects.map((item, i) => (i === 0 ? { ...item, color: 'vang' } : item)) },
    { ...legacy, objects: legacyObjects.map((item, i) => (i === 0 ? null : item)) },
    { ...legacy, objects: legacyObjects.map((item) => ({ ...item, done: true })) }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
  const clamped = engine.restore({ ...legacy, wrong: -1, seconds: 9.7, objects: legacyObjects.map((item) => ({ ...item, done: item.done ? 'yes' : item.done })) });
  assert.deepEqual([clamped.wrong, clamped.seconds, engine.collected(clamped)], [0, 9, 0], 'done chỉ nhận true đúng kiểu');
}

console.log('Game 4 engine checks passed.');
