/*
 * Game 7 – Đoán Hình Tiếp Theo: logic thuần, không đụng DOM.
 * Mỗi câu là một chuỗi hình lặp theo quy luật (AB, ABC, AAB…) bị che ô cuối; bé chọn 1 trong
 * 4 hình. Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ; giao diện ở js/game7-ui.js.
 * Một hình là { h: kiểu hình, m: màu }.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame7Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame7Engine() {
  'use strict';

  const SHAPE_COUNT = 8;
  const COLOR_COUNT = 6;
  const CHOICE_COUNT = 4;
  const CYCLES = 3;
  /** 8 câu, quy luật khó dần: AB → ABC → AAB → ABB → AABB → ABCD. */
  const PATTERNS = Object.freeze([
    [0, 1],
    [0, 1],
    [0, 1, 2],
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 2],
    [0, 0, 1, 1],
    [0, 1, 2, 3]
  ].map((pattern) => Object.freeze(pattern)));
  const QUESTION_COUNT = PATTERNS.length;

  const isCombo = (value) => Boolean(value) && Number.isInteger(value.h) && Number.isInteger(value.m)
    && value.h >= 0 && value.h < SHAPE_COUNT && value.m >= 0 && value.m < COLOR_COUNT;
  const sameCombo = (a, b) => a.h === b.h && a.m === b.m;
  const comboKey = (value) => `${value.h}-${value.m}`;
  const freezeCombo = (value) => Object.freeze({ h: value.h, m: value.m });

  function shuffle(items, rng) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  /** Độ dài chuỗi hiện ra: 3 chu kỳ của quy luật, bỏ ô cuối (ô cuối chính là đáp án). */
  function sequenceLength(questionIndex) {
    return PATTERNS[questionIndex].length * CYCLES - 1;
  }

  /**
   * Một câu hỏi: chuỗi hình, đáp án và 4 lựa chọn (1 đúng + 3 gây nhiễu khác kiểu hoặc khác màu).
   * Một nửa số hình gây nhiễu lấy từ chính các hình trong quy luật, để bé phải đếm đúng chu kỳ.
   */
  function createQuestion(questionIndex, rng = Math.random) {
    const pattern = PATTERNS[questionIndex];
    if (!pattern) throw new RangeError(`Câu ${questionIndex} không tồn tại`);
    const pool = [];
    for (let h = 0; h < SHAPE_COUNT; h += 1) {
      for (let m = 0; m < COLOR_COUNT; m += 1) pool.push({ h, m });
    }
    const shuffled = shuffle(pool, rng);
    const roles = shuffled.slice(0, Math.max(...pattern) + 1);
    const full = Array.from({ length: pattern.length * CYCLES }, (_, index) => roles[pattern[index % pattern.length]]);
    const answer = full[full.length - 1];

    const distractors = [];
    const seen = new Set([comboKey(answer)]);
    const take = (candidate) => {
      if (seen.has(comboKey(candidate))) return;
      seen.add(comboKey(candidate));
      distractors.push(candidate);
    };
    // Bốc ngẫu nhiên có giới hạn; nếu rng kém (lặp một giá trị) thì lấy lần lượt từ kho, không thể treo.
    for (let attempt = 0; attempt < 200 && distractors.length < CHOICE_COUNT - 1; attempt += 1) {
      take(rng() < 0.5 && roles.length > 1
        ? roles[Math.floor(rng() * roles.length)]
        : shuffled[Math.floor(rng() * shuffled.length)]);
    }
    for (let index = 0; index < shuffled.length && distractors.length < CHOICE_COUNT - 1; index += 1) take(shuffled[index]);
    return {
      sequence: Object.freeze(full.slice(0, -1).map(freezeCombo)),
      answer: freezeCombo(answer),
      choices: Object.freeze(shuffle([answer, ...distractors], rng).map(freezeCombo))
    };
  }

  const update = (state, changes) => Object.freeze({ ...state, ...changes });

  function createGame(rng = Math.random) {
    return Object.freeze({
      question: 0,
      ...createQuestion(0, rng),
      correct: 0,
      missed: false,
      seconds: 0,
      started: false,
      locked: false,
      finished: false
    });
  }

  /**
   * Bé chọn lựa chọn thứ `choiceIndex`. Trả về { state, event, startedNow }:
   * event là 'ignored' | 'correct' | 'wrong'. Sau 'correct' câu bị khóa đến khi gọi nextQuestion().
   * `correct` chỉ đếm câu bé chọn đúng ngay lần đầu; đã chọn sai thì câu đó không được đếm.
   */
  function choose(state, choiceIndex) {
    const valid = Number.isInteger(choiceIndex) && choiceIndex >= 0 && choiceIndex < state.choices.length;
    if (!valid || state.locked || state.finished) return { state, event: 'ignored', startedNow: false };
    const startedNow = !state.started;
    const base = startedNow ? update(state, { started: true }) : state;
    if (sameCombo(base.choices[choiceIndex], base.answer)) {
      const correct = base.correct + (base.missed ? 0 : 1);
      return { state: update(base, { locked: true, correct }), event: 'correct', startedNow };
    }
    return { state: base.missed ? base : update(base, { missed: true }), event: 'wrong', startedNow };
  }

  /** Sau khi trả lời đúng: sang câu kế, hoặc kết thúc ván nếu đã qua câu cuối. */
  function nextQuestion(state, rng = Math.random) {
    if (!state.locked) return state;
    const question = state.question + 1;
    if (question >= QUESTION_COUNT) return update(state, { question, finished: true, locked: false });
    return update(state, { question, ...createQuestion(question, rng), missed: false, locked: false });
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lần chọn đầu và trước khi thắng. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  /** Số lượt dùng cho thống kê: giữ đúng công thức cũ (chỉ số câu hiện tại + 1). */
  function moves(state) {
    return state.question + 1;
  }

  /** Lưu được khi đang chờ bé chọn (không khóa sau khi vừa trả lời đúng, chưa thắng). */
  function canSave(state) {
    return !state.locked && !state.finished && Boolean(PATTERNS[state.question]);
  }

  /**
   * Bản lưu: giữ đúng định dạng của adapter games5-7-autosave trước khi tách engine,
   * để ván đang chơi dở trên máy của bé vẫn khôi phục được sau khi cập nhật.
   * `missed` (câu hiện tại đã chọn sai) là trường thêm sau; bản lưu cũ không có thì coi là chưa sai.
   */
  function serialize(state, sessionId) {
    const plain = (value) => ({ h: value.h, m: value.m });
    return {
      schemaVersion: 1,
      sessionId,
      question: state.question,
      correct: state.correct,
      missed: state.missed,
      sequence: state.sequence.map(plain),
      answer: plain(state.answer),
      choices: state.choices.map(plain),
      seconds: state.seconds,
      started: state.started
    };
  }

  /** Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé bắt đầu ván mới). */
  function restore(saved) {
    if (!saved || typeof saved !== 'object') return null;
    const question = saved.question;
    if (!Number.isInteger(question) || !PATTERNS[question]) return null;
    const sequence = Array.isArray(saved.sequence) ? saved.sequence : null;
    const choices = Array.isArray(saved.choices) ? saved.choices : null;
    if (!sequence || sequence.length !== sequenceLength(question) || !sequence.every(isCombo)) return null;
    if (!choices || choices.length !== CHOICE_COUNT || !choices.every(isCombo)) return null;
    if (!isCombo(saved.answer) || choices.filter((choice) => sameCombo(choice, saved.answer)).length !== 1) return null;
    if (new Set(choices.map(comboKey)).size !== CHOICE_COUNT) return null;
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    return Object.freeze({
      question,
      sequence: Object.freeze(sequence.map(freezeCombo)),
      answer: freezeCombo(saved.answer),
      choices: Object.freeze(choices.map(freezeCombo)),
      correct: Math.min(question, count(saved.correct)),
      missed: saved.missed === true,
      seconds: count(saved.seconds),
      started: Boolean(saved.started),
      locked: false,
      finished: false
    });
  }

  return Object.freeze({
    SHAPE_COUNT,
    COLOR_COUNT,
    CHOICE_COUNT,
    PATTERNS,
    QUESTION_COUNT,
    isCombo,
    sameCombo,
    sequenceLength,
    createQuestion,
    createGame,
    choose,
    nextQuestion,
    tick,
    moves,
    canSave,
    serialize,
    restore
  });
});
