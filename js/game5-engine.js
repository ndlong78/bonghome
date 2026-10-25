/*
 * Game 5 – Nối Điểm Theo Số: logic thuần, không đụng DOM.
 * Bé chạm các chấm theo thứ tự 1 → 2 → 3… để hiện ra một bức hình bí mật.
 * Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ; giao diện ở js/game5-ui.js.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame5Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame5Engine() {
  'use strict';

  function starPoints() {
    const points = [];
    const cx = 200;
    const cy = 210;
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 155 : 68;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      points.push([Math.round(cx + radius * Math.cos(angle)), Math.round(cy + radius * Math.sin(angle))]);
    }
    return points;
  }

  /** Kho hình: mỗi hình là danh sách tọa độ các chấm (khung 400x400), nối theo thứ tự rồi khép kín. Giữ đúng thứ tự cũ vì bản lưu ghi chỉ số hình. */
  const SHAPES = Object.freeze([
    { name: 'Ngôi sao lung linh', fill: '#FFE0A3', stroke: '#E0A94F', points: starPoints() },
    { name: 'Ngôi nhà nhỏ', fill: '#FFB7C5', stroke: '#E9799C',
      points: [[110, 360], [110, 200], [62, 200], [200, 80], [338, 200], [290, 200], [290, 360]] },
    { name: 'Con cá tung tăng', fill: '#BFE3FF', stroke: '#7FB6E8',
      points: [[40, 210], [110, 140], [210, 120], [300, 170], [356, 110], [366, 300], [300, 245], [210, 290], [110, 275]] },
    { name: 'Vương miện công chúa', fill: '#F5CC7A', stroke: '#D99A3E',
      points: [[54, 320], [76, 140], [138, 232], [200, 104], [262, 232], [324, 140], [346, 320]] },
    { name: 'Chiếc thuyền buồm', fill: '#A8E6CF', stroke: '#7FCFB0',
      points: [[196, 50], [196, 250], [330, 250], [196, 58], [70, 250], [356, 250], [310, 340], [90, 340], [44, 250]] }
  ].map((shape) => Object.freeze({ ...shape, points: Object.freeze(shape.points.map((point) => Object.freeze(point))) })));

  const isShapeIndex = (value) => Number.isInteger(value) && value >= 0 && value < SHAPES.length;

  /**
   * Chọn ngẫu nhiên một hình khác hình đang vẽ (nếu có). Không lặp thử: bốc trong các hình còn lại,
   * nên rng kém cũng không làm treo.
   */
  function pickShape(rng = Math.random, currentIndex = -1) {
    const pick = (count) => Math.min(count - 1, Math.max(0, Math.floor(rng() * count)));
    if (!isShapeIndex(currentIndex) || SHAPES.length < 2) return pick(SHAPES.length);
    const index = pick(SHAPES.length - 1);
    return index >= currentIndex ? index + 1 : index;
  }

  const update = (state, changes) => Object.freeze({ ...state, ...changes });

  function createGame(shapeIndex = 0) {
    if (!isShapeIndex(shapeIndex)) throw new RangeError(`Hình ${shapeIndex} không tồn tại`);
    return Object.freeze({
      shapeIndex,
      position: 0,
      wrong: 0,
      seconds: 0,
      started: false,
      finished: false
    });
  }

  const shapeOf = (state) => SHAPES[state.shapeIndex];
  const dotCount = (state) => shapeOf(state).points.length;

  /**
   * Bé chạm chấm thứ `index` (đếm từ 0). Trả về { state, event, startedNow }:
   * event là 'ignored' | 'wrong' | 'correct' | 'completed'.
   * Giữ hành vi cũ: đồng hồ bắt đầu từ lần chạm đầu, kể cả chạm nhầm; chạm nhầm chỉ đếm, không phạt.
   */
  function tap(state, index) {
    const valid = Number.isInteger(index) && index >= 0 && index < dotCount(state);
    if (!valid || state.finished) return { state, event: 'ignored', startedNow: false };
    const startedNow = !state.started;
    const base = startedNow ? update(state, { started: true }) : state;
    if (index !== base.position) return { state: update(base, { wrong: base.wrong + 1 }), event: 'wrong', startedNow };
    const position = base.position + 1;
    const finished = position === dotCount(base);
    return { state: update(base, { position, finished }), event: finished ? 'completed' : 'correct', startedNow };
  }

  /**
   * Chấm thật sự được chạm. Vài hình có hai chấm gần như trùng nhau (thuyền buồm: chấm 1 và chấm 4
   * cách nhau 8 đơn vị), chấm vẽ sau đè lên chấm trước nên bé chạm số 1 lại thành chạm nhầm số 4.
   * Nếu điểm chạm `point` ({ x, y } theo tọa độ khung 400x400) nằm trong vùng chạm `radius` của chấm
   * cần nối tiếp thì tính là chạm chấm đó. Không có tọa độ (bàn phím) thì giữ nguyên chấm đã chọn.
   */
  function resolveTap(state, index, point, radius) {
    const next = state.position;
    if (state.finished || index === next || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return index;
    const [x, y] = shapeOf(state).points[next];
    return Math.hypot(point.x - x, point.y - y) <= radius ? next : index;
  }

  /** Một giây trôi qua: đồng hồ chỉ chạy sau lần chạm đầu và trước khi nối xong. */
  function tick(state) {
    return state.started && !state.finished ? update(state, { seconds: state.seconds + 1 }) : state;
  }

  /** Các chấm đã nối, theo thứ tự (để vẽ đường nối). */
  const connectedPoints = (state) => shapeOf(state).points.slice(0, state.position);
  /** Số lượt cho thống kê: giữ công thức cũ (chấm đã nối + lần chạm nhầm). */
  const moves = (state) => state.position + state.wrong;
  const canSave = (state) => !state.finished;

  /**
   * Bản lưu: giữ đúng định dạng của adapter games5-7-autosave trước khi tách engine,
   * để ván đang chơi dở trên máy của bé vẫn khôi phục được sau khi cập nhật.
   */
  function serialize(state, sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      shapeIndex: state.shapeIndex,
      position: state.position,
      wrong: state.wrong,
      seconds: state.seconds,
      started: state.started
    };
  }

  /** Trạng thái từ bản lưu, hoặc null nếu bản lưu không hợp lệ (khi đó bé bắt đầu hình mới). */
  function restore(saved) {
    if (!saved || typeof saved !== 'object' || !isShapeIndex(saved.shapeIndex)) return null;
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    const last = SHAPES[saved.shapeIndex].points.length - 1;
    return Object.freeze({
      shapeIndex: saved.shapeIndex,
      // Như adapter cũ: vị trí giới hạn tới chấm cuối, vì ván đã nối xong thì không còn bản lưu.
      position: Math.min(last, count(saved.position)),
      wrong: count(saved.wrong),
      seconds: count(saved.seconds),
      started: Boolean(saved.started),
      finished: false
    });
  }

  return Object.freeze({
    SHAPES,
    pickShape,
    createGame,
    shapeOf,
    dotCount,
    tap,
    resolveTap,
    tick,
    connectedPoints,
    moves,
    canSave,
    serialize,
    restore
  });
});
