/*
 * Game 2 – Tìm Điểm Khác Biệt: logic thuần, không đụng DOM.
 * Hai bức tranh 300x300 giống nhau trừ 5 vật được đổi ở tranh 2; bé chạm vào chỗ khác.
 * Hình vẽ từng vật nằm trong js/game2-ui.js; ở đây chỉ có vị trí và vùng chạm.
 * Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame2Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame2Engine() {
  'use strict';

  /** 10 vật trong tranh: tâm và bán kính vùng chạm (toạ độ viewBox 300x300). Bản lưu ghi id nên id không được đổi. */
  const OBJECTS = Object.freeze([
    { id: 'matTroi', x: 44, y: 44, r: 30 },
    { id: 'may', x: 232, y: 40, r: 34 },
    { id: 'ngoiSao', x: 132, y: 36, r: 22 },
    { id: 'nhaKeo', x: 150, y: 180, r: 46 },
    { id: 'kyLan', x: 56, y: 196, r: 36 },
    { id: 'buom', x: 236, y: 126, r: 26 },
    { id: 'cay', x: 256, y: 210, r: 36 },
    { id: 'hoaTrai', x: 26, y: 268, r: 24 },
    { id: 'meoCon', x: 196, y: 262, r: 26 },
    { id: 'nam', x: 96, y: 272, r: 24 }
  ].map((item) => Object.freeze(item)));
  /** Mỗi ván có đúng 5 điểm khác biệt và 2 lượt gợi ý. */
  const DIFFERENCE_COUNT = 5;
  const HINTS = 2;

  const objectById = (id) => OBJECTS.find((item) => item.id === id) || null;
  const pick = (rng, count) => Math.min(count - 1, Math.max(0, Math.floor(rng() * count)));
  const update = (state, changes) => Object.freeze({ ...state, ...changes });

  /** Ván mới: chọn ngẫu nhiên 5 vật làm điểm khác biệt (Fisher–Yates, như bản cũ). */
  function createGame(rng = Math.random) {
    const ids = OBJECTS.map((item) => item.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = pick(rng, i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return Object.freeze({
      differences: Object.freeze(ids.slice(0, DIFFERENCE_COUNT)),
      found: Object.freeze([]),
      wrong: 0,
      hintsLeft: HINTS,
      seconds: 0,
      started: false,
      finished: false
    });
  }

  const remaining = (state) => state.differences.filter((id) => !state.found.includes(id));

  /**
   * Bé chạm vào điểm (x, y) trên một trong hai tranh. Trả về { state, event, object, startedNow }:
   * event là 'ignored' | 'found' | 'completed' | 'wrong'; `object` là vật vừa tìm ra.
   * Giữ hành vi cũ: đồng hồ bắt đầu từ lần chạm đầu; chạm vào chỗ đã tìm ra cũng tính chấm sai.
   * Đã tìm đủ (đang chờ màn thắng) thì bỏ qua mọi lần chạm.
   */
  function tap(state, x, y) {
    if (state.finished || !Number.isFinite(x) || !Number.isFinite(y)) {
      return { state, event: 'ignored', object: null, startedNow: false };
    }
    const startedNow = !state.started;
    const base = startedNow ? update(state, { started: true }) : state;
    const hit = remaining(base).map(objectById).find((item) => Math.hypot(x - item.x, y - item.y) <= item.r);
    if (!hit) return { state: update(base, { wrong: base.wrong + 1 }), event: 'wrong', object: null, startedNow };
    const found = Object.freeze([...base.found, hit.id]);
    const finished = found.length === DIFFERENCE_COUNT;
    return { state: update(base, { found, finished }), event: finished ? 'completed' : 'found', object: hit, startedNow };
  }

  /**
   * Dùng một lượt gợi ý: chỉ ra ngẫu nhiên một điểm chưa tìm. Trả về { state, object }
   * (object null nếu hết lượt, đã tìm đủ hoặc ván đã xong). Gợi ý không bắt đầu đồng hồ.
   */
  function hint(state, rng = Math.random) {
    const left = remaining(state);
    if (state.finished || state.hintsLeft <= 0 || !left.length) return { state, object: null };
    return { state: update(state, { hintsLeft: state.hintsLeft - 1 }), object: objectById(left[pick(rng, left.length)]) };
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lần chạm đầu và trước khi tìm đủ. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  /** Số lượt cho thống kê: giữ công thức cũ (chấm sai + điểm đã tìm). */
  const moves = (state) => state.wrong + state.found.length;
  const canSave = (state) => !state.finished;

  /**
   * Bản lưu: giữ đúng định dạng của adapter games2-4-autosave trước khi tách engine,
   * để ván đang chơi dở trên máy của bé vẫn khôi phục được sau khi cập nhật.
   */
  function serialize(state, sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      differences: state.differences.slice(),
      found: state.found.slice(),
      wrong: state.wrong,
      hintsLeft: state.hintsLeft,
      seconds: state.seconds,
      started: state.started
    };
  }

  /** Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé chơi tranh mới). */
  function restore(saved) {
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.differences)) return null;
    const differences = saved.differences;
    // Đúng 5 vật có thật, không trùng (bản cũ nhận cả 5 id giống nhau).
    if (differences.length !== DIFFERENCE_COUNT || !differences.every((id) => typeof id === 'string' && objectById(id))) return null;
    if (new Set(differences).size !== DIFFERENCE_COUNT) return null;
    const savedFound = Array.isArray(saved.found) ? saved.found : [];
    const found = differences.filter((id) => savedFound.includes(id));
    // Đã tìm đủ mà vẫn còn bản lưu (lưu đúng lúc thắng): coi như ván đã xong, bé chơi tranh mới.
    if (found.length === DIFFERENCE_COUNT) return null;
    // Giữ thứ tự tìm ra như bản lưu, bỏ id lạ và id trùng.
    const ordered = savedFound.filter((id, index) => found.includes(id) && savedFound.indexOf(id) === index);
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    return Object.freeze({
      differences: Object.freeze(differences.slice()),
      found: Object.freeze(ordered),
      wrong: count(saved.wrong),
      hintsLeft: Number.isFinite(saved.hintsLeft) ? Math.max(0, Math.min(HINTS, Math.floor(saved.hintsLeft))) : HINTS,
      seconds: count(saved.seconds),
      started: Boolean(saved.started),
      finished: false
    });
  }

  return Object.freeze({
    OBJECTS,
    DIFFERENCE_COUNT,
    HINTS,
    objectById,
    createGame,
    remaining,
    tap,
    hint,
    tick,
    moves,
    canSave,
    serialize,
    restore
  });
});
