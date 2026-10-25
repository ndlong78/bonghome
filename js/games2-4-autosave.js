(() => {
  'use strict';

  function resolveGameId(pathname, routes) {
    const path = typeof pathname === 'string' ? pathname : '';
    const sharedGameId = routes?.getGameId?.(path);
    if (Number.isInteger(sharedGameId) && sharedGameId >= 2 && sharedGameId <= 4) {
      return `game${sharedGameId}`;
    }
    const match = path.match(/\/(game[234])(?:\.html)?\/?$/);
    return match ? match[1] : null;
  }

  const gameId = resolveGameId(window.location?.pathname, window.BongRoutes);
  if (!gameId) return;

  const SAVE_INTERVAL_MS = 2000;
  let saveTimer = null;
  let statusTimer = null;

  function createSessionId() {
    return `${gameId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  let sessionId = createSessionId();

  function resetRewardSession() {
    sessionId = createSessionId();
    const summary = document.querySelector('.man-thang .bh-reward-summary');
    if (!summary) return;
    summary.replaceChildren();
    summary.hidden = true;
  }

  function showStatus(message) {
    let status = document.getElementById('bhGameAutosaveStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'bhGameAutosaveStatus';
      status.className = 'bh-game-autosave-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.hidden = true; }, 1800);
  }

  // Game 2–4 đã tách engine (js/gameN-engine.js, js/gameN-ui.js): lưu/khôi phục qua window.BongGameN.
  function captureGame2() {
    return window.BongGame2.serialize(sessionId);
  }

  function restoreGame2(state) {
    if (!window.BongGame2.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  function captureGame3() {
    return window.BongGame3.serialize(sessionId);
  }

  function restoreGame3(state) {
    if (!window.BongGame3.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  // Bản lưu rất cũ chỉ có HTML được nhận lại trong BongGame4.restore (so với mẫu có sẵn, không chèn HTML lạ).
  function captureGame4() {
    return window.BongGame4.serialize(sessionId);
  }

  function restoreGame4(state) {
    if (!window.BongGame4.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  const adapters = {
    game2: {
      capture: captureGame2,
      restore: restoreGame2,
      difficulty: '5-differences',
      moves: () => window.BongGame2.moves(),
      seconds: () => window.BongGame2.seconds(),
      canSave: () => window.BongGame2.canSave()
    },
    game3: {
      capture: captureGame3,
      restore: restoreGame3,
      difficulty: '6-shapes',
      moves: () => window.BongGame3.moves(),
      seconds: () => window.BongGame3.seconds(),
      canSave: () => window.BongGame3.canSave()
    },
    game4: {
      capture: captureGame4,
      restore: restoreGame4,
      difficulty: '12-objects',
      moves: () => window.BongGame4.moves(),
      seconds: () => window.BongGame4.seconds(),
      canSave: () => window.BongGame4.canSave()
    }
  };

  function init(modules) {
    const progress = modules?.progress;
    const adapter = adapters[gameId];
    // Hộp thoại thắng lấy theo id: các game 2–4 không còn biến toàn cục manThang.
    const winDialog = document.getElementById('manThang');
    if (!progress || !adapter || !winDialog) return;

    const saved = progress.loadGame(gameId);
    if (saved?.state && adapter.restore(saved.state)) showStatus('↩️ Đã khôi phục ván đang chơi');

    function save() {
      if (winDialog.classList.contains('hien') || !adapter.canSave()) return;
      const state = adapter.capture();
      progress.saveGame(gameId, {
        status: 'in_progress',
        difficulty: adapter.difficulty,
        state,
        startedAt: saved?.startedAt || new Date().toISOString()
      });
    }

    document.querySelectorAll('#nutVanMoi, #nutChoiLai').forEach((button) => {
      button.addEventListener('click', () => {
        queueMicrotask(() => {
          resetRewardSession();
          clearInterval(saveTimer);
          save();
          saveTimer = setInterval(save, SAVE_INTERVAL_MS);
        });
      });
    });

    saveTimer = setInterval(save, SAVE_INTERVAL_MS);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });

    const observer = new MutationObserver(() => {
      if (!winDialog.classList.contains('hien')) return;
      clearInterval(saveTimer);
      const result = progress.completeGame(gameId, {
        transactionId: `${gameId}-finish-${sessionId}`,
        difficulty: adapter.difficulty,
        durationSeconds: adapter.seconds(),
        moves: adapter.moves(),
        metadata: { source: 'games2-4-autosave' }
      });
      if (!result.duplicate) showStatus('✅ Đã lưu lượt hoàn thành');
    });
    observer.observe(winDialog, { attributes: true, attributeFilter: ['class'] });

    window.BongGamesAutosave = Object.freeze({ gameId, save, capture: adapter.capture });
  }

  window.BongModulesReady
    .then(init)
    .catch((error) => console.error('[Bông Home] Autosave Game 2-4 không khởi động được', error));
})();
