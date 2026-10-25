/*
 * Game 1 – Lật Hình Tìm Cặp: logic thuần, không đụng DOM.
 * Bộ bài là mảng mã hình (0..pairs-1), mỗi mã xuất hiện đúng 2 lần; hình vẽ của từng mã nằm ở js/game1-ui.js
 * (hoặc nội dung chủ đề do js/game1-content.js nạp). Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame1Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame1Engine() {
  'use strict';

  /** Số cặp hợp lệ: 3/6/12 theo nội dung JSON, 8 là mức Khó dự phòng khi không tải được nội dung. */
  const PAIR_COUNTS = Object.freeze([3, 6, 8, 12]);
  const SNAPSHOT_VERSION = 1;

  const pick = (rng, count) => Math.min(count - 1, Math.max(0, Math.floor(rng() * count)));
  const update = (state, changes) => Object.freeze({ ...state, ...changes });
  const frozen = (values) => Object.freeze(values.slice());

  /** Ván mới: nhân đôi các mã hình rồi xáo kiểu Fisher–Yates (như bản cũ). */
  function createGame(pairs, rng = Math.random) {
    if (!PAIR_COUNTS.includes(pairs)) throw new RangeError(`Số cặp không hợp lệ: ${pairs}`);
    const deck = Array.from({ length: pairs * 2 }, (_, index) => index % pairs);
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = pick(rng, i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return Object.freeze({
      pairs,
      deck: Object.freeze(deck),
      matched: frozen([]),
      open: frozen([]),
      moves: 0,
      seconds: 0,
      started: false,
      locked: false,
      finished: false
    });
  }

  const matchedPairs = (state) => state.matched.length / 2;

  /**
   * Bé lật lá thứ `index`. Trả về { state, event, startedNow }:
   * event là 'ignored' | 'opened' | 'match' | 'completed' | 'mismatch'.
   * Đồng hồ bắt đầu từ lá đầu tiên; mỗi lần lật đủ 2 lá tính 1 lượt.
   * Hai lá khác nhau thì ván bị khoá cho tới khi gọi closeMismatch (giao diện úp lại sau một nhịp).
   */
  function flip(state, index) {
    const ignored = { state, event: 'ignored', startedNow: false };
    if (state.locked || state.finished || !Number.isInteger(index) || index < 0 || index >= state.deck.length) return ignored;
    if (state.open.includes(index) || state.matched.includes(index)) return ignored;
    const startedNow = !state.started;
    const open = [...state.open, index];
    if (open.length < 2) {
      return { state: update(state, { open: frozen(open), started: true }), event: 'opened', startedNow };
    }
    const moves = state.moves + 1;
    const [a, b] = open;
    if (state.deck[a] !== state.deck[b]) {
      return { state: update(state, { open: frozen(open), moves, started: true, locked: true }), event: 'mismatch', startedNow };
    }
    const matched = frozen([...state.matched, a, b]);
    const finished = matched.length === state.deck.length;
    return {
      state: update(state, { matched, open: frozen([]), moves, started: true, finished }),
      event: finished ? 'completed' : 'match',
      startedNow
    };
  }

  /** Úp lại hai lá khác nhau và mở khoá. Gọi khi không có cặp sai đang chờ thì không đổi gì. */
  function closeMismatch(state) {
    return state.locked ? update(state, { open: frozen([]), locked: false }) : state;
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lá đầu tiên và trước khi tìm đủ. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  const canSave = (state) => !state.finished;
  /** Ván có gì đáng lưu (adapter không lưu ván chưa chạm lá nào). */
  const hasProgress = (state) => Boolean(state.started || state.moves || state.matched.length || state.open.length);

  /** Bản lưu: giữ đúng định dạng snapshot của game1-autosave.js trước khi tách engine. */
  function serialize(state) {
    return {
      version: SNAPSHOT_VERSION,
      difficulty: state.pairs,
      deck: state.deck.slice(),
      matchedIndices: state.matched.slice(),
      openIndices: state.open.slice(),
      moves: state.moves,
      seconds: state.seconds,
      started: state.started,
      locked: state.locked
    };
  }

  function uniqueIndices(values, max) {
    if (!Array.isArray(values)) return null;
    const seen = new Set();
    for (const value of values) {
      if (!Number.isInteger(value) || value < 0 || value >= max || seen.has(value)) return null;
      seen.add(value);
    }
    return values.slice();
  }

  /**
   * Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé chơi ván mới).
   * Ngoài các điều kiện của adapter cũ, kiểm thêm quan hệ giữa các trường:
   * lá đã ghép phải đi theo cặp cùng hình, hai lá đang mở phải khác hình (nếu cùng hình thì đã được ghép).
   */
  function restore(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) || saved.version !== SNAPSHOT_VERSION) return null;
    const pairs = Number(saved.difficulty);
    if (!PAIR_COUNTS.includes(pairs)) return null;
    const deck = saved.deck;
    if (!Array.isArray(deck) || deck.length !== pairs * 2) return null;
    if (!deck.every((code) => Number.isInteger(code) && code >= 0 && code < pairs)) return null;
    const counts = new Map();
    deck.forEach((code) => counts.set(code, (counts.get(code) || 0) + 1));
    if (counts.size !== pairs || [...counts.values()].some((count) => count !== 2)) return null;

    const matched = uniqueIndices(saved.matchedIndices, deck.length);
    const open = uniqueIndices(saved.openIndices, deck.length);
    if (!matched || !open || matched.length % 2 !== 0 || open.length > 2) return null;
    if (open.some((index) => matched.includes(index))) return null;
    const matchedCodes = new Map();
    matched.forEach((index) => matchedCodes.set(deck[index], (matchedCodes.get(deck[index]) || 0) + 1));
    if ([...matchedCodes.values()].some((count) => count !== 2)) return null;
    if (open.length === 2 && deck[open[0]] === deck[open[1]]) return null;
    // Đã ghép đủ mà vẫn còn bản lưu: coi như ván đã xong, bé chơi ván mới.
    if (matched.length === deck.length) return null;

    const moves = Number(saved.moves);
    const seconds = Number(saved.seconds);
    if (!Number.isInteger(moves) || moves < 0 || !Number.isInteger(seconds) || seconds < 0) return null;

    return Object.freeze({
      pairs,
      deck: frozen(deck),
      matched: frozen(matched),
      open: frozen(open),
      moves,
      seconds,
      started: Boolean(saved.started),
      // Hai lá đang mở luôn là cặp sai chờ úp lại; một lá thì không khoá (bản cũ từng lưu cờ khoá thừa).
      locked: open.length === 2,
      finished: false
    });
  }

  return Object.freeze({
    PAIR_COUNTS,
    SNAPSHOT_VERSION,
    createGame,
    flip,
    closeMismatch,
    tick,
    matchedPairs,
    canSave,
    hasProgress,
    serialize,
    restore
  });
});
