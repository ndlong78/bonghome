const assert = require('node:assert/strict');

const engine = require('../js/game10-engine.js');

/** RNG có hạt giống để test lặp lại được. */
function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

const { BEAT_MS, LEAD_IN_MS, STAR_COUNT, WINDOWS } = engine;

// Bài nhạc: 24 sao đúng nhịp, 10 sao đầu liền nhau, nửa sau thỉnh thoảng có nhịp trống.
for (let seed = 1; seed <= 50; seed += 1) {
  const times = engine.createSong(seededRng(seed));
  assert.equal(times.length, STAR_COUNT);
  assert.ok(times.every((time) => (time - LEAD_IN_MS) % BEAT_MS === 0), 'sao nào cũng rơi đúng nhịp');
  assert.ok(times.every((time, i) => i === 0 || time > times[i - 1]), 'thời điểm tăng dần');
  assert.deepEqual(times.slice(0, 10), Array.from({ length: 10 }, (_, i) => LEAD_IN_MS + i * BEAT_MS));
}
{
  const gaps = new Set();
  for (let seed = 1; seed <= 50; seed += 1) {
    const times = engine.createSong(seededRng(seed));
    times.forEach((time, i) => { if (i) gaps.add((time - times[i - 1]) / BEAT_MS); });
  }
  assert.ok(gaps.has(1) && gaps.has(2), 'có nhịp liền và nhịp bỏ trống');
}
// rng kém (luôn < 0,22, tức lúc nào cũng muốn bỏ trống) không được làm treo: bài dừng ở giới hạn số nhịp.
for (const constant of [0, 0.1, 0.5, 0.999999, 1]) {
  const times = engine.createSong(() => constant);
  assert.equal(times.length, STAR_COUNT);
  assert.ok(times[times.length - 1] <= LEAD_IN_MS + (engine.MAX_BEATS - 1) * BEAT_MS, 'bài không dài quá 72 nhịp');
}

// Trước khi bấm "Bắt đầu": chưa có bài, gõ bị bỏ qua, chưa lưu được.
{
  const idle = engine.idle();
  assert.equal(engine.tap(idle, 1500).event, 'ignored');
  assert.equal(engine.advance(idle, 99999).state, idle);
  assert.equal(engine.canSave(idle), false);
}

// Chấm điểm theo độ lệch, thưởng chuỗi, gõ sớm không trừ điểm, sao trượt cắt chuỗi.
{
  let state = engine.start(() => 0.9); // 0,9 > 0,22: không bỏ nhịp nào, sao thứ i ở LEAD_IN + i·BEAT
  const at = (i) => LEAD_IN_MS + i * BEAT_MS;
  assert.equal(engine.canSave(state), true);
  assert.equal(engine.remaining(state), 24);

  assert.equal(engine.tap(state, at(0) - WINDOWS.ok - 1).event, 'early', 'chưa có sao nào đủ gần');
  assert.equal(engine.tap(state, at(0) - WINDOWS.ok - 1).state, state, 'gõ sớm không đổi gì');

  let result = engine.tap(state, at(0) + WINDOWS.perfect);
  assert.deepEqual([result.event, result.points], ['perfect', 100 + 2]);
  state = result.state;
  result = engine.tap(state, at(1) - WINDOWS.good);
  assert.deepEqual([result.event, result.points], ['good', 60 + 4]);
  state = result.state;
  result = engine.tap(state, at(2) + WINDOWS.ok);
  assert.deepEqual([result.event, result.points], ['ok', 30 + 6]);
  state = result.state;
  assert.deepEqual([state.score, state.streak, state.longestStreak, engine.hits(state)], [202, 3, 3, 3]);

  // Thời gian trôi qua sao thứ 4 mà bé không gõ: trượt, chuỗi về 0, trống gõ ở nhịp mới.
  let tick = engine.advance(state, at(3) + WINDOWS.ok + 1);
  assert.deepEqual([tick.missed, tick.beat, tick.finished], [1, true, false]);
  state = tick.state;
  assert.deepEqual([state.streak, state.longestStreak, engine.misses(state), state.lastBeat], [0, 3, 1, 3]);
  assert.equal(engine.advance(state, at(3) + WINDOWS.ok + 2).beat, false, 'cùng nhịp thì không gõ trống lại');

  // Thưởng chuỗi tối đa 10 × 2.
  for (let i = 4; i < 16; i += 1) state = engine.tap(state, at(i)).state;
  assert.equal(state.streak, 12);
  assert.equal(engine.tap(state, at(16)).points, 100 + 20);

  // Bỏ hết phần còn lại: bài kết thúc, không gõ được nữa.
  tick = engine.advance(state, at(23) + WINDOWS.ok + 1);
  state = tick.state;
  assert.equal(tick.finished, true);
  assert.deepEqual([state.running, state.finished, engine.hits(state), engine.misses(state)], [false, true, 15, 9]);
  assert.equal(engine.moves(state), 24, 'giữ công thức số lượt cũ: trúng + trượt');
  assert.equal(engine.canSave(state), false);
  assert.equal(engine.tap(state, at(23)).event, 'ignored');
}

// Gõ khi hai sao cùng gần: lấy sao chưa xử lý gần nhất; trạng thái không bị sửa tại chỗ.
{
  const state = engine.start(() => 0.9);
  const t = LEAD_IN_MS + BEAT_MS / 2; // cách đều sao 1 và sao 2 (400 ms) → ngoài cửa sổ
  assert.equal(engine.tap(state, t).event, 'early');
  const next = engine.tap(state, LEAD_IN_MS + BEAT_MS - 50).state;
  assert.deepEqual(next.stars.slice(0, 2).map((star) => star.hit), [false, true], 'gõ gần sao 2 thì trúng sao 2');
  assert.equal(state.stars[1].hit, false);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.stars) && Object.isFrozen(state.stars[0]));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = engine.start(seededRng(4));
  state = engine.tap(state, state.stars[0].time).state;
  state = engine.advance(state, state.stars[1].time + WINDOWS.ok + 1).state;
  const saved = engine.serialize(state, 'game10-abc', 4321.5);
  assert.deepEqual(Object.keys(saved).sort(), ['elapsedMs', 'hits', 'lastBeat', 'longestStreak', 'misses', 'running', 'schemaVersion', 'score', 'sessionId', 'stars', 'streak']);
  assert.deepEqual(saved.stars[0], { luc: state.stars[0].time, xong: true, trung: true });
  assert.deepEqual([saved.hits, saved.misses, saved.elapsedMs, saved.running], [1, 1, 4321.5, true]);
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.elapsedMs, 4321.5);
  assert.deepEqual(engine.serialize(restored.state, 'game10-abc', restored.elapsedMs), saved);
  assert.equal(engine.serialize(engine.idle(), 'x', 999).elapsedMs, 0, 'chưa chạy thì không ghi thời gian');
}

// Bản lưu do adapter cũ tạo ra vẫn khôi phục được; số trúng/trượt tính lại từ các sao.
const legacyStars = Array.from({ length: 24 }, (_, i) => ({ luc: LEAD_IN_MS + i * BEAT_MS, xong: i < 5, trung: i < 3 }));
const legacy = {
  schemaVersion: 1,
  sessionId: 'game10-legacy',
  stars: legacyStars,
  elapsedMs: 6000,
  score: 310,
  streak: 0,
  longestStreak: 3,
  hits: 3,
  misses: 2,
  lastBeat: 5,
  running: true
};
{
  const { state, elapsedMs } = engine.restore(legacy);
  assert.deepEqual([engine.hits(state), engine.misses(state), engine.remaining(state)], [3, 2, 19]);
  assert.deepEqual([state.score, state.longestStreak, state.lastBeat, state.running, elapsedMs], [310, 3, 5, true, 6000]);
  const lying = engine.restore({ ...legacy, hits: 20, misses: 0 }).state;
  assert.deepEqual([engine.hits(lying), engine.misses(lying)], [3, 2], 'không tin số đếm đã lưu');
}

// Bản lưu hỏng thì bỏ (bé bắt đầu lại).
{
  const broken = [
    null,
    'x',
    { ...legacy, stars: legacyStars.slice(1) },
    { ...legacy, stars: legacyStars.map((star, i) => (i === 3 ? { ...star, luc: 'x' } : star)) },
    { ...legacy, stars: legacyStars.map((star, i) => (i === 3 ? { ...star, luc: -5 } : star)) },
    { ...legacy, stars: legacyStars.map((star, i) => (i === 3 ? null : star)) },
    { ...legacy, stars: legacyStars.map((star) => ({ ...star, xong: true })) }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
  const clamped = engine.restore({ ...legacy, score: -4, streak: 7, longestStreak: 2, lastBeat: 'x', elapsedMs: -1 });
  assert.deepEqual([clamped.state.score, clamped.state.streak, clamped.state.longestStreak, clamped.state.lastBeat, clamped.elapsedMs], [0, 7, 7, -1, 0]);
}

console.log('Game 10 engine checks passed.');
