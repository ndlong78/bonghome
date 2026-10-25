/*
 * Game 3 – Tìm Bóng Cho Hình: logic thuần, không đụng DOM.
 * Mỗi ván có 6 hình màu (xáo trộn) và 6 cái bóng (xáo trộn theo thứ tự khác); bé kéo hình xuống đúng bóng.
 * Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ; giao diện ở js/game3-ui.js.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame3Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame3Engine() {
  'use strict';

  /** Kho 8 hình, vẽ trong khung 100x100. Bản lưu ghi id hình nên id không được đổi. */
  const SHAPES = Object.freeze([
    { id: 'ngoiSao', name: 'Ngôi sao', fill: '#FFE0A3', stroke: '#E0A94F',
      d: 'M50 8 L61 38 L93 40 L68 60 L76 92 L50 74 L24 92 L32 60 L7 40 L39 38 Z' },
    { id: 'traiTim', name: 'Trái tim', fill: '#FFB7C5', stroke: '#E9799C',
      d: 'M50 88 C10 62 12 26 32 20 C42 17 50 26 50 34 C50 26 58 17 68 20 C88 26 90 62 50 88 Z' },
    { id: 'vuongMien', name: 'Vương miện', fill: '#F5CC7A', stroke: '#D99A3E',
      d: 'M10 78 L16 26 L34 46 L50 16 L66 46 L84 26 L90 78 Z' },
    { id: 'caiNam', name: 'Cây nấm', fill: '#FF9FB3', stroke: '#E9799C',
      d: 'M8 50 A42 34 0 0 1 92 50 L64 50 L64 82 A8 8 0 0 1 36 82 L36 50 Z' },
    { id: 'conCa', name: 'Con cá', fill: '#BFE3FF', stroke: '#7FB6E8',
      d: 'M8 50 C24 22 62 22 74 50 C62 78 24 78 8 50 Z M74 50 L94 30 L94 70 Z' },
    { id: 'chiecLa', name: 'Chiếc lá', fill: '#A8E6CF', stroke: '#7FCFB0',
      d: 'M50 6 C86 22 90 66 50 94 C10 66 14 22 50 6 Z' },
    { id: 'ngoiNha', name: 'Ngôi nhà', fill: '#FFCBA4', stroke: '#D99A6C',
      d: 'M50 8 L94 46 L82 46 L82 92 L18 92 L18 46 L6 46 Z' },
    { id: 'trangLuoi', name: 'Trăng lưỡi liềm', fill: '#C9B6F5', stroke: '#9B85D6',
      d: 'M62 8 A44 44 0 1 0 62 92 A36 36 0 1 1 62 8 Z' }
  ].map((shape) => Object.freeze(shape)));
  /** Mỗi ván 6 hình. */
  const PIECE_COUNT = 6;

  const shapeById = (id) => SHAPES.find((shape) => shape.id === id) || null;

  /** Xáo trộn Fisher–Yates (bản cũ dùng sort với so sánh ngẫu nhiên, cho phân bố lệch). */
  function shuffle(items, rng) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.min(index, Math.floor(rng() * (index + 1)));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  const update = (state, changes) => Object.freeze({ ...state, ...changes });

  function createGame(rng = Math.random) {
    const chosen = shuffle(SHAPES.map((shape) => shape.id), rng).slice(0, PIECE_COUNT);
    return Object.freeze({
      colorOrder: Object.freeze(shuffle(chosen, rng)),
      shadowOrder: Object.freeze(shuffle(chosen, rng)),
      matched: Object.freeze([]),
      wrong: 0,
      seconds: 0,
      started: false,
      finished: false
    });
  }

  const isMatched = (state, id) => state.matched.includes(id);

  /**
   * Bé nhấc hình `pieceId` lên. Giữ hành vi cũ: đồng hồ bắt đầu từ lúc nhấc hình đầu tiên.
   * Trả về { state, event, startedNow }: event là 'ignored' (hình đã ghép, ván đã xong) hoặc 'picked'.
   */
  function pickUp(state, pieceId) {
    if (state.finished || !state.colorOrder.includes(pieceId) || isMatched(state, pieceId)) {
      return { state, event: 'ignored', startedNow: false };
    }
    const startedNow = !state.started;
    return { state: startedNow ? update(state, { started: true }) : state, event: 'picked', startedNow };
  }

  /**
   * Bé thả hình `pieceId` xuống bóng `shadowId` (null nếu thả ra ngoài).
   * Trả về { state, event }: event là 'ignored' | 'wrong' | 'correct' | 'completed'.
   * Thả ra ngoài hoặc thả lên bóng đã ghép thì bỏ qua, không tính nhầm (như bản cũ).
   */
  function drop(state, pieceId, shadowId) {
    const valid = !state.finished && state.colorOrder.includes(pieceId) && !isMatched(state, pieceId)
      && state.shadowOrder.includes(shadowId) && !isMatched(state, shadowId);
    if (!valid) return { state, event: 'ignored' };
    if (pieceId !== shadowId) return { state: update(state, { wrong: state.wrong + 1 }), event: 'wrong' };
    const matched = Object.freeze([...state.matched, pieceId]);
    const finished = matched.length === PIECE_COUNT;
    return { state: update(state, { matched, finished }), event: finished ? 'completed' : 'correct' };
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lần nhấc hình đầu và trước khi ghép xong. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  /** Số lượt cho thống kê: giữ công thức cũ (lần ghép nhầm + hình đã ghép). */
  const moves = (state) => state.wrong + state.matched.length;
  const canSave = (state) => !state.finished;

  /**
   * Bản lưu: giữ đúng định dạng của adapter games2-4-autosave trước khi tách engine
   * (`matched` theo thứ tự các bóng trên màn hình), để ván đang chơi dở vẫn khôi phục được.
   */
  function serialize(state, sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      colorOrder: state.colorOrder.slice(),
      shadowOrder: state.shadowOrder.slice(),
      matched: state.shadowOrder.filter((id) => isMatched(state, id)),
      wrong: state.wrong,
      seconds: state.seconds,
      started: state.started
    };
  }

  /** Đúng 6 id hình có thật, không trùng. */
  function validOrder(order) {
    return Array.isArray(order) && order.length === PIECE_COUNT
      && order.every((id) => typeof id === 'string' && shapeById(id)) && new Set(order).size === PIECE_COUNT;
  }

  /** Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé chơi ván mới). */
  function restore(saved) {
    if (!saved || typeof saved !== 'object') return null;
    const { colorOrder, shadowOrder } = saved;
    if (!validOrder(colorOrder) || !validOrder(shadowOrder)) return null;
    // Khay hình màu và hàng bóng phải là cùng một bộ 6 hình.
    if (!colorOrder.every((id) => shadowOrder.includes(id))) return null;
    // Chỉ giữ những hình đã ghép có trong ván; bỏ id lạ thay vì đếm sai số hình đã ghép.
    const matched = shadowOrder.filter((id) => Array.isArray(saved.matched) && saved.matched.includes(id));
    // Đã ghép đủ mà vẫn còn bản lưu (lưu đúng lúc thắng): coi như ván đã xong, bé chơi ván mới.
    if (matched.length === PIECE_COUNT) return null;
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    return Object.freeze({
      colorOrder: Object.freeze(colorOrder.slice()),
      shadowOrder: Object.freeze(shadowOrder.slice()),
      matched: Object.freeze(matched),
      wrong: count(saved.wrong),
      seconds: count(saved.seconds),
      started: Boolean(saved.started),
      finished: false
    });
  }

  return Object.freeze({
    SHAPES,
    PIECE_COUNT,
    shapeById,
    createGame,
    isMatched,
    pickUp,
    drop,
    tick,
    moves,
    canSave,
    serialize,
    restore
  });
});
