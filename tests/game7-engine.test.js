const assert = require('node:assert/strict');

const engine = require('../js/game7-engine.js');

/** RNG có hạt giống để test lặp lại được. */
function seededRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

const key = (combo) => `${combo.h}-${combo.m}`;
const answerIndex = (state) => state.choices.findIndex((choice) => engine.sameCombo(choice, state.answer));

// Mỗi câu: chuỗi theo đúng quy luật, đáp án là ô kế tiếp, 4 lựa chọn khác nhau có đúng 1 đáp án.
for (let seed = 1; seed <= 60; seed += 1) {
  engine.PATTERNS.forEach((pattern, index) => {
    const question = engine.createQuestion(index, seededRng(seed * 17 + index));
    assert.equal(question.sequence.length, engine.sequenceLength(index));
    assert.equal(question.sequence.length, pattern.length * 3 - 1);
    assert.ok([...question.sequence, question.answer, ...question.choices].every(engine.isCombo));

    // Chuỗi lặp đúng quy luật: hai vị trí cùng vai trò thì cùng hình, khác vai trò thì khác hình.
    const full = [...question.sequence, question.answer];
    full.forEach((combo, position) => {
      full.forEach((other, otherPosition) => {
        const sameRole = pattern[position % pattern.length] === pattern[otherPosition % pattern.length];
        assert.equal(engine.sameCombo(combo, other), sameRole, `câu ${index}: vị trí ${position} và ${otherPosition}`);
      });
    });

    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices.map(key)).size, 4, 'không có lựa chọn trùng');
    assert.equal(question.choices.filter((choice) => engine.sameCombo(choice, question.answer)).length, 1);
  });
}
assert.throws(() => engine.createQuestion(8), RangeError);

// rng kém (luôn trả cùng một giá trị) không được làm treo việc tạo câu hỏi.
for (const constant of [0, 0.22, 0.5, 0.999999]) {
  engine.PATTERNS.forEach((pattern, index) => {
    const question = engine.createQuestion(index, () => constant);
    assert.equal(new Set(question.choices.map(key)).size, 4);
    assert.equal(question.choices.filter((choice) => engine.sameCombo(choice, question.answer)).length, 1);
  });
}

// Luồng chơi: chọn sai, chọn đúng, qua câu, thắng.
{
  const rng = seededRng(9);
  let state = engine.createGame(rng);
  assert.deepEqual([state.question, state.correct, state.seconds, state.started], [0, 0, 0, false]);
  assert.equal(engine.tick(state).seconds, 0, 'đồng hồ chưa chạy khi bé chưa chọn');

  const wrongIndex = state.choices.findIndex((choice) => !engine.sameCombo(choice, state.answer));
  let result = engine.choose(state, wrongIndex);
  assert.equal(result.event, 'wrong');
  assert.equal(result.startedNow, true);
  state = result.state;
  assert.equal(state.correct, 0);
  assert.equal(engine.canSave(state), true, 'chọn sai vẫn đang chờ bé chọn tiếp');

  result = engine.choose(state, answerIndex(state));
  assert.equal(result.event, 'correct');
  assert.equal(result.startedNow, false);
  state = result.state;
  assert.equal(state.correct, 1, 'giữ hành vi cũ: đúng sau khi đã chọn sai vẫn được đếm');
  assert.equal(state.locked, true);
  assert.equal(engine.canSave(state), false);
  assert.equal(engine.choose(state, 0).event, 'ignored', 'câu đã khóa thì bỏ qua');

  state = engine.nextQuestion(state, rng);
  assert.equal(state.question, 1);
  for (let index = 1; index < engine.QUESTION_COUNT; index += 1) {
    state = engine.choose(state, answerIndex(state)).state;
    state = engine.tick(state);
    state = engine.nextQuestion(state, rng);
  }
  assert.equal(state.finished, true);
  assert.equal(state.correct, 8);
  assert.equal(state.seconds, 7);
  assert.equal(engine.moves(state), 9, 'giữ công thức số lượt cũ (chỉ số câu + 1)');
  assert.equal(engine.tick(state).seconds, 7, 'đồng hồ dừng khi thắng');
  assert.equal(engine.canSave(state), false);
}

// Chỉ số lựa chọn lạ thì bỏ qua; trạng thái không bị sửa tại chỗ.
{
  const state = engine.createGame(seededRng(4));
  for (const index of [-1, 4, 0.5, '1', null]) assert.equal(engine.choose(state, index).event, 'ignored');
  const next = engine.choose(state, answerIndex(state)).state;
  assert.equal(state.locked, false);
  assert.equal(next.locked, true);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.choices) && Object.isFrozen(state.answer));
}

// Lưu và khôi phục: giữ nguyên định dạng bản lưu trước khi tách engine.
{
  let state = engine.createGame(seededRng(21));
  state = engine.tick(engine.choose(state, (answerIndex(state) + 1) % 4).state);
  const saved = engine.serialize(state, 'game7-abc');
  assert.deepEqual(Object.keys(saved).sort(), ['answer', 'choices', 'correct', 'question', 'schemaVersion', 'seconds', 'sequence', 'sessionId', 'started']);
  const restored = engine.restore(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(engine.serialize(restored, 'game7-abc'), saved);
}

// Bản lưu do adapter cũ tạo ra (câu 3, quy luật AAB) vẫn khôi phục được.
const legacy = {
  schemaVersion: 1,
  sessionId: 'game7-legacy',
  question: 3,
  correct: 3,
  sequence: [{ h: 0, m: 0 }, { h: 0, m: 0 }, { h: 4, m: 2 }, { h: 0, m: 0 }, { h: 0, m: 0 }, { h: 4, m: 2 }, { h: 0, m: 0 }, { h: 0, m: 0 }],
  answer: { h: 4, m: 2 },
  choices: [{ h: 0, m: 0 }, { h: 4, m: 2 }, { h: 7, m: 5 }, { h: 2, m: 1 }],
  seconds: 48,
  started: true
};
{
  const restored = engine.restore(legacy);
  assert.equal(restored.question, 3);
  assert.equal(restored.correct, 3);
  assert.equal(restored.seconds, 48);
  assert.equal(answerIndex(restored), 1);
}

// Bản lưu hỏng thì bỏ (bé bắt đầu ván mới).
{
  const broken = [
    null,
    { ...legacy, question: 8 },
    { ...legacy, question: 6 },
    { ...legacy, sequence: legacy.sequence.slice(1) },
    { ...legacy, choices: legacy.choices.slice(1) },
    { ...legacy, choices: [legacy.choices[0], legacy.choices[0], legacy.choices[2], legacy.choices[3]] },
    { ...legacy, answer: { h: 6, m: 3 } },
    { ...legacy, answer: { h: 9, m: 0 } },
    { ...legacy, choices: [{ h: '<svg onload=x>', m: 0 }, ...legacy.choices.slice(1)] }
  ];
  broken.forEach((saved, index) => assert.equal(engine.restore(saved), null, `bản lưu hỏng #${index}`));
  const clamped = engine.restore({ ...legacy, correct: 99, seconds: -3 });
  assert.deepEqual([clamped.correct, clamped.seconds], [8, 0]);
}

console.log('Game 7 engine checks passed.');
