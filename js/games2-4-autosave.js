(() => {
  'use strict';

  const match = window.location.pathname.match(/\/(game[234])\.html$/);
  if (!match) return;

  const gameId = match[1];
  const SAVE_INTERVAL_MS = 2000;
  let saveTimer = null;
  let statusTimer = null;
  let sessionId = `${gameId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

  function captureGame3() {
    return {
      schemaVersion: 1,
      sessionId,
      colorOrder: [...khay.children].map((item) => item.dataset.id).filter(Boolean),
      shadowOrder: [...hangBong.children].map((item) => item.dataset.id).filter(Boolean),
      matched: [...hangBong.querySelectorAll('.o-bong.dung')].map((item) => item.dataset.id),
      wrong: soSai,
      seconds: giay,
      started: daBatDau
    };
  }

  function restoreGame3(state) {
    const colors = Array.isArray(state.colorOrder) ? state.colorOrder : [];
    const shadows = Array.isArray(state.shadowOrder) ? state.shadowOrder : [];
    if (colors.length !== SO_HINH || shadows.length !== SO_HINH) return false;
    const matched = new Set(Array.isArray(state.matched) ? state.matched : []);
    if ([...colors, ...shadows].some((id) => !KHO_HINH.some((item) => item.id === id))) return false;

    clearInterval(dongHoChay);
    khay.innerHTML = '';
    hangBong.innerHTML = '';
    soSai = Number.isFinite(state.wrong) ? Math.max(0, state.wrong) : 0;
    giay = Number.isFinite(state.seconds) ? Math.max(0, state.seconds) : 0;
    daBatDau = Boolean(state.started);
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;

    colors.forEach((id) => {
      const shape = KHO_HINH.find((item) => item.id === id);
      const piece = document.createElement('div');
      piece.className = `mieng-hinh${matched.has(id) ? ' xong' : ''}`;
      piece.dataset.id = id;
      piece.setAttribute('aria-label', `Hình ${shape.ten}`);
      piece.innerHTML = veMau(shape);
      ganKeoTha(piece);
      khay.appendChild(piece);
    });
    shadows.forEach((id) => {
      const shape = KHO_HINH.find((item) => item.id === id);
      const target = document.createElement('div');
      target.className = `o-bong${matched.has(id) ? ' dung' : ''}`;
      target.dataset.id = id;
      target.innerHTML = matched.has(id) ? veMau(shape) : veBong(shape);
      hangBong.appendChild(target);
    });
    daGhep = matched.size;
    oDung.textContent = `${daGhep}/${SO_HINH}`;
    oDongHo.textContent = dinhDangGio(giay);
    manThang.classList.remove('hien');
    startClock();
    return true;
  }

  function captureGame4() {
    return {
      schemaVersion: 1,
      sessionId,
      objects: [...sanDo.querySelectorAll('.do-vat')].map((item) => ({
        color: item.dataset.mau,
        html: item.innerHTML,
        done: item.classList.contains('xong')
      })),
      basketCounts: { ...demTheoGio },
      collected: daGom,
      wrong: soSai,
      seconds: giay,
      started: daBatDau
    };
  }

  function restoreGame4(state) {
    const objects = Array.isArray(state.objects) ? state.objects : [];
    if (objects.length !== TONG_DO || objects.some((item) => !MAU.some((color) => color.id === item.color))) return false;

    clearInterval(dongHoChay);
    sanDo.innerHTML = '';
    hangGio.innerHTML = '';
    daGom = Number.isFinite(state.collected) ? Math.max(0, Math.min(TONG_DO, state.collected)) : 0;
    soSai = Number.isFinite(state.wrong) ? Math.max(0, state.wrong) : 0;
    giay = Number.isFinite(state.seconds) ? Math.max(0, state.seconds) : 0;
    daBatDau = Boolean(state.started);
    sessionId = typeof state.sessionId === 'string' ? state.sessionId : sessionId;

    MAU.forEach((color) => {
      demTheoGio[color.id] = Number(state.basketCounts?.[color.id]) || 0;
      const basket = document.createElement('div');
      basket.className = 'gio';
      basket.dataset.mau = color.id;
      basket.style.setProperty('--mau', color.chinh);
      basket.innerHTML = veGio(color) + `<span class="ten-gio">Giỏ ${color.ten}</span><span class="dem" id="dem-${color.id}">${demTheoGio[color.id]}</span>`;
      hangGio.appendChild(basket);
    });
    objects.forEach((saved) => {
      const item = document.createElement('div');
      item.className = `do-vat${saved.done ? ' xong' : ''}`;
      item.dataset.mau = saved.color;
      item.innerHTML = saved.html;
      ganKeoTha(item);
      sanDo.appendChild(item);
    });
    oGom.textContent = `${daGom}/${TONG_DO}`;
    oDongHo.textContent = dinhDangGio(giay);
    manThang.classList.remove('hien');
    startClock();
    return true;
  }

  const adapters = {
    game2: { capture: captureGame2, restore: restoreGame2, difficulty: '5-differences', moves: () => soChamSai + daTimThay.length },
    game3: { capture: captureGame3, restore: restoreGame3, difficulty: '6-shapes', moves: () => soSai + daGhep },
    game4: { capture: captureGame4, restore: restoreGame4, difficulty: '12-objects', moves: () => soSai + daGom }
  };

  function init(modules) {
    const progress = modules?.progress;
    const adapter = adapters[gameId];
    if (!progress || !adapter) return;

    const saved = progress.loadGame(gameId);
    if (saved?.state && adapter.restore(saved.state)) showStatus('↩️ Đã khôi phục ván đang chơi');

    function save() {
      if (manThang.classList.contains('hien')) return;
      const state = adapter.capture();
      progress.saveGame(gameId, {
        status: 'in_progress',
        difficulty: adapter.difficulty,
        state,
        startedAt: saved?.startedAt || new Date().toISOString()
      });
    }

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
        difficulty: adapter.difficulty,
        durationSeconds: giay,
        moves: adapter.moves(),
        metadata: { source: 'games2-4-autosave' }
      });
      if (!result.duplicate) showStatus('✅ Đã lưu lượt hoàn thành');
    });
    observer.observe(manThang, { attributes: true, attributeFilter: ['class'] });

    window.BongGamesAutosave = Object.freeze({ gameId, save, capture: adapter.capture });
  }

  window.BongModulesReady
    .then(init)
    .catch((error) => console.error('[Bông Home] Autosave Game 2-4 không khởi động được', error));
})();
