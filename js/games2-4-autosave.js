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

  function startClock() {
    clearInterval(dongHoChay);
    if (!daBatDau) return;
    dongHoChay = setInterval(() => {
      giay++;
      oDongHo.textContent = dinhDangGio(giay);
    }, 1000);
  }

  function captureGame2() {
    return {
      schemaVersion: 1,
      sessionId,
      differences: dsKhacBiet.map((item) => item.id),
      found: [...daTimThay],
      wrong: soChamSai,
      hintsLeft: luotGoiY,
      seconds: giay,
      started: daBatDau
    };
  }

  function restoreGame2(state) {
    const ids = Array.isArray(state.differences) ? state.differences : [];
    const restored = ids.map((id) => VAT_THE.find((item) => item.id === id)).filter(Boolean);
    if (restored.length !== SO_DIEM_KHAC) return false;

    clearInterval(dongHoChay);
    dsKhacBiet = restored;
    daTimThay = Array.isArray(state.found) ? state.found.filter((id) => ids.includes(id)) : [];
    soChamSai = Number.isFinite(state.wrong) ? Math.max(0, state.wrong) : 0;
    luotGoiY = Number.isFinite(state.hintsLeft) ? Math.max(0, Math.min(2, state.hintsLeft)) : 2;
    giay = Number.isFinite(state.seconds) ? Math.max(0, state.seconds) : 0;
    daBatDau = Boolean(state.started);
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;

    veTranh(tranhA, []);
    veTranh(tranhB, ids);
    daTimThay.forEach((id) => {
      const item = VAT_THE.find((entry) => entry.id === id);
      if (item) danhDauDung(item);
    });
    oTim.textContent = `${daTimThay.length}/${SO_DIEM_KHAC}`;
    oDongHo.textContent = dinhDangGio(giay);
    nutGoiY.textContent = luotGoiY > 0 ? `💡 Gợi ý (còn ${luotGoiY})` : '💡 Hết gợi ý';
    nutGoiY.disabled = luotGoiY === 0;
    manThang.classList.remove('hien');
    startClock();
    return true;
  }

  // Game 3 đã tách engine (js/game3-engine.js, js/game3-ui.js): lưu/khôi phục qua window.BongGame3.
  function captureGame3() {
    return window.BongGame3.serialize(sessionId);
  }

  function restoreGame3(state) {
    if (!window.BongGame3.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  // Game 4 đã tách engine (js/game4-engine.js, js/game4-ui.js): lưu/khôi phục qua window.BongGame4.
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
    game2: { capture: captureGame2, restore: restoreGame2, difficulty: '5-differences', moves: () => soChamSai + daTimThay.length },
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
    // Hộp thoại thắng lấy theo id: Game 3, 4 đã tách engine nên không còn biến toàn cục manThang.
    const winDialog = document.getElementById('manThang');
    if (!progress || !adapter || !winDialog) return;
    // Game đã tách engine tự báo thời gian và lúc được lưu; Game 2 vẫn đọc biến toàn cục giay.
    const seconds = adapter.seconds || (() => giay);
    const canSave = adapter.canSave || (() => true);

    const saved = progress.loadGame(gameId);
    if (saved?.state && adapter.restore(saved.state)) showStatus('↩️ Đã khôi phục ván đang chơi');

    function save() {
      if (winDialog.classList.contains('hien') || !canSave()) return;
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
        durationSeconds: seconds(),
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
