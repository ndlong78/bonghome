const assert = require('node:assert/strict');

const engine = require('../js/game8-engine.js');

/** RNG có hạt giống để test lặp lại được. */
function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

const OFFSET = { len: [0, -1], phai: [1, 0], xuong: [0, 1], trai: [-1, 0] };
const WALL = { len: 'tren', phai: 'phai', xuong: 'duoi', trai: 'trai' };

/** Đường ngắn nhất từ ô bé đang đứng về nhà, tìm theo chiều rộng trên các cạnh không có tường. */
function solve(state) {
  const { size, maze } = state;
  const start = `${state.player.x},${state.player.y}`;
  const previous = new Map([[start, null]]);
  const queue = [[state.player.x, state.player.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === size - 1 && y === size - 1) break;
    for (const direction of engine.DIRECTIONS) {
      if (maze[y][x][WALL[direction]]) continue;
      const [dx, dy] = OFFSET[direction];
      const key = `${x + dx},${y + dy}`;
      if (previous.has(key)) continue;
      previous.set(key, [`${x},${y}`, direction]);
      queue.push([x + dx, y + dy]);
    }
  }
  const route = [];
  for (let key = `${size - 1},${size - 1}`; previous.get(key); key = previous.get(key)[0]) route.unshift(previous.get(key)[1]);
  return route;
}

/** Số ô tới được từ (0,0): mê cung hoàn hảo thì tới được mọi ô. */
function reachable(maze) {
  const size = maze.length;
  const seen = new Set(['0,0']);
  const queue = [[0, 0]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const direction of engine.DIRECTIONS) {
      if (maze[y][x][WALL[direction]]) continue;
      const [dx, dy] = OFFSET[direction];
      const key = `${x + dx},${y + dy}`;
      if (!seen.has(key)) { seen.add(key); queue.push([x + dx, y + dy]); }
    }
  }
  return seen.size;
}

const openings = (maze) => maze.flat().reduce((sum, cell) => sum + engine.WALLS.filter((wall) => !cell[wall]).length, 0);

// Mê cung hoàn hảo ở cả ba mức độ: tường khép kín, mọi ô tới được, đúng N² − 1 lối đi (dạng cây).
for (const size of engine.SIZES) {
  for (let seed = 1; seed <= 25; seed += 1) {
    const maze = engine.generateMaze(size, seededRng(seed * 31 + size));
    assert.equal(maze.length, size);
    assert.ok(maze.every((row) => row.length === size));
    for (let i = 0; i < size; i += 1) {
      assert.ok(maze[0][i].tren && maze[size - 1][i].duoi && maze[i][0].trai && maze[i][size - 1].phai, 'tường bao khép kín');
    }
    assert.equal(reachable(maze), size * size, `${size}x${size} seed ${seed}: mọi ô đều tới được`);
    assert.equal(openings(maze), 2 * (size * size - 1), 'mỗi lối đi được đếm từ hai phía');
  }
}
assert.throws(() => engine.generateMaze(10), RangeError, 'chỉ có 3 mức độ 8/12/16');

// rng kém (luôn trả cùng một giá trị, kể cả 1) vẫn sinh mê cung hợp lệ và không treo.
for (const constant of [0, 0.5, 0.999999, 1]) {
  assert.equal(reachable(engine.generateMaze(16, () => constant)), 256);
}

// Luồng chơi: đụng tường, đi đúng đường về nhà, thắng.
{
  let state = engine.createGame(8, seededRng(7));
  assert.deepEqual([state.size, state.player.x, state.player.y, state.steps, state.started], [8, 0, 0, 0, false]);
  assert.deepEqual(state.path, [[0, 0]]);
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa bấm');
  assert.equal(engine.difficulty(state), '8x8');

  // Ô xuất phát luôn có tường phía trên: đụng tường không tính bước nhưng bắt đầu đồng hồ (giữ hành vi cũ).
  let result = engine.move(state, 'len');
  assert.equal(result.event, 'wall');
  assert.equal(result.startedNow, true);
  state = result.state;
  assert.deepEqual([state.steps, state.started, state.player.x, state.player.y], [0, true, 0, 0]);
  state = engine.tick(state);

  const route = solve(state);
  assert.ok(route.length >= 14, 'đường về nhà dài ít nhất 2·(N−1) bước');
  route.forEach((direction, index) => {
    result = engine.move(state, direction);
    assert.equal(result.event, index === route.length - 1 ? 'won' : 'moved');
    assert.equal(result.startedNow, false);
    state = result.state;
    assert.equal(engine.canSave(state), index < route.length - 1, 'đang chơi thì lưu được, về tới nhà thì thôi');
  });
  assert.deepEqual([state.player.x, state.player.y, state.finished], [7, 7, true]);
  assert.equal(state.steps, route.length);
  assert.equal(engine.moves(state), route.length);
  assert.equal(state.path.length, route.length + 1);
  assert.equal(state.seconds, 1);
  assert.equal(engine.tick(state).seconds, 1, 'đồng hồ dừng khi về tới nhà');
  assert.equal(engine.move(state, 'trai').event, 'ignored', 'về tới nhà rồi thì không đi tiếp được');
}

// Hướng lạ bị bỏ qua; trạng thái không bị sửa tại chỗ.
{
  const state = engine.createGame(12, seededRng(3));
  for (const direction of ['up', '', null, undefined, 'toString']) assert.equal(engine.move(state, direction).event, 'ignored');
  const direction = engine.DIRECTIONS.find((name) => !state.maze[0][0][WALL[name]]);
  const next = engine.move(state, direction).state;
  assert.deepEqual([state.player.x, state.player.y, state.steps, state.started], [0, 0, 0, false]);
  assert.equal(next.steps, 1);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.maze) && Object.isFrozen(state.maze[0][0]) && Object.isFrozen(state.path));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = engine.createGame(16, seededRng(11));
  for (const direction of solve(state).slice(0, 5)) state = engine.tick(engine.move(state, direction).state);
  const saved = engine.serialize(state, 'game8-abc');
  assert.deepEqual(Object.keys(saved).sort(), ['maze', 'path', 'player', 'schemaVersion', 'seconds', 'sessionId', 'size', 'started', 'steps']);
  assert.deepEqual(Object.keys(saved.maze[0][0]).sort(), ['duoi', 'phai', 'trai', 'tren']);
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.ok(restored, 'mê cung 16x16 (mức Khó) khôi phục được');
  assert.deepEqual(engine.serialize(restored, 'game8-abc'), saved);
  assert.equal(solve(restored).length, solve(state).length, 'chơi tiếp được từ chỗ đã dừng');
}

// Bản lưu do adapter cũ tạo ra (mê cung 8x8 dạng ô có cờ tham) vẫn khôi phục được.
const legacyState = engine.createGame(8, seededRng(5));
const legacy = {
  ...engine.serialize(legacyState, 'game8-legacy'),
  player: { x: 0, y: 0 },
  path: [[0, 0]],
  steps: 6,
  seconds: 40,
  started: true
};
legacy.maze = legacy.maze.map((row) => row.map((cell) => ({ ...cell, tham: true })));
{
  const restored = engine.restore(legacy);
  assert.deepEqual([restored.size, restored.steps, restored.seconds, restored.started, restored.finished], [8, 6, 40, true, false]);
  assert.equal(restored.maze[0][0].tham, undefined, 'bỏ trường thừa của bản lưu cũ');
}

// Bản lưu hỏng thì bỏ (bé bắt đầu ván mới).
{
  const openWall = JSON.parse(JSON.stringify(legacy));
  openWall.maze[0][0].tren = false;
  const oneSided = JSON.parse(JSON.stringify(legacy));
  oneSided.maze[3][3].phai = !oneSided.maze[3][3].phai;
  const broken = [
    null,
    'maze',
    { ...legacy, size: 10 },
    { ...legacy, size: 12 },
    { ...legacy, maze: legacy.maze.slice(1) },
    { ...legacy, maze: legacy.maze.map((row) => row.slice(1)) },
    { ...legacy, maze: legacy.maze.map((row, y) => (y === 2 ? [...row.slice(0, 7), null] : row)) },
    openWall,
    oneSided,
    { ...legacy, player: { x: 7, y: 7 } }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));

  const clamped = engine.restore({ ...legacy, player: { x: 99, y: -4 }, path: [[0, 0], [9, 0], 'x', [1, 0]], steps: -2, seconds: 3.7 });
  assert.deepEqual([clamped.player.x, clamped.player.y], [7, 0]);
  assert.deepEqual(clamped.path, [[0, 0], [1, 0]]);
  assert.deepEqual([clamped.steps, clamped.seconds], [0, 3]);
  assert.deepEqual(engine.restore({ ...legacy, path: [] }).path, [[0, 0]]);
}

console.log('Game 8 engine checks passed.');
