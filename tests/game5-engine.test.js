const assert = require('node:assert/strict');

const engine = require('../js/game5-engine.js');

// Kho hình giữ đúng thứ tự và số chấm cũ, vì bản lưu ghi chỉ số hình.
assert.deepEqual(engine.SHAPES.map((shape) => [shape.name, shape.points.length]), [
  ['Ngôi sao lung linh', 10],
  ['Ngôi nhà nhỏ', 7],
  ['Con cá tung tăng', 9],
  ['Vương miện công chúa', 7],
  ['Chiếc thuyền buồm', 9]
]);
assert.deepEqual(engine.SHAPES[0].points.slice(0, 2), [[200, 55], [240, 155]], 'ngôi sao tính đúng như bản cũ');
engine.SHAPES.forEach((shape) => {
  assert.ok(shape.points.every(([x, y]) => x >= 0 && x <= 400 && y >= 0 && y <= 400), `${shape.name} nằm trong khung 400x400`);
});
assert.ok(Object.isFrozen(engine.SHAPES) && Object.isFrozen(engine.SHAPES[1].points) && Object.isFrozen(engine.SHAPES[1].points[0]));

// Chọn hình mới: luôn khác hình đang vẽ, mọi hình khác đều có thể ra, rng kém không làm treo.
for (let current = 0; current < engine.SHAPES.length; current += 1) {
  const seen = new Set();
  for (const value of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.999999, 1]) {
    const next = engine.pickShape(() => value, current);
    assert.notEqual(next, current);
    assert.ok(next >= 0 && next < engine.SHAPES.length);
    seen.add(next);
  }
  assert.equal(seen.size, engine.SHAPES.length - 1, `từ hình ${current} có thể sang mọi hình khác`);
}
assert.equal(engine.pickShape(() => 0), 0, 'chưa có hình nào thì bốc trong cả kho');
assert.equal(engine.pickShape(() => 1), engine.SHAPES.length - 1);
assert.throws(() => engine.createGame(5), RangeError);

// Luồng chơi: chạm nhầm, chạm đúng lần lượt, nối xong.
{
  let state = engine.createGame(1);
  assert.deepEqual([state.position, state.wrong, state.seconds, state.started, state.finished], [0, 0, 0, false, false]);
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa chạm');

  // Chạm nhầm chấm 3 trước: đếm nhầm và bắt đầu đồng hồ (giữ hành vi cũ).
  let result = engine.tap(state, 2);
  assert.deepEqual([result.event, result.startedNow], ['wrong', true]);
  state = engine.tick(result.state);
  assert.deepEqual([state.position, state.wrong, state.seconds], [0, 1, 1]);
  assert.equal(engine.canSave(state), true);

  for (let index = 0; index < 7; index += 1) {
    result = engine.tap(state, index);
    assert.equal(result.event, index === 6 ? 'completed' : 'correct');
    assert.equal(result.startedNow, false);
    state = result.state;
    assert.deepEqual(engine.connectedPoints(state), engine.SHAPES[1].points.slice(0, index + 1));
  }
  assert.deepEqual([state.position, state.finished], [7, true]);
  assert.equal(engine.moves(state), 8, 'giữ công thức số lượt cũ: chấm đã nối + lần chạm nhầm');
  assert.equal(engine.canSave(state), false);
  assert.equal(engine.tick(state).seconds, 1, 'đồng hồ dừng khi nối xong');
  // Trước đây chạm trong lúc chờ màn thắng bị tính là chạm nhầm; giờ bỏ qua.
  assert.equal(engine.tap(state, 0).event, 'ignored');
  assert.equal(engine.tap(state, 0).state.wrong, 1);
}

// Chỉ số chấm lạ thì bỏ qua; trạng thái không bị sửa tại chỗ.
{
  const state = engine.createGame(0);
  for (const index of [-1, 10, 1.5, '0', null, undefined]) assert.equal(engine.tap(state, index).event, 'ignored');
  const next = engine.tap(state, 0).state;
  assert.deepEqual([state.position, state.started], [0, false]);
  assert.equal(next.position, 1);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(next));
}

// Chạm vào chỗ hai chấm chồng nhau (thuyền buồm: chấm 1 ở (196,50), chấm 4 ở (196,58)) thì ưu tiên chấm cần nối tiếp.
{
  const boat = engine.createGame(4);
  assert.deepEqual([engine.SHAPES[4].points[0], engine.SHAPES[4].points[3]], [[196, 50], [196, 58]]);
  assert.equal(engine.resolveTap(boat, 3, { x: 196, y: 58 }, 27), 0, 'chạm trúng tâm chấm 4 vẫn tính là chấm 1 khi đang chờ chấm 1');
  assert.equal(engine.tap(boat, engine.resolveTap(boat, 3, { x: 196, y: 58 }, 27)).event, 'correct');
  assert.equal(engine.resolveTap(boat, 3, { x: 196, y: 58 }, 27), 0);
  assert.equal(engine.resolveTap(boat, 5, { x: 356, y: 250 }, 27), 5, 'chạm xa chấm cần nối thì vẫn là chạm nhầm');
  assert.equal(engine.resolveTap(boat, 3, null, 27), 3, 'bàn phím (không có tọa độ) giữ nguyên chấm đã chọn');
  assert.equal(engine.resolveTap(boat, 3, { x: NaN, y: 1 }, 27), 3);
  let state = boat;
  for (let index = 0; index < 3; index += 1) state = engine.tap(state, index).state;
  assert.equal(engine.resolveTap(state, 0, { x: 196, y: 52 }, 27), 3, 'khi đang chờ chấm 4 thì chỗ chồng nhau tính là chấm 4');
  assert.equal(engine.resolveTap(state, 3, { x: 0, y: 0 }, 27), 3, 'chạm đúng chấm cần nối thì giữ nguyên');
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = engine.createGame(4);
  state = engine.tap(engine.tap(engine.tap(state, 0).state, 5).state, 1).state;
  state = engine.tick(engine.tick(state));
  const saved = engine.serialize(state, 'game5-abc');
  assert.deepEqual(saved, { schemaVersion: 1, sessionId: 'game5-abc', shapeIndex: 4, position: 2, wrong: 1, seconds: 2, started: true });
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(engine.serialize(restored, 'game5-abc'), saved);
  assert.equal(engine.tap(restored, 2).event, 'correct', 'chơi tiếp được từ chấm thứ 3');
}

// Bản lưu do adapter cũ tạo ra vẫn khôi phục được; giá trị lạ được giới hạn như adapter cũ.
{
  const legacy = { schemaVersion: 1, sessionId: 'game5-legacy', shapeIndex: 2, position: 4, wrong: 3, seconds: 41, started: true };
  const restored = engine.restore(legacy);
  assert.deepEqual([restored.shapeIndex, restored.position, restored.wrong, restored.seconds, restored.started, restored.finished], [2, 4, 3, 41, true, false]);

  [null, 'x', {}, { ...legacy, shapeIndex: 5 }, { ...legacy, shapeIndex: -1 }, { ...legacy, shapeIndex: '2' }, { ...legacy, shapeIndex: 1.5 }]
    .forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));

  const clamped = engine.restore({ ...legacy, position: 99, wrong: -2, seconds: 7.9, started: 'yes' });
  assert.deepEqual([clamped.position, clamped.wrong, clamped.seconds, clamped.started], [8, 0, 7, true], 'vị trí tối đa là chấm cuối');
  assert.deepEqual([engine.restore({ shapeIndex: 0 }).position, engine.restore({ shapeIndex: 0 }).started], [0, false]);
}

console.log('Game 5 engine checks passed.');
