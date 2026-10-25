const assert = require('node:assert/strict');

const engine = require('../js/game9-engine.js');

// Ba câu chuyện giữ đúng thứ tự, từ khoá và số từ như cũ (bản lưu ghi chỉ số chuyện và chỉ số từ).
assert.deepEqual(engine.STORIES.map((story) => [story.keyword, story.words.length]), [['THỎ', 49], ['HOA', 45], ['TRĂNG', 46]]);
assert.deepEqual(engine.STORIES.map((story) => story.words.filter((word) => word === story.keyword).length), [6, 6, 7]);
assert.equal(engine.WORD_MS, 1150);
assert.ok(Object.isFrozen(engine.STORIES[0].words));

// Chọn chuyện: rng kém (kể cả trả về 1) vẫn ra chỉ số hợp lệ; mọi chuyện đều có thể ra.
assert.deepEqual([0, 0.4, 0.7, 0.999999, 1].map((value) => engine.start(() => value).storyIndex), [0, 1, 2, 2, 2]);

/** Đi tới từ thứ `target` (đã hiện), giả lập hẹn giờ của giao diện. */
function goTo(state, target) {
  let next = engine.reveal(state);
  while (next.index < target) next = engine.reveal(engine.expire(next).state);
  return next;
}

// Luồng nghe chuyện THỎ: bấm lúc "Chuẩn bị…" bị bỏ qua, bắt đúng, bấm nhầm, bỏ lỡ, hết chuyện.
{
  let state = engine.start(() => 0);
  assert.deepEqual([state.storyIndex, state.index, state.showing, state.running], [0, 0, false, true]);
  assert.equal(engine.currentWord(state), null);
  assert.equal(engine.tap(state).event, 'ignored', 'bấm lúc "Chuẩn bị…" không bị tính nhầm (bản cũ tính nhầm theo từ "Sáng")');
  assert.equal(engine.seconds(state), 0);

  state = engine.reveal(state);
  assert.equal(engine.currentWord(state), 'Sáng');
  let result = engine.tap(state);
  assert.equal(result.event, 'wrong');
  state = result.state;
  assert.equal(engine.tap(state).event, 'ignored', 'mỗi từ chỉ tính một lần');
  assert.equal(engine.reveal(state), state, 'hiện lại từ đang hiện không xoá lượt bấm');

  state = goTo(state, 3);
  assert.equal(engine.currentWord(state), 'THỎ');
  assert.equal(engine.isKeyword(state), true);
  result = engine.tap(state);
  assert.equal(result.event, 'correct');
  state = result.state;
  assert.equal(engine.expire(state).missed, false, 'đã bắt thì không tính bỏ lỡ');

  state = goTo(state, 7);
  assert.equal(engine.currentWord(state), 'THỎ');
  result = engine.expire(state);
  assert.equal(result.missed, true, 'để từ khoá trôi qua thì bỏ lỡ');
  state = result.state;
  assert.deepEqual([state.correct, state.wrong, state.missed, state.index, state.showing], [1, 1, 1, 8, false]);
  assert.equal(engine.seconds(state), 9, 'giữ công thức thời lượng cũ: số từ đã qua × 1,15 giây');

  state = goTo(state, 48);
  state = engine.reveal(engine.expire(state).state);
  assert.deepEqual([state.running, state.finished], [false, true]);
  assert.equal(engine.tap(state).event, 'ignored');
  assert.equal(engine.canSave(state), false);
  assert.equal(state.missed, 5, '4 từ khoá còn lại cũng bỏ lỡ');
  assert.equal(engine.moves(state), 7, 'giữ công thức số lượt cũ: đúng + bỏ lỡ + nhầm');
  assert.equal(engine.score(state), 0, 'giữ công thức điểm cũ (10·đúng − 3·nhầm − 2·bỏ lỡ), không âm');
  assert.equal(engine.totalKeywords(state), 6);
}

// Bắt trọn chuyện HOA: 6 đúng, 0 nhầm, điểm 60; trạng thái không bị sửa tại chỗ.
{
  let state = engine.reveal(engine.start(() => 0.4));
  const before = state;
  while (state.running) {
    if (engine.isKeyword(state)) state = engine.tap(state).state;
    state = engine.reveal(engine.expire(state).state);
  }
  assert.deepEqual([state.correct, state.missed, state.wrong, engine.score(state)], [6, 0, 0, 60]);
  assert.deepEqual([before.index, before.correct], [0, 0]);
  assert.ok(Object.isFrozen(before) && Object.isFrozen(state));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = goTo(engine.start(() => 0.8), 2);
  state = engine.tap(state).state;
  const saved = engine.serialize(state, 'game9-abc', false);
  assert.deepEqual(saved, {
    schemaVersion: 1, sessionId: 'game9-abc', storyIndex: 2, wordIndex: 2, caughtCurrent: true,
    correct: 1, missed: 0, wrong: 0, running: true, readAloud: false
  });
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.readAloud, false);
  assert.equal(restored.state.showing, true, 'từ đang lưu được hiện lại ngay');
  assert.deepEqual(engine.serialize(restored.state, 'game9-abc', restored.readAloud), saved);
  assert.equal(engine.tap(restored.state).event, 'ignored', 'từ đã bấm trước khi lưu không tính lại');
}

// Bản lưu do adapter cũ tạo ra vẫn khôi phục được.
const legacy = {
  schemaVersion: 1, sessionId: 'game9-legacy', storyIndex: 1, wordIndex: 20, caughtCurrent: false,
  correct: 2, missed: 1, wrong: 1, running: true, readAloud: true
};
{
  const { state, readAloud } = engine.restore(legacy);
  assert.deepEqual([state.storyIndex, state.index, state.correct, state.missed, state.wrong, state.running, readAloud], [1, 20, 2, 1, 1, true, true]);
  assert.equal(engine.currentWord(state), 'Ong');
  assert.equal(engine.restore({ ...legacy, readAloud: undefined }).readAloud, true, 'mặc định đọc to');
}

// Bản lưu hỏng thì bỏ; số đếm không vượt số từ khoá đã hiện.
{
  const broken = [null, 'x', { ...legacy, storyIndex: 3 }, { ...legacy, storyIndex: '1' }, { ...legacy, wordIndex: 45 },
    { ...legacy, wordIndex: -1 }, { ...legacy, wordIndex: 2.5 }];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
  // Tới từ thứ 20 của chuyện HOA mới hiện 3 từ khoá.
  const clamped = engine.restore({ ...legacy, correct: 99, missed: 99, wrong: -2 }).state;
  assert.deepEqual([clamped.correct, clamped.missed, clamped.wrong], [3, 0, 0]);
  const atKeyword = engine.restore({ ...legacy, wordIndex: 19, caughtCurrent: true, correct: 9, missed: 0 }).state;
  assert.equal(atKeyword.correct, 3, 'từ khoá đang hiện đã bắt thì được tính');
}

console.log('Game 9 engine checks passed.');
