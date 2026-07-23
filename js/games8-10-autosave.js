(() => {
  'use strict';

  const match = window.location.pathname.match(/\/(game(?:8|9|10))\.html$/);
  if (!match) return;

  const gameId = match[1];
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
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.hidden = true; }, 1800);
  }

  function captureGame8() {
    return {
      schemaVersion: 1,
      sessionId,
      size: N,
      maze: luoi.map((row) => row.map(({ tren, phai, duoi, trai }) => ({ tren, phai, duoi, trai }))),
      player: { x: beX, y: beY },
      path: duongDaDi.map(([x, y]) => [x, y]),
      steps: buoc,
      seconds: giay,
      started: daBatDau
    };
  }

  function restoreGame8(state) {
    const size = Number.isInteger(state.size) ? state.size : 0;
    const maze = Array.isArray(state.maze) ? state.maze : [];
    if (![8, 10, 12].includes(size) || maze.length !== size || maze.some((row) => !Array.isArray(row) || row.length !== size)) return false;

    clearInterval(dongHoChay);
    N = size;
    luoi = maze.map((row) => row.map((cell) => ({
      tren: Boolean(cell.tren), phai: Boolean(cell.phai), duoi: Boolean(cell.duoi), trai: Boolean(cell.trai), tham: true
    })));
    beX = Number.isInteger(state.player?.x) ? Math.max(0, Math.min(N - 1, state.player.x)) : 0;
    beY = Number.isInteger(state.player?.y) ? Math.max(0, Math.min(N - 1, state.player.y)) : 0;
    buoc = Number.isFinite(state.steps) ? Math.max(0, state.steps) : 0;
    giay = Number.isFinite(state.seconds) ? Math.max(0, state.seconds) : 0;
    daBatDau = Boolean(state.started);
    daThang = false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;
    duongDaDi.length = 0;
    const path = Array.isArray(state.path) ? state.path : [];
    path.forEach((point) => {
      if (Array.isArray(point) && Number.isInteger(point[0]) && Number.isInteger(point[1])) duongDaDi.push([point[0], point[1]]);
    });
    if (!duongDaDi.length) duongDaDi.push([0, 0]);

    document.querySelectorAll('#mucDo button').forEach((button) => {
      button.classList.toggle('dang-chon', Number(button.dataset.o) === N);
    });
    oBuoc.textContent = String(buoc);
    oDongHo.textContent = dinhDangGio(giay);
    const record = docKyLuc(N);
    oKyLuc.textContent = record ? dinhDangGio(record) : '--';
    manThang.classList.remove('hien');
    ve();
    if (daBatDau) {
      dongHoChay = setInterval(() => {
        giay++;
        oDongHo.textContent = dinhDangGio(giay);
      }, 1000);
    }
    return true;
  }

  function captureGame9() {
    return {
      schemaVersion: 1,
      sessionId,
      storyIndex: CAC_CHUYEN.indexOf(chuyen),
      wordIndex: i,
      caughtCurrent: daBat,
      correct: dung,
      missed: lo,
      wrong: nham,
      running: dangChay,
      readAloud: batLoaDoc
    };
  }

  function restoreGame9(state) {
    const storyIndex = Number.isInteger(state.storyIndex) ? state.storyIndex : -1;
    const story = CAC_CHUYEN[storyIndex];
    if (!story || !Number.isInteger(state.wordIndex) || state.wordIndex < 0 || state.wordIndex >= story.tu.length) return false;

    clearTimeout(hen);
    chuyen = story;
    i = state.wordIndex;
    daBat = Boolean(state.caughtCurrent);
    dung = Number.isFinite(state.correct) ? Math.max(0, state.correct) : 0;
    lo = Number.isFinite(state.missed) ? Math.max(0, state.missed) : 0;
    nham = Number.isFinite(state.wrong) ? Math.max(0, state.wrong) : 0;
    dangChay = Boolean(state.running);
    batLoaDoc = state.readAloud !== false;
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;

    oTuKhoa.textContent = chuyen.tuKhoa;
    oDung.textContent = String(dung);
    oLo.textContent = String(lo);
    oNham.textContent = String(nham);
    vachTien.style.width = `${((i + 1) / chuyen.tu.length) * 100}%`;
    nutBat.disabled = !dangChay;
    manThang.classList.remove('hien');
    capNhatNutLoa();

    const word = chuyen.tu[i];
    const keyword = word === chuyen.tuKhoa;
    oChu.textContent = word;
    oChu.classList.toggle('la-tu-khoa', keyword);
    docTo(word);

    if (dangChay) {
      hen = setTimeout(() => {
        if (keyword && !daBat) {
          lo++;
          oLo.textContent = String(lo);
          amBoLo();
        }
        i++;
        hienTu();
      }, TOC_DO);
    }
    return true;
  }

  function captureGame10() {
    const elapsedMs = dangChay ? Math.max(0, performance.now() - batDauLuc) : 0;
    return {
      schemaVersion: 1,
      sessionId,
      stars: dsSao.map((star) => ({ luc: star.luc, xong: Boolean(star.xong), trung: Boolean(star.trung) })),
      elapsedMs,
      score: diem,
      streak: chuoi,
      longestStreak: chuoiDaiNhat,
      hits: trung,
      misses: truot,
      lastBeat: nhipCuoiKeu,
      running: dangChay
    };
  }

  function restoreGame10(state) {
    const stars = Array.isArray(state.stars) ? state.stars : [];
    if (stars.length !== TONG_SAO || stars.some((star) => !Number.isFinite(star.luc))) return false;

    cancelAnimationFrame(vongLap);
    dsSao = stars.map((star) => ({ luc: star.luc, xong: Boolean(star.xong), trung: Boolean(star.trung) }));
    diem = Number.isFinite(state.score) ? Math.max(0, state.score) : 0;
    chuoi = Number.isFinite(state.streak) ? Math.max(0, state.streak) : 0;
    chuoiDaiNhat = Number.isFinite(state.longestStreak) ? Math.max(0, state.longestStreak) : 0;
    trung = Number.isFinite(state.hits) ? Math.max(0, state.hits) : 0;
    truot = Number.isFinite(state.misses) ? Math.max(0, state.misses) : 0;
    nhipCuoiKeu = Number.isInteger(state.lastBeat) ? state.lastBeat : -1;
    nhayVach = 0;
    dangChay = Boolean(state.running);
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;

    oDiem.textContent = String(diem);
    oChuoi.textContent = String(chuoi);
    capNhatConLai();
    nutGo.disabled = !dangChay;
    manThang.classList.remove('hien');
    const elapsedMs = Number.isFinite(state.elapsedMs) ? Math.max(0, state.elapsedMs) : 0;
    batDauLuc = performance.now() - elapsedMs;
    if (dangChay) chay();
    else ve(elapsedMs);
    return true;
  }

  const adapters = {
    game8: {
      capture: captureGame8,
      restore: restoreGame8,
      difficulty: () => `${N}x${N}`,
      duration: () => giay,
      moves: () => buoc,
      canSave: () => !daThang && Array.isArray(luoi) && luoi.length === N
    },
    game9: {
      capture: captureGame9,
      restore: restoreGame9,
      difficulty: () => 'keyword-story',
      duration: () => Math.round((i * TOC_DO) / 1000),
      moves: () => dung + lo + nham,
      canSave: () => dangChay && Boolean(chuyen)
    },
    game10: {
      capture: captureGame10,
      restore: restoreGame10,
      difficulty: () => '24-stars',
      duration: () => Math.round(Math.max(0, performance.now() - batDauLuc) / 1000),
      moves: () => trung + truot,
      canSave: () => dangChay && dsSao.length === TONG_SAO
    }
  };

  function init(modules) {
    const progress = modules?.progress;
    const adapter = adapters[gameId];
    if (!progress || !adapter) return;

    const saved = progress.loadGame(gameId);
    if (saved?.state && adapter.restore(saved.state)) showStatus('↩️ Đã khôi phục ván đang chơi');

    function save() {
      if (manThang.classList.contains('hien') || !adapter.canSave()) return;
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
      if (!manThang.classList.contains('hien')) return;
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
    observer.observe(manThang, { attributes: true, attributeFilter: ['class'] });

    window.BongGames810Autosave = Object.freeze({ gameId, save, capture: adapter.capture });
  }

  window.BongModulesReady
    .then(init)
    .catch((error) => console.error('[Bông Home] Autosave Game 8-10 không khởi động được', error));
})();
