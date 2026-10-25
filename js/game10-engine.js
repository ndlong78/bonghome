/*
 * Game 10 – Gõ Phím Theo Nhịp: logic thuần, không đụng DOM.
 * 24 ngôi sao rơi đúng nhịp; bé gõ khi sao chạm vạch. Mọi hàm nhận thời điểm `t` (mili giây kể từ lúc
 * bắt đầu bài) nên chấm điểm tất định, test được không cần đồng hồ thật. Giao diện ở js/game10-ui.js.
 * Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame10Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame10Engine() {
  'use strict';

  /** 800 ms một nhịp = 75 nhịp/phút, vừa sức bé 6 tuổi. */
  const BEAT_MS = 800;
  /** Ngôi sao rơi từ đỉnh xuống vạch mất 2 giây. */
  const FALL_MS = 2000;
  /** Cả bài có 24 ngôi sao. */
  const STAR_COUNT = 24;
  /** Nghỉ 1,5 giây trước khi ngôi sao đầu tiên xuất hiện. */
  const LEAD_IN_MS = 1500;
  /** Cửa sổ chấm điểm (mili giây lệch so với lúc sao chạm vạch). */
  const WINDOWS = Object.freeze({ perfect: 100, good: 190, ok: 300 });
  /** Điểm theo mức, cộng thêm thưởng chuỗi (tối đa 10 × 2). */
  const POINTS = Object.freeze({ perfect: 100, good: 60, ok: 30 });
  /** Từ ngôi sao thứ 11, mỗi nhịp có 22% bị bỏ trống để bé phải kìm tay lại. */
  const SKIP_FROM = 10;
  const SKIP_CHANCE = 0.22;
  /** Bài dài tối đa 72 nhịp: chỉ bỏ trống khi số nhịp còn lại vẫn đủ cho các sao còn thiếu, để rng kém không làm treo. */
  const MAX_BEATS = STAR_COUNT * 3;

  /** Thời điểm (ms) của 24 ngôi sao. */
  function createSong(rng = Math.random) {
    const times = [];
    for (let beat = 0; times.length < STAR_COUNT; beat += 1) {
      const roomToSkip = MAX_BEATS - beat - 1 >= STAR_COUNT - times.length;
      const skip = times.length >= SKIP_FROM && roomToSkip && rng() < SKIP_CHANCE;
      if (!skip) times.push(LEAD_IN_MS + beat * BEAT_MS);
    }
    return times;
  }

  const update = (state, changes) => Object.freeze({ ...state, ...changes });
  const freezeStars = (stars) => Object.freeze(stars.map((star) => Object.freeze({ time: star.time, done: star.done, hit: star.hit })));

  /** Trạng thái chờ trước khi bé bấm "Bắt đầu" (chưa có bài, chưa lưu được). */
  function idle() {
    return Object.freeze({
      stars: Object.freeze([]),
      score: 0,
      streak: 0,
      longestStreak: 0,
      lastBeat: -1,
      running: false,
      finished: false
    });
  }

  /** Bắt đầu một bài mới (t = 0 là lúc bấm "Bắt đầu"). */
  function start(rng = Math.random) {
    return update(idle(), {
      stars: freezeStars(createSong(rng).map((time) => ({ time, done: false, hit: false }))),
      running: true
    });
  }

  const hits = (state) => state.stars.filter((star) => star.hit).length;
  const misses = (state) => state.stars.filter((star) => star.done && !star.hit).length;
  const remaining = (state) => state.stars.filter((star) => !star.done).length;

  /**
   * Thời gian trôi tới `t`. Trả về { state, beat, missed, finished }:
   * `beat` = true khi sang nhịp mới (gõ trống nền), `missed` = số sao vừa trượt qua vạch mà bé chưa gõ.
   */
  function advance(state, t) {
    if (!state.running) return { state, beat: false, missed: 0, finished: false };
    let next = state;
    const currentBeat = Math.floor((t - LEAD_IN_MS) / BEAT_MS);
    const beat = currentBeat >= 0 && currentBeat !== state.lastBeat;
    if (beat) next = update(next, { lastBeat: currentBeat });

    let missed = 0;
    const stars = next.stars.map((star) => {
      if (star.done || t <= star.time + WINDOWS.ok) return star;
      missed += 1;
      return { ...star, done: true };
    });
    if (missed) next = update(next, { stars: freezeStars(stars), streak: 0 });

    const finished = next.stars.every((star) => star.done) && t > LEAD_IN_MS + 500;
    if (finished) next = update(next, { running: false, finished: true });
    return { state: next, beat, missed, finished };
  }

  /**
   * Bé gõ ở thời điểm `t`. Trả về { state, event, points }: event là 'ignored' (chưa chơi) |
   * 'early' (không có sao nào đủ gần, không trừ điểm) | 'perfect' | 'good' | 'ok'.
   * Giữ cách cũ: chọn sao chưa xử lý gần vạch nhất; hai sao cách đều thì lấy sao đứng trước.
   */
  function tap(state, t) {
    if (!state.running) return { state, event: 'ignored', points: 0 };
    let nearest = -1;
    let offset = Infinity;
    state.stars.forEach((star, index) => {
      if (star.done) return;
      const d = Math.abs(star.time - t);
      if (d < offset) { offset = d; nearest = index; }
    });
    if (nearest < 0 || offset > WINDOWS.ok) return { state, event: 'early', points: 0 };

    const event = offset <= WINDOWS.perfect ? 'perfect' : offset <= WINDOWS.good ? 'good' : 'ok';
    const streak = state.streak + 1;
    const points = POINTS[event] + Math.min(streak, 10) * 2;
    const stars = state.stars.map((star, index) => (index === nearest ? { ...star, done: true, hit: true } : star));
    return {
      state: update(state, {
        stars: freezeStars(stars),
        score: state.score + points,
        streak,
        longestStreak: Math.max(state.longestStreak, streak)
      }),
      event,
      points
    };
  }

  /** Số lượt cho thống kê: giữ công thức cũ (trúng + trượt). */
  const moves = (state) => hits(state) + misses(state);
  /** Lưu được khi bài đang chạy (như adapter cũ). */
  const canSave = (state) => state.running && state.stars.length === STAR_COUNT;

  /**
   * Bản lưu: giữ đúng định dạng của adapter games8-10-autosave trước khi tách engine
   * (`elapsedMs` là thời gian đã chơi, do giao diện đo), để ván dở trên máy của bé vẫn khôi phục được.
   */
  function serialize(state, sessionId, elapsedMs) {
    return {
      schemaVersion: 1,
      sessionId,
      stars: state.stars.map((star) => ({ luc: star.time, xong: star.done, trung: star.hit })),
      elapsedMs: state.running ? Math.max(0, elapsedMs) : 0,
      score: state.score,
      streak: state.streak,
      longestStreak: state.longestStreak,
      hits: hits(state),
      misses: misses(state),
      lastBeat: state.lastBeat,
      running: state.running
    };
  }

  /**
   * Trạng thái từ bản lưu: { state, elapsedMs }, hoặc null nếu bản lưu không hợp lệ (khi đó bé bắt đầu lại).
   * Số trúng/trượt tính lại từ các ngôi sao, không tin trường `hits`/`misses` đã lưu.
   */
  function restore(saved) {
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.stars) || saved.stars.length !== STAR_COUNT) return null;
    const stars = [];
    for (const star of saved.stars) {
      if (!star || typeof star !== 'object' || !Number.isFinite(star.luc) || star.luc < 0) return null;
      const hit = star.trung === true;
      stars.push({ time: star.luc, done: hit || star.xong === true, hit });
    }
    // Đã xử lý hết các sao mà vẫn còn bản lưu (lưu đúng lúc kết thúc): coi như bài đã xong, bé chơi lại.
    if (stars.every((star) => star.done)) return null;
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    const streak = count(saved.streak);
    const state = Object.freeze({
      stars: freezeStars(stars),
      score: count(saved.score),
      streak,
      longestStreak: Math.max(streak, count(saved.longestStreak)),
      lastBeat: Number.isInteger(saved.lastBeat) && saved.lastBeat >= -1 ? saved.lastBeat : -1,
      running: Boolean(saved.running),
      finished: false
    });
    return { state, elapsedMs: Number.isFinite(saved.elapsedMs) ? Math.max(0, saved.elapsedMs) : 0 };
  }

  return Object.freeze({
    BEAT_MS,
    FALL_MS,
    STAR_COUNT,
    LEAD_IN_MS,
    WINDOWS,
    POINTS,
    MAX_BEATS,
    createSong,
    idle,
    start,
    hits,
    misses,
    remaining,
    advance,
    tap,
    moves,
    canSave,
    serialize,
    restore
  });
});
