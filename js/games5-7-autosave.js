(() => {
  'use strict';

  function resolveGameId(pathname, routes) {
    const path = typeof pathname === 'string' ? pathname : '';
    const sharedGameId = routes?.getGameId?.(path);
    if (Number.isInteger(sharedGameId) && sharedGameId >= 5 && sharedGameId <= 7) {
      return `game${sharedGameId}`;
    }
    const match = path.match(/\/(game[567])(?:\.html)?\/?$/);
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

  function startClock(updateDisplay) {
    clearInterval(dongHoChay);
    if (!daBatDau) return;
    dongHoChay = setInterval(() => {
      giay++;
      if (updateDisplay && typeof oDongHo !== 'undefined') oDongHo.textContent = dinhDangGio(giay);
    }, 1000);
  }

  function captureGame5() {
    return {
      schemaVersion: 1,
      sessionId,
      shapeIndex: KHO_HINH.indexOf(hinhHienTai),
      position: viTri,
      wrong: soSai,
      seconds: giay,
      started: daBatDau
    };
  }

  function restoreGame5(state) {
    if (!Number.isInteger(state.shapeIndex) || !KHO_HINH[state.shapeIndex]) return false;
    hinhHienTai = KHO_HINH[state.shapeIndex];
    veLai();
    viTri = Number.isFinite(state.position) ? Math.max(0, Math.min(hinhHienTai.diem.length - 1, state.position)) : 0;
    soSai = Number.isFinite(state.wrong) ? Math.max(0, state.wrong) : 0;
    giay = Number.isFinite(state.seconds) ? Math.max(0, state.seconds) : 0;
    daBatDau = Boolean(state.started);
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;

    const points = hinhHienTai.diem.slice(0, viTri).map((point) => point.join(','));
    duongNoi.setAttribute('points', points.join(' '));
    [...lopDiem.querySelectorAll('.diem')].forEach((dot, index) => {
      dot.classList.remove('xong', 'ke-tiep');
      if (index < viTri) dot.classList.add('xong');
      if (index === viTri) dot.classList.add('ke-tiep');
    });
    oKeTiep.textContent = String(viTri + 1);
    oDongHo.textContent = dinhDangGio(giay);
    startClock(true);
    return true;
  }

  // Game 6 đã tách engine (js/game6-engine.js, js/game6-ui.js): lưu/khôi phục qua window.BongGame6.
  function captureGame6() {
    return window.BongGame6.serialize(sessionId);
  }

  function restoreGame6(state) {
    if (!window.BongGame6.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  // Game 7 đã tách engine (js/game7-engine.js, js/game7-ui.js): lưu/khôi phục qua window.BongGame7.
  function captureGame7() {
    return window.BongGame7.serialize(sessionId);
  }

  function restoreGame7(state) {
    if (!window.BongGame7.restore(state)) return false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    return true;
  }

  const adapters = {
    game5: {
      capture: captureGame5,
      restore: restoreGame5,
      difficulty: 'connect-the-dots',
      moves: () => viTri + soSai,
      canSave: () => hinhHienTai && viTri < hinhHienTai.diem.length
    },
    game6: {
      capture: captureGame6,
      restore: restoreGame6,
      difficulty: '5-rounds',
      moves: () => window.BongGame6.moves(),
      seconds: () => window.BongGame6.seconds(),
      canSave: () => window.BongGame6.canSave()
    },
    game7: {
      capture: captureGame7,
      restore: restoreGame7,
      difficulty: '8-patterns',
      moves: () => window.BongGame7.moves(),
      seconds: () => window.BongGame7.seconds(),
      canSave: () => window.BongGame7.canSave()
    }
  };

  function init(modules) {
    const progress = modules?.progress;
    const adapter = adapters[gameId];
    // Hộp thoại thắng lấy theo id: Game 6 không còn biến toàn cục manThang.
    const winDialog = document.getElementById('manThang');
    if (!progress || !adapter || !winDialog) return;
    const seconds = adapter.seconds || (() => giay);

    const saved = progress.loadGame(gameId);
    if (saved?.state && adapter.restore(saved.state)) showStatus('↩️ Đã khôi phục ván đang chơi');

    function save() {
      if (winDialog.classList.contains('hien') || !adapter.canSave()) return;
      progress.saveGame(gameId, {
        status: 'in_progress',
        difficulty: adapter.difficulty,
        state: adapter.capture(),
        startedAt: saved?.startedAt || new Date().toISOString()
      });
    }

    function resetSession() {
      sessionId = createSessionId();
      setTimeout(save, 0);
    }

    ['nutHinhMoi', 'nutVanMoi', 'nutChoiLai'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', resetSession);
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
        metadata: { source: 'games5-7-autosave' }
      });
      if (!result.duplicate) showStatus('✅ Đã lưu lượt hoàn thành');
    });
    observer.observe(winDialog, { attributes: true, attributeFilter: ['class'] });

    window.BongGames57Autosave = Object.freeze({ gameId, save, capture: adapter.capture });
  }

  window.BongModulesReady
    .then(init)
    .catch((error) => console.error('[Bông Home] Autosave Game 5-7 không khởi động được', error));
})();
