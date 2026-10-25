/*
 * Game 4 – Gom Đồ Theo Màu: logic thuần, không đụng DOM.
 * 12 đồ vật (mỗi màu 3 cái, kiểu dáng ngẫu nhiên) và 4 cái giỏ; bé kéo mỗi đồ vật vào giỏ cùng màu.
 * Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ; giao diện ở js/game4-ui.js.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame4Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame4Engine() {
  'use strict';

  /** 4 màu giỏ. Bản lưu ghi id màu nên id không được đổi. */
  const COLORS = Object.freeze([
    { id: 'hong', name: 'Hồng', main: '#FFB7C5', dark: '#E9799C' },
    { id: 'vang', name: 'Vàng', main: '#FFE0A3', dark: '#E0A94F' },
    { id: 'mint', name: 'Xanh', main: '#A8E6CF', dark: '#7FCFB0' },
    { id: 'tim', name: 'Tím', main: '#C9B6F5', dark: '#9B85D6' }
  ].map((color) => Object.freeze(color)));

  /*
   * Kiểu đồ vật: chuỗi SVG theo màu giỏ. Giữ ĐÚNG từng ký tự như bản cũ, vì bản lưu rất cũ chỉ có HTML
   * và được nhận lại bằng cách so với các mẫu này (js/game4-ui.js). Bản lưu ghi chỉ số kiểu nên thứ tự không được đổi.
   */
  const SHAPES = Object.freeze([
    (c) => `<svg viewBox="0 0 100 100"><circle cx="50" cy="55" r="34" fill="${c.main}" stroke="${c.dark}" stroke-width="4"/>
      <path d="M50 21 v-10" stroke="#7FCFB0" stroke-width="5" stroke-linecap="round"/>
      <path d="M50 16 q14-8 20 2 q-14 6-20-2z" fill="#A8E6CF"/></svg>`, /* quả táo */
    (c) => `<svg viewBox="0 0 100 100"><path d="M50 10 L61 40 L93 43 L68 63 L77 94 L50 76 L23 94 L32 63 L7 43 L39 40 Z"
      fill="${c.main}" stroke="${c.dark}" stroke-width="4" stroke-linejoin="round"/></svg>`, /* ngôi sao */
    (c) => `<svg viewBox="0 0 100 100"><path d="M50 90 C12 66 14 30 33 24 C43 21 50 30 50 38 C50 30 57 21 67 24 C86 30 88 66 50 90 Z"
      fill="${c.main}" stroke="${c.dark}" stroke-width="4"/></svg>`, /* trái tim */
    (c) => `<svg viewBox="0 0 100 100"><g fill="${c.main}" stroke="${c.dark}" stroke-width="3">
      <circle cx="50" cy="30" r="15"/><circle cx="30" cy="50" r="15"/><circle cx="70" cy="50" r="15"/><circle cx="50" cy="70" r="15"/></g>
      <circle cx="50" cy="50" r="11" fill="#FFF3C4" stroke="#E0A94F" stroke-width="3"/></svg>`, /* bông hoa */
    (c) => `<svg viewBox="0 0 100 100"><rect x="18" y="34" width="64" height="46" rx="10" fill="${c.main}" stroke="${c.dark}" stroke-width="4"/>
      <path d="M18 46 h64" stroke="${c.dark}" stroke-width="3"/>
      <path d="M50 34 v-8" stroke="${c.dark}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="50" cy="22" r="7" fill="#FFF" stroke="${c.dark}" stroke-width="3"/></svg>`, /* hộp quà */
    (c) => `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="24" fill="${c.main}" stroke="${c.dark}" stroke-width="4"/>
      <rect x="45" y="60" width="10" height="30" rx="4" fill="#E6D3B8" stroke="#C4A882" stroke-width="3"/>
      <circle cx="42" cy="32" r="5" fill="#fff" opacity=".7"/></svg>`, /* kẹo mút */
    (c) => `<svg viewBox="0 0 100 100"><path d="M20 78 L50 16 L80 78 Z" fill="${c.main}" stroke="${c.dark}" stroke-width="4" stroke-linejoin="round"/></svg>`, /* tam giác */
    (c) => `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" rx="12" fill="${c.main}" stroke="${c.dark}" stroke-width="4"/>
      <circle cx="50" cy="50" r="12" fill="#fff" opacity=".55"/></svg>` /* khối vuông */
  ]);
  const PER_COLOR = 3;
  /** 12 đồ vật, mỗi màu 3 cái. */
  const ITEM_COUNT = COLORS.length * PER_COLOR;

  const colorById = (id) => COLORS.find((color) => color.id === id) || null;
  const isShape = (value) => Number.isInteger(value) && value >= 0 && value < SHAPES.length;
  /** Chuỗi SVG của một đồ vật (chỉ dựng từ mẫu có sẵn, không bao giờ từ dữ liệu lưu). */
  const shapeSvg = (shape, colorId) => SHAPES[shape](colorById(colorId));

  const pick = (rng, count) => Math.min(count - 1, Math.max(0, Math.floor(rng() * count)));
  /** Xáo trộn Fisher–Yates (bản cũ dùng sort với so sánh ngẫu nhiên, cho phân bố lệch). */
  function shuffle(items, rng) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = pick(rng, index + 1);
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  const freezeObjects = (objects) => Object.freeze(objects.map((item) => Object.freeze({ color: item.color, shape: item.shape, done: item.done })));
  const update = (state, changes) => Object.freeze({ ...state, ...changes });

  function createGame(rng = Math.random) {
    const objects = [];
    COLORS.forEach((color) => {
      for (let i = 0; i < PER_COLOR; i += 1) objects.push({ color: color.id, shape: pick(rng, SHAPES.length), done: false });
    });
    return Object.freeze({
      objects: freezeObjects(shuffle(objects, rng)),
      wrong: 0,
      seconds: 0,
      started: false,
      finished: false
    });
  }

  const collected = (state) => state.objects.filter((item) => item.done).length;
  /** Số đồ vật trong mỗi giỏ, tính từ các đồ vật đã gom. */
  function basketCounts(state) {
    const counts = {};
    COLORS.forEach((color) => { counts[color.id] = 0; });
    state.objects.forEach((item) => { if (item.done) counts[item.color] += 1; });
    return counts;
  }

  const movable = (state, index) => !state.finished && Number.isInteger(index) && Boolean(state.objects[index]) && !state.objects[index].done;

  /**
   * Bé nhấc đồ vật thứ `index` lên. Giữ hành vi cũ: đồng hồ bắt đầu từ lần nhấc đầu tiên.
   * Trả về { state, event, startedNow }: event là 'ignored' hoặc 'picked'.
   */
  function pickUp(state, index) {
    if (!movable(state, index)) return { state, event: 'ignored', startedNow: false };
    const startedNow = !state.started;
    return { state: startedNow ? update(state, { started: true }) : state, event: 'picked', startedNow };
  }

  /**
   * Bé thả đồ vật thứ `index` vào giỏ màu `basketColor` (null nếu thả ra ngoài).
   * Trả về { state, event }: event là 'ignored' | 'wrong' | 'correct' | 'completed'.
   */
  function drop(state, index, basketColor) {
    if (!movable(state, index) || !colorById(basketColor)) return { state, event: 'ignored' };
    if (state.objects[index].color !== basketColor) return { state: update(state, { wrong: state.wrong + 1 }), event: 'wrong' };
    const objects = freezeObjects(state.objects.map((item, i) => (i === index ? { ...item, done: true } : item)));
    const next = update(state, { objects });
    const finished = collected(next) === ITEM_COUNT;
    return { state: finished ? update(next, { finished }) : next, event: finished ? 'completed' : 'correct' };
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lần nhấc đầu và trước khi gom xong. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  /** Số lượt cho thống kê: giữ công thức cũ (lần bỏ nhầm + đồ vật đã gom). */
  const moves = (state) => state.wrong + collected(state);
  const canSave = (state) => !state.finished;

  /**
   * Bản lưu: giữ đúng định dạng của adapter games2-4-autosave trước khi tách engine,
   * để ván đang chơi dở trên máy của bé vẫn khôi phục được sau khi cập nhật.
   */
  function serialize(state, sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      objects: state.objects.map(({ color, shape, done }) => ({ color, shape, done })),
      basketCounts: basketCounts(state),
      collected: collected(state),
      wrong: state.wrong,
      seconds: state.seconds,
      started: state.started
    };
  }

  /**
   * Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé chơi ván mới).
   * `shapeFromHtml(colorId, html)` (tùy chọn) nhận lại kiểu đồ vật từ bản lưu rất cũ chỉ có HTML;
   * trả về -1 nếu HTML không khớp mẫu nào.
   */
  function restore(saved, { shapeFromHtml } = {}) {
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.objects) || saved.objects.length !== ITEM_COUNT) return null;
    const objects = [];
    for (const item of saved.objects) {
      if (!item || typeof item !== 'object' || !colorById(item.color)) return null;
      let shape = item.shape;
      if (!isShape(shape) && typeof item.html === 'string' && typeof shapeFromHtml === 'function') shape = shapeFromHtml(item.color, item.html);
      if (!isShape(shape)) return null;
      objects.push({ color: item.color, shape, done: item.done === true });
    }
    // Mỗi màu đúng 3 đồ vật, như mọi ván do game tạo ra.
    if (COLORS.some((color) => objects.filter((item) => item.color === color.id).length !== PER_COLOR)) return null;
    // Đã gom đủ mà vẫn còn bản lưu (lưu đúng lúc thắng): coi như ván đã xong, bé chơi ván mới.
    if (objects.every((item) => item.done)) return null;
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    // Số đã gom và số trong từng giỏ tính lại từ các đồ vật, không tin trường `collected`/`basketCounts` đã lưu.
    return Object.freeze({
      objects: freezeObjects(objects),
      wrong: count(saved.wrong),
      seconds: count(saved.seconds),
      started: Boolean(saved.started),
      finished: false
    });
  }

  return Object.freeze({
    COLORS,
    SHAPE_COUNT: SHAPES.length,
    ITEM_COUNT,
    colorById,
    shapeSvg,
    createGame,
    collected,
    basketCounts,
    pickUp,
    drop,
    tick,
    moves,
    canSave,
    serialize,
    restore
  });
});
