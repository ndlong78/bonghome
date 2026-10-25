const assert = require('node:assert/strict');

const engine = require('../js/game1-engine.js');

/** RNG có hạt giống (mulberry32) để test lặp lại được; xem ghi chú ở tests/game2-engine.test.js. */
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

/** Chỉ số hai lá của từng mã hình trong bộ bài. */
const pairsOf = (deck) => {
  const map = new Map();
  deck.forEach((code, index) => map.set(code, [...(map.get(code) || []), index]));
  return [...map.values()];
};

// Ván mới: mỗi mã đúng 2 lá, có xáo; rng kém (kể cả trả về 1) không làm hỏng; số cặp lạ bị từ chối.
{
  for (const pairs of engine.PAIR_COUNTS) {
    const state = engine.createGame(pairs, seededRng(pairs));
    assert.equal(state.deck.length, pairs * 2);
    assert.ok(pairsOf(state.deck).every((indices) => indices.length === 2));
    assert.equal(pairsOf(state.deck).length, pairs);
    assert.deepEqual([state.matched, state.open, state.moves, state.seconds, state.started, state.locked, state.finished],
      [[], [], 0, 0, false, false, false]);
    assert.ok(Object.isFrozen(state) && Object.isFrozen(state.deck));
  }
  const decks = new Set();
  for (let seed = 1; seed <= 20; seed += 1) decks.add(engine.createGame(6, seededRng(seed)).deck.join());
  assert.ok(decks.size > 15, 'bộ bài phải được xáo');
  for (const constant of [0, 0.5, 0.999999, 1]) assert.equal(engine.createGame(3, () => constant).deck.length, 6);
  for (const pairs of [0, 5, '3', 13]) assert.throws(() => engine.createGame(pairs), RangeError);
}

// Luồng chơi: lật 1 lá, cặp sai (khoá tới khi úp lại), cặp đúng, lật lại lá đã mở/đã ghép bị bỏ qua, thắng.
{
  let state = engine.createGame(3, seededRng(9));
  const [[a1, a2], [b1, b2], [c1, c2]] = pairsOf(state.deck);
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa lật lá nào');

  let result = engine.flip(state, a1);
  assert.deepEqual([result.event, result.startedNow, result.state.moves], ['opened', true, 0]);
  state = result.state;
  assert.equal(engine.flip(state, a1).event, 'ignored', 'chạm lại lá đang mở');
  state = engine.tick(state);

  result = engine.flip(state, b1);
  assert.deepEqual([result.event, result.startedNow, result.state.moves, result.state.locked], ['mismatch', false, 1, true]);
  state = result.state;
  assert.equal(engine.flip(state, c1).event, 'ignored', 'đang chờ úp lại cặp sai thì không lật thêm');
  state = engine.closeMismatch(state);
  assert.deepEqual([state.open, state.locked], [[], false]);
  assert.equal(engine.closeMismatch(state), state, 'gọi thừa không đổi gì');

  state = engine.flip(state, a1).state;
  result = engine.flip(state, a2);
  assert.deepEqual([result.event, result.state.matched, result.state.open, result.state.moves], ['match', [a1, a2], [], 2]);
  state = result.state;
  assert.equal(engine.matchedPairs(state), 1);
  assert.equal(engine.flip(state, a2).event, 'ignored', 'lá đã ghép');
  for (const index of [-1, 6, 1.5, NaN, '0']) assert.equal(engine.flip(state, index).event, 'ignored');

  state = engine.flip(engine.flip(state, b1).state, b2).state;
  state = engine.flip(state, c1).state;
  assert.ok(engine.canSave(state));
  result = engine.flip(state, c2);
  assert.equal(result.event, 'completed');
  state = result.state;
  assert.deepEqual([state.finished, engine.matchedPairs(state), state.moves, state.seconds], [true, 3, 4, 1]);
  assert.equal(engine.canSave(state), false);
  assert.equal(engine.tick(state).seconds, 1, 'đồng hồ dừng khi ghép đủ');
  assert.equal(engine.flip(state, 0).event, 'ignored');
}

// hasProgress: ván chưa chạm lá nào thì không đáng lưu.
{
  const fresh = engine.createGame(3, seededRng(1));
  assert.equal(engine.hasProgress(fresh), false);
  assert.equal(engine.hasProgress(engine.flip(fresh, 0).state), true);
}

// Lưu và khôi phục: giữ đúng định dạng snapshot của game1-autosave.js trước khi tách engine.
{
  let state = engine.createGame(6, seededRng(4));
  const [[a1, a2], [b1]] = pairsOf(state.deck);
  state = engine.tick(engine.flip(engine.flip(engine.flip(state, a1).state, a2).state, b1).state);
  const saved = engine.serialize(state);
  assert.deepEqual(Object.keys(saved).sort(),
    ['deck', 'difficulty', 'locked', 'matchedIndices', 'moves', 'openIndices', 'seconds', 'started', 'version']);
  assert.deepEqual([saved.version, saved.difficulty, saved.matchedIndices, saved.openIndices, saved.moves, saved.seconds, saved.locked],
    [1, 6, [a1, a2], [b1], 1, 1, false]);
  assert.deepEqual(engine.serialize(engine.restore(JSON.parse(JSON.stringify(saved)))), saved);
}

// Bản lưu do adapter cũ tạo ra vẫn khôi phục được; cặp sai đang chờ thì khoá để giao diện úp lại.
const legacy = {
  version: 1, difficulty: 3, deck: [0, 1, 2, 0, 1, 2],
  matchedIndices: [0, 3], openIndices: [1], moves: 2, seconds: 15, started: true, locked: false
};
{
  const restored = engine.restore(legacy);
  assert.deepEqual([restored.pairs, restored.matched, restored.open, restored.moves, restored.seconds, restored.started, restored.locked],
    [3, [0, 3], [1], 2, 15, true, false]);
  assert.equal(engine.restore({ ...legacy, difficulty: '3' }).pairs, 3, 'adapter cũ nhận số cặp dạng chuỗi');
  const pending = engine.restore({ ...legacy, openIndices: [1, 2], locked: false });
  assert.equal(pending.locked, true, 'hai lá đang mở luôn là cặp sai chờ úp lại');
  assert.equal(engine.flip(pending, 4).event, 'ignored');
  assert.equal(engine.restore({ ...legacy, locked: true }).locked, false, 'cờ khoá thừa với một lá mở bị bỏ');
  const hard = { version: 1, difficulty: 12, deck: [...Array(12).keys(), ...Array(12).keys()], matchedIndices: [], openIndices: [], moves: 0, seconds: 0, started: false, locked: false };
  assert.equal(engine.restore(hard).pairs, 12);
  assert.equal(engine.restore({ ...hard, difficulty: 8, deck: [...Array(8).keys(), ...Array(8).keys()] }).pairs, 8);
}

// Bản lưu hỏng thì bỏ (bé chơi ván mới).
{
  const broken = [
    null, 'x', [], { ...legacy, version: 2 },
    { ...legacy, difficulty: 5 },
    { ...legacy, deck: [0, 0, 1] },
    { ...legacy, deck: [0, 0, 1, 1, 2, 3] },
    { ...legacy, deck: [0, 0, 0, 1, 1, 2] },
    { ...legacy, matchedIndices: [0] },
    { ...legacy, matchedIndices: [0, 0] },
    { ...legacy, matchedIndices: [0, 1] }, // hai lá khác hình không thể là một cặp đã ghép
    { ...legacy, openIndices: [0] },
    { ...legacy, openIndices: [1, 4] }, // hai lá cùng hình đang mở: đáng ra đã được ghép
    { ...legacy, openIndices: [1, 2, 5] },
    { ...legacy, openIndices: [9] },
    { ...legacy, matchedIndices: [0, 1, 2, 3, 4, 5], openIndices: [] }, // đã ghép đủ
    { ...legacy, moves: -1 },
    { ...legacy, seconds: 1.5 },
    { ...legacy, moves: 'x' }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
}

console.log('Game 1 engine checks passed.');
