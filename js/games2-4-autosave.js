(() => {
  'use strict';

  const core = window.BongAutosaveCore;
  const gameId = core?.resolveGameId(window.location?.pathname, window.BongRoutes, 2, 4);
  if (!gameId) return;

  function resetRewardSession() {
    const summary = document.querySelector('.man-thang .bh-reward-summary');
    if (!summary) return;
    summary.replaceChildren();
    summary.hidden = true;
  }

  function startClock() {
    clearInterval(dongHoChay);
    if (!daBatDau) return;
    dongHoChay = setInterval(() => {
      giay++;
      oDongHo.textContent = dinhDangGio(giay);
    }, 1000);
  }

  function captureGame2(sessionId) {
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

  function captureGame3(sessionId) {
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

  function captureGame4(sessionId) {
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
    game2: {
      capture: captureGame2,
      restore: restoreGame2,
      difficulty: () => '5-differences',
      duration: () => giay,
      moves: () => soChamSai + daTimThay.length,
      canSave: () => true
    },
    game3: {
      capture: captureGame3,
      restore: restoreGame3,
      difficulty: () => '6-shapes',
      duration: () => giay,
      moves: () => soSai + daGhep,
      canSave: () => true
    },
    game4: {
      capture: captureGame4,
      restore: restoreGame4,
      difficulty: () => '12-objects',
      duration: () => giay,
      moves: () => soSai + daGom,
      canSave: () => true
    }
  };

  window.BongModulesReady
    .then((modules) => core.start({
      gameId,
      source: 'games2-4-autosave',
      globalName: 'BongGamesAutosave',
      progress: modules?.progress,
      adapter: Object.assign({
        finishScreen: () => manThang,
        isFinished: () => manThang.classList.contains('hien')
      }, adapters[gameId]),
      resetSelectors: ['#nutVanMoi', '#nutChoiLai'],
      onSessionReset: resetRewardSession,
      restartTimerOnReset: true
    }))
    .catch((error) => console.error('[Bông Home] Autosave Game 2-4 không khởi động được', error));
})();
