(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root) root.BongAutosaveCore = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function createAutosaveCore(root) {
  'use strict';

  const SAVE_INTERVAL_MS = 2000;
  const STATUS_ID = 'bhGameAutosaveStatus';
  const STATUS_HIDE_MS = 1800;

  /**
   * Nhận dạng trang game trong một khoảng. Ưu tiên BongRoutes; regex chỉ là bản
   * dự phòng cho lúc js/routes.js chưa kịp tải, và phải chấp nhận cả URL không
   * có đuôi .html lẫn URL kết thúc bằng dấu gạch chéo.
   */
  function resolveGameId(pathname, routes, minGameId, maxGameId) {
    const path = typeof pathname === 'string' ? pathname : '';
    const sharedGameId = routes?.getGameId?.(path);
    if (Number.isInteger(sharedGameId) && sharedGameId >= minGameId && sharedGameId <= maxGameId) {
      return `game${sharedGameId}`;
    }
    const match = path.match(/\/game(\d+)(?:\.html)?\/?$/);
    const fallbackId = match ? Number(match[1]) : null;
    return fallbackId !== null && fallbackId >= minGameId && fallbackId <= maxGameId
      ? `game${fallbackId}`
      : null;
  }

  function createSessionId(gameId) {
    return `${gameId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Vùng thông báo cho trình đọc màn hình. Khai báo đủ role/aria-live/aria-atomic
   * ngay khi tạo, trước khi có nội dung, để thông báo không bị bỏ sót.
   */
  function createStatusReporter(document) {
    let hideTimer = null;
    return function showStatus(message) {
      let status = document.getElementById(STATUS_ID);
      if (!status) {
        status = document.createElement('div');
        status.id = STATUS_ID;
        status.className = 'bh-game-autosave-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
        document.body.appendChild(status);
      }
      status.textContent = message;
      status.hidden = false;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { status.hidden = true; }, STATUS_HIDE_MS);
    };
  }

  /**
   * Khung autosave dùng chung cho Game 2-10.
   *
   * `adapter` là phần riêng của từng game và phải cung cấp:
   *   capture(sessionId)  -> đối tượng trạng thái, có kèm sessionId
   *   restore(state)      -> true nếu dựng lại được ván chơi
   *   finishScreen()      -> phần tử màn hình thắng để theo dõi
   *   isFinished()        -> ván đã kết thúc chưa
   *   difficulty()        -> nhãn mức độ
   *   duration()          -> số giây đã chơi
   *   moves()             -> số nước đã đi
   *   canSave()           -> có được phép lưu ở thời điểm này không
   */
  function start(options) {
    const {
      gameId,
      source,
      globalName,
      adapter,
      progress,
      document = root.document,
      resetSelectors = [],
      onSessionReset,
      restartTimerOnReset = false,
      saveIntervalMs = SAVE_INTERVAL_MS
    } = options;

    if (!gameId || !adapter || !progress) return null;

    const showStatus = createStatusReporter(document);
    const finishScreen = adapter.finishScreen();
    let sessionId = createSessionId(gameId);
    let saveTimer = null;
    let lastSavedState = null;

    const saved = progress.loadGame(gameId);
    if (saved?.state && adapter.restore(saved.state)) {
      // Giữ đúng phiên đã lưu để lượt hoàn thành không bị tính thành lượt mới.
      if (typeof saved.state.sessionId === 'string') sessionId = saved.state.sessionId;
      showStatus('↩️ Đã khôi phục ván đang chơi');
    }

    function save() {
      if (adapter.isFinished() || !adapter.canSave()) return;
      const state = adapter.capture(sessionId);
      // Ván chơi không đổi thì không ghi: trang mở sẵn mà bé chưa động vào
      // không có gì để lưu, và ghi localStorage là thao tác đồng bộ.
      const serialized = JSON.stringify(state);
      if (serialized === lastSavedState) return;
      progress.saveGame(gameId, {
        status: 'in_progress',
        difficulty: adapter.difficulty(),
        state,
        startedAt: saved?.startedAt || new Date().toISOString()
      });
      lastSavedState = serialized;
    }

    function startTimer() {
      clearInterval(saveTimer);
      saveTimer = setInterval(save, saveIntervalMs);
    }

    function resetSession() {
      sessionId = createSessionId(gameId);
      lastSavedState = null;
      if (typeof onSessionReset === 'function') onSessionReset();
      if (restartTimerOnReset) {
        clearInterval(saveTimer);
        save();
        startTimer();
      } else {
        setTimeout(save, 0);
      }
    }

    resetSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.addEventListener('click', () => queueMicrotask(resetSession));
      });
    });

    startTimer();
    root.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });

    const observer = new root.MutationObserver(() => {
      if (!adapter.isFinished()) return;
      clearInterval(saveTimer);
      const result = progress.completeGame(gameId, {
        transactionId: `${gameId}-finish-${sessionId}`,
        difficulty: adapter.difficulty(),
        durationSeconds: adapter.duration(),
        moves: adapter.moves(),
        metadata: { source }
      });
      if (!result.duplicate) showStatus('✅ Đã lưu lượt hoàn thành');
    });
    observer.observe(finishScreen, { attributes: true, attributeFilter: ['class'] });

    const api = Object.freeze({
      gameId,
      save,
      capture: () => adapter.capture(sessionId),
      sessionId: () => sessionId
    });
    root[globalName] = api;
    return api;
  }

  return Object.freeze({
    SAVE_INTERVAL_MS,
    STATUS_ID,
    resolveGameId,
    createSessionId,
    createStatusReporter,
    start
  });
});
