/*
 * Game 6 – Tìm Cặp Sinh Đôi: logic thuần, không đụng DOM.
 * Mỗi vòng là một lưới ô hình (kiểu hình × màu) trong đó đúng một tổ hợp xuất hiện hai lần.
 * Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ; giao diện ở js/game6-ui.js.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame6Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame6Engine() {
  'use strict';

  const SHAPE_COUNT = 8;
  const COLOR_COUNT = 6;
  /** 5 vòng, lưới to dần: số ô và số cột. */
  const ROUNDS = Object.freeze([
    Object.freeze({ cells: 12, columns: 4 }),
    Object.freeze({ cells: 16, columns: 4 }),
    Object.freeze({ cells: 20, columns: 5 }),
    Object.freeze({ cells: 25, columns: 5 }),
    Object.freeze({ cells: 30, columns: 6 })
  ]);
  const CODE_PATTERN = /^(\d+)-(\d+)$/;

  function parseCode(code) {
    const match = CODE_PATTERN.exec(String(code));
    if (!match) return null;
    const shape = Number(match[1]);
    const color = Number(match[2]);
    return shape < SHAPE_COUNT && color < COLOR_COUNT ? { shape, color } : null;
  }

  function shuffle(items, rng) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  /** Lưới cho một vòng: (số ô - 1) tổ hợp khác nhau, cộng thêm một bản sao của một trong số đó. */
  function createRound(roundIndex, rng = Math.random) {
    const config = ROUNDS[roundIndex];
    if (!config) throw new RangeError(`Vòng ${roundIndex} không tồn tại`);
    const all = [];
    for (let shape = 0; shape < SHAPE_COUNT; shape += 1) {
      for (let color = 0; color < COLOR_COUNT; color += 1) all.push(`${shape}-${color}`);
    }
    const unique = shuffle(all, rng).slice(0, config.cells - 1);
    const twin = unique[Math.floor(rng() * unique.length)];
    return shuffle([...unique, twin], rng);
  }

  /** Cỡ ô (px) co giãn theo bề ngang màn hình, tối đa 96px. */
  function cellSize(viewportWidth, columns) {
    return Math.min(96, Math.floor(Math.min(viewportWidth - 40, 720) / columns) - 10);
  }

  /** Mã của cặp sinh đôi, hoặc null nếu lưới không có đúng một cặp trùng. */
  function twinCode(cells) {
    const counts = new Map();
    cells.forEach((code) => counts.set(code, (counts.get(code) || 0) + 1));
    const twins = [...counts].filter(([, count]) => count === 2);
    const others = [...counts].filter(([, count]) => count !== 1 && count !== 2);
    return twins.length === 1 && others.length === 0 ? twins[0][0] : null;
  }

  function createGame(rng = Math.random) {
    return Object.freeze({
      round: 0,
      cells: Object.freeze(createRound(0, rng)),
      selectedIndex: -1,
      matched: Object.freeze([]),
      wrong: 0,
      seconds: 0,
      started: false,
      locked: false,
      finished: false
    });
  }

  const update = (state, changes) => Object.freeze({ ...state, ...changes });

  /**
   * Bé chạm vào ô `index`. Trả về { state, event, startedNow, pair }:
   * event là 'ignored' | 'selected' | 'deselected' | 'match' | 'mismatch'.
   * Khi 'match', vòng bị khóa đến khi gọi nextRound(); `pair` là hai ô liên quan.
   */
  function select(state, index) {
    const valid = Number.isInteger(index) && index >= 0 && index < state.cells.length;
    if (!valid || state.locked || state.finished || state.matched.includes(index)) {
      return { state, event: 'ignored', startedNow: false, pair: null };
    }
    const startedNow = !state.started;
    const base = startedNow ? update(state, { started: true }) : state;

    if (base.selectedIndex === index) {
      return { state: update(base, { selectedIndex: -1 }), event: 'deselected', startedNow, pair: null };
    }
    if (base.selectedIndex < 0) {
      return { state: update(base, { selectedIndex: index }), event: 'selected', startedNow, pair: null };
    }
    const pair = [base.selectedIndex, index];
    if (base.cells[base.selectedIndex] === base.cells[index]) {
      return {
        state: update(base, { selectedIndex: -1, matched: Object.freeze(pair), locked: true }),
        event: 'match',
        startedNow,
        pair
      };
    }
    return { state: update(base, { selectedIndex: -1, wrong: base.wrong + 1 }), event: 'mismatch', startedNow, pair };
  }

  /** Sau khi tìm đúng cặp: sang vòng kế, hoặc kết thúc ván nếu đã qua vòng cuối. */
  function nextRound(state, rng = Math.random) {
    if (!state.locked) return state;
    const round = state.round + 1;
    if (round >= ROUNDS.length) return update(state, { round, finished: true, locked: false });
    return update(state, {
      round,
      cells: Object.freeze(createRound(round, rng)),
      selectedIndex: -1,
      matched: Object.freeze([]),
      locked: false
    });
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lần chạm đầu và trước khi thắng. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  /** Số lượt dùng cho thống kê: số vòng đã qua cộng số lần chọn nhầm (như bản cũ). */
  function moves(state) {
    return Math.min(state.round, ROUNDS.length) + state.wrong;
  }

  /** Lưu được khi đang chơi giữa vòng (không khóa sau khi vừa tìm đúng, chưa thắng). */
  function canSave(state) {
    return !state.locked && !state.finished && Boolean(ROUNDS[state.round]);
  }

  /**
   * Bản lưu: giữ đúng định dạng của adapter games5-7-autosave trước khi tách engine,
   * để ván đang chơi dở trên máy của bé vẫn khôi phục được sau khi cập nhật.
   */
  function serialize(state, sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      round: state.round,
      cells: state.cells.slice(),
      selectedIndex: state.selectedIndex,
      wrong: state.wrong,
      seconds: state.seconds,
      started: state.started
    };
  }

  /** Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé bắt đầu ván mới). */
  function restore(saved) {
    if (!saved || typeof saved !== 'object') return null;
    const config = ROUNDS[saved.round];
    const cells = Array.isArray(saved.cells) ? saved.cells : null;
    if (!Number.isInteger(saved.round) || !config || !cells || cells.length !== config.cells) return null;
    if (cells.some((code) => !parseCode(code)) || !twinCode(cells)) return null;
    const selected = Number.isInteger(saved.selectedIndex) && saved.selectedIndex >= 0 && saved.selectedIndex < cells.length
      ? saved.selectedIndex
      : -1;
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    return Object.freeze({
      round: saved.round,
      cells: Object.freeze(cells.slice()),
      selectedIndex: selected,
      matched: Object.freeze([]),
      wrong: count(saved.wrong),
      seconds: count(saved.seconds),
      started: Boolean(saved.started),
      locked: false,
      finished: false
    });
  }

  return Object.freeze({
    SHAPE_COUNT,
    COLOR_COUNT,
    ROUNDS,
    parseCode,
    cellSize,
    createRound,
    twinCode,
    createGame,
    select,
    nextRound,
    tick,
    moves,
    canSave,
    serialize,
    restore
  });
});
