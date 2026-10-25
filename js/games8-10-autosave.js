(() => {
  'use strict';

  function resolveGameId(pathname, routes) {
    const path = typeof pathname === 'string' ? pathname : '';
    const sharedGameId = routes?.getGameId?.(path);
    if (Number.isInteger(sharedGameId) && sharedGameId >= 8 && sharedGameId <= 10) {
      return `game${sharedGameId}`;
    }
    const match = path.match(/\/(game(?:8|9|10))(?:\.html)?\/?$/);
    return match ? match[1] : null;
  }

  const gameId = resolveGameId(window.location?.pathname, window.BongRoutes);
  if (!gameId) return;

  const SAVE_INTERVAL_MS = 2000;
  let saveTimer = null;
  let statusTimer = null;
  let sessionId = createSessionId();

  function createSessionId() {
    return `${gameId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  function captureGame8() {
    return window.BongGame8.serialize(sessionId);
  }

  function restoreGame8(state) {
    if (!window.BongGame8.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  // Game 9 đã tách engine (js/game9-engine.js, js/game9-ui.js): lưu/khôi phục qua window.BongGame9.
  function captureGame9() {
    return window.BongGame9.serialize(sessionId);
  }

  function restoreGame9(state) {
    if (!window.BongGame9.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  // Game 10 đã tách engine (js/game10-engine.js, js/game10-ui.js): lưu/khôi phục qua window.BongGame10.
  function captureGame10() {
    return window.BongGame10.serialize(sessionId);
  }

  function restoreGame10(state) {
    if (!window.BongGame10.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  const adapters = {
    game8: {
      capture: captureGame8,
      restore: restoreGame8,
      difficulty: () => window.BongGame8.difficulty(),
      duration: () => window.BongGame8.seconds(),
      moves: () => window.BongGame8.moves(),
      canSave: () => window.BongGame8.canSave()
    },
    game9: {
      capture: captureGame9,
      restore: restoreGame9,
      difficulty: () => 'keyword-story',
      duration: () => window.BongGame9.seconds(),
      moves: () => window.BongGame9.moves(),
      canSave: () => window.BongGame9.canSave()
    },
    game10: {
      capture: captureGame10,
      restore: restoreGame10,
      difficulty: () => '24-stars',
      duration: () => window.BongGame10.seconds(),
      moves: () => window.BongGame10.moves(),
      canSave: () => window.BongGame10.canSave()
    }
  };

  function init(modules) {
    const progress = modules?.progress;
    const adapter = adapters[gameId];
    if (!progress || !adapter) return;

    // Lấy hộp thoại thắng theo id: Game 8 đã tách engine nên không còn biến toàn cục manThang.
    const winDialog = document.getElementById('manThang');
    const saved = progress.loadGame(gameId);
    if (saved?.state && adapter.restore(saved.state)) showStatus('↩️ Đã khôi phục ván đang chơi');

    function save() {
      if (winDialog.classList.contains('hien') || !adapter.canSave()) return;
      progress.saveGame(gameId, {
        status: 'in_progress',
        difficulty: adapter.difficulty(),
        state: adapter.capture(),
        startedAt: saved?.startedAt || new Date().toISOString()
      });
    }

    function resetSession() {
      sessionId = createSessionId();
      setTimeout(save, 0);
    }

    ['nutVanMoi', 'nutChoiLai', 'nutBatDau'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', resetSession);
    });
    document.getElementById('mucDo')?.addEventListener('click', resetSession);

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
        difficulty: adapter.difficulty(),
        durationSeconds: adapter.duration(),
        moves: adapter.moves(),
        metadata: { source: 'games8-10-autosave' }
      });
      if (!result.duplicate) showStatus('✅ Đã lưu lượt hoàn thành');
    });
    observer.observe(winDialog, { attributes: true, attributeFilter: ['class'] });

    window.BongGames810Autosave = Object.freeze({ gameId, save, capture: adapter.capture });
  }

  window.BongModulesReady
    .then(init)
    .catch((error) => console.error('[Bông Home] Autosave Game 8-10 không khởi động được', error));
})();
