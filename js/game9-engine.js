/*
 * Game 9 – Nghe Truyện Tìm Từ: logic thuần, không đụng DOM.
 * Câu chuyện hiện từng từ một; bé bấm nút mỗi khi thấy từ khoá. Giao diện (hẹn giờ, đọc to, âm thanh)
 * ở js/game9-ui.js. Mọi hàm trả về trạng thái mới, không sửa trạng thái cũ.
 */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BongGame9Engine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function createGame9Engine() {
  'use strict';

  /** 3 câu chuyện ngắn, mỗi chuyện có một từ khoá. Bản lưu ghi chỉ số chuyện và chỉ số từ nên không được đổi thứ tự. */
  const STORIES = Object.freeze([
    { keyword: 'THỎ',
      words: ['Sáng', 'nay', 'bạn', 'THỎ', 'dậy', 'thật', 'sớm', 'THỎ', 'rửa', 'mặt', 'rồi', 'ăn', 'cà', 'rốt',
        'Bạn', 'gấu', 'rủ', 'THỎ', 'ra', 'vườn', 'hái', 'hoa', 'Trên', 'đường', 'đi', 'THỎ', 'gặp', 'bạn', 'sóc',
        'Sóc', 'tặng', 'THỎ', 'một', 'hạt', 'dẻ', 'to', 'THỎ', 'nói', 'cảm', 'ơn', 'rất', 'lễ', 'phép',
        'Cả', 'hai', 'cùng', 'cười', 'vui', 'vẻ'] },
    { keyword: 'HOA',
      words: ['Trong', 'vườn', 'có', 'rất', 'nhiều', 'HOA', 'đẹp', 'HOA', 'hồng', 'toả', 'hương', 'thơm', 'ngát',
        'Bướm', 'bay', 'tới', 'đậu', 'lên', 'cánh', 'HOA', 'Ong', 'cũng', 'tìm', 'mật', 'trong', 'HOA',
        'Bé', 'tưới', 'nước', 'cho', 'HOA', 'mỗi', 'sáng', 'Nhờ', 'vậy', 'HOA', 'nở', 'thật', 'tươi',
        'Mẹ', 'khen', 'bé', 'chăm', 'chỉ', 'lắm'] },
    { keyword: 'TRĂNG',
      words: ['Buổi', 'tối', 'TRĂNG', 'lên', 'cao', 'TRĂNG', 'tròn', 'và', 'sáng', 'như', 'cái', 'đĩa',
        'Bé', 'ngồi', 'sân', 'ngắm', 'TRĂNG', 'cùng', 'bà', 'Bà', 'kể', 'chuyện', 'chị', 'Hằng', 'trên', 'TRĂNG',
        'Mây', 'trôi', 'che', 'mất', 'TRĂNG', 'một', 'lúc', 'Rồi', 'TRĂNG', 'lại', 'hiện', 'ra', 'tươi', 'cười',
        'Bé', 'ngủ', 'ngon', 'dưới', 'ánh', 'TRĂNG'] }
  ].map((story) => Object.freeze({ keyword: story.keyword, words: Object.freeze(story.words.slice()) })));

  /** Mỗi từ hiện ra trong 1,15 giây; trước từ đầu tiên có 0,9 giây "Chuẩn bị…". */
  const WORD_MS = 1150;
  const READY_MS = 900;

  const update = (state, changes) => Object.freeze({ ...state, ...changes });
  const storyOf = (state) => STORIES[state.storyIndex];
  const keywordCount = (story, upTo = story.words.length) => story.words.slice(0, upTo).filter((word) => word === story.keyword).length;
  const isStory = (value) => Number.isInteger(value) && value >= 0 && value < STORIES.length;

  /** Bắt đầu một câu chuyện ngẫu nhiên. Từ đầu tiên chưa hiện (đang "Chuẩn bị…"). */
  function start(rng = Math.random) {
    return Object.freeze({
      storyIndex: Math.min(STORIES.length - 1, Math.max(0, Math.floor(rng() * STORIES.length))),
      index: 0,
      showing: false,
      caught: false,
      correct: 0,
      missed: 0,
      wrong: 0,
      running: true,
      finished: false
    });
  }

  /** Từ đang hiện, hoặc null khi đang "Chuẩn bị…" hay đã hết chuyện. */
  function currentWord(state) {
    if (!state.showing) return null;
    return storyOf(state).words[state.index] ?? null;
  }
  const isKeyword = (state) => currentWord(state) === storyOf(state).keyword;

  /** Hiện từ thứ `index`; nếu đã qua từ cuối thì kết thúc câu chuyện. Từ đang hiện thì giữ nguyên (không xoá lượt bấm). */
  function reveal(state) {
    if (!state.running || state.showing) return state;
    if (state.index >= storyOf(state).words.length) return update(state, { showing: false, running: false, finished: true });
    return update(state, { showing: true, caught: false });
  }

  /**
   * Hết thời gian của từ đang hiện: nếu là từ khoá mà bé chưa bấm thì tính bỏ lỡ; chuyển sang từ kế.
   * Trả về { state, missed }.
   */
  function expire(state) {
    if (!state.running || !state.showing) return { state, missed: false };
    const missed = isKeyword(state) && !state.caught;
    return {
      state: update(state, { index: state.index + 1, showing: false, caught: false, missed: state.missed + (missed ? 1 : 0) }),
      missed
    };
  }

  /**
   * Bé bấm nút "Bắt được từ khoá". Trả về { state, event }: event là 'ignored' | 'correct' | 'wrong'.
   * Mỗi từ chỉ tính một lần. Bấm lúc "Chuẩn bị…" (chưa có từ nào hiện) thì bỏ qua.
   */
  function tap(state) {
    if (!state.running || !state.showing || state.caught || currentWord(state) === null) return { state, event: 'ignored' };
    if (isKeyword(state)) return { state: update(state, { caught: true, correct: state.correct + 1 }), event: 'correct' };
    return { state: update(state, { caught: true, wrong: state.wrong + 1 }), event: 'wrong' };
  }

  /** Điểm cuối chuyện (giữ công thức cũ). */
  const score = (state) => Math.max(0, state.correct * 10 - state.wrong * 3 - state.missed * 2);
  const totalKeywords = (state) => keywordCount(storyOf(state));
  /** Số lượt cho thống kê: giữ công thức cũ (đúng + bỏ lỡ + nhầm). */
  const moves = (state) => state.correct + state.missed + state.wrong;
  /** Thời lượng cho thống kê: giữ công thức cũ (số từ đã qua × 1,15 giây). */
  const seconds = (state) => Math.round((state.index * WORD_MS) / 1000);
  const canSave = (state) => state.running;

  /**
   * Bản lưu: giữ đúng định dạng của adapter games8-10-autosave trước khi tách engine,
   * để câu chuyện đang nghe dở vẫn khôi phục được. `readAloud` là lựa chọn đọc to của giao diện.
   */
  function serialize(state, sessionId, readAloud) {
    return {
      schemaVersion: 1,
      sessionId,
      storyIndex: state.storyIndex,
      wordIndex: state.index,
      caughtCurrent: state.caught,
      correct: state.correct,
      missed: state.missed,
      wrong: state.wrong,
      running: state.running,
      readAloud
    };
  }

  /**
   * Trạng thái từ bản lưu: { state, readAloud }, hoặc null nếu bản lưu không hợp lệ (khi đó bé bắt đầu lại).
   * Như adapter cũ, từ đang lưu được hiện lại ngay. Số bắt đúng và bỏ lỡ không vượt số từ khoá đã hiện.
   */
  function restore(saved) {
    if (!saved || typeof saved !== 'object' || !isStory(saved.storyIndex)) return null;
    const story = STORIES[saved.storyIndex];
    const index = saved.wordIndex;
    if (!Number.isInteger(index) || index < 0 || index >= story.words.length) return null;
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
    const caught = saved.caughtCurrent === true;
    // Từ khoá đã hiện tới lúc lưu: các từ trước, cộng từ đang hiện nếu bé đã bấm trúng nó.
    const seen = keywordCount(story, index) + (caught && story.words[index] === story.keyword ? 1 : 0);
    const correct = Math.min(count(saved.correct), seen);
    const state = Object.freeze({
      storyIndex: saved.storyIndex,
      index,
      showing: true,
      caught,
      correct,
      missed: Math.min(count(saved.missed), keywordCount(story, index) - Math.min(correct, keywordCount(story, index))),
      wrong: count(saved.wrong),
      running: Boolean(saved.running),
      finished: false
    });
    return { state, readAloud: saved.readAloud !== false };
  }

  return Object.freeze({
    STORIES,
    WORD_MS,
    READY_MS,
    storyOf,
    start,
    currentWord,
    isKeyword,
    reveal,
    expire,
    tap,
    score,
    totalKeywords,
    moves,
    seconds,
    canSave,
    serialize,
    restore
  });
});
