(() => {
  'use strict';

  const core = window.BongAutosaveCore;
  const gameId = core?.resolveGameId(window.location?.pathname, window.BongRoutes, 5, 7);
  if (!gameId) return;

  function startClock(updateDisplay) {
    clearInterval(dongHoChay);
    if (!daBatDau) return;
    dongHoChay = setInterval(() => {
      giay++;
      if (updateDisplay && typeof oDongHo !== 'undefined') oDongHo.textContent = dinhDangGio(giay);
    }, 1000);
  }

  function captureGame5(sessionId) {
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

  function captureGame6(sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      round: vong,
      cells: [...luoi.children].map((cell) => cell.dataset.ma).filter(Boolean),
      selectedIndex: daChon ? [...luoi.children].indexOf(daChon) : -1,
      wrong: soSai,
      seconds: giay,
      started: daBatDau
    };
  }

  function restoreGame6(state) {
    const round = Number.isInteger(state.round) ? state.round : -1;
    const cells = Array.isArray(state.cells) ? state.cells : [];
    if (!CAC_VONG[round] || cells.length !== CAC_VONG[round].o) return false;
    if (cells.some((code) => !/^\d+-\d+$/.test(code))) return false;

    clearInterval(dongHoChay);
    vong = round;
    soSai = Number.isFinite(state.wrong) ? Math.max(0, state.wrong) : 0;
    giay = Number.isFinite(state.seconds) ? Math.max(0, state.seconds) : 0;
    daBatDau = Boolean(state.started);
    khoa = false;
    daChon = null;

    const config = CAC_VONG[vong];
    const width = Math.min(96, Math.floor(Math.min(innerWidth - 40, 720) / config.cot) - 10);
    luoi.innerHTML = '';
    luoi.style.gridTemplateColumns = `repeat(${config.cot}, ${width}px)`;
    cells.forEach((code, index) => {
      const [shape, color] = code.split('-').map(Number);
      if (!DUONG[shape] || !MAU[color]) return;
      const cell = document.createElement('div');
      cell.className = 'o-hinh';
      cell.dataset.ma = code;
      cell.style.height = `${width}px`;
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', 'Ô hình');
      cell.innerHTML = veHinh(shape, color);
      cell.addEventListener('click', () => chamVaoO(cell));
      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chamVaoO(cell);
        }
      });
      if (index === state.selectedIndex) {
        cell.classList.add('chon');
        daChon = cell;
      }
      luoi.appendChild(cell);
    });
    oVong.textContent = `${vong + 1}/5`;
    oDongHo.textContent = dinhDangGio(giay);
    thongBao.textContent = '';
    manThang.classList.remove('hien');
    startClock(true);
    return true;
  }

  function comboFromElement(element) {
    const path = element?.querySelector('path');
    if (!path) return null;
    const shape = DUONG.indexOf(path.getAttribute('d'));
    const fill = String(path.getAttribute('fill') || '').toLowerCase();
    const stroke = String(path.getAttribute('stroke') || '').toLowerCase();
    const color = MAU.findIndex((item) => item.c.toLowerCase() === fill && item.v.toLowerCase() === stroke);
    return shape >= 0 && color >= 0 ? { h: shape, m: color } : null;
  }

  function captureGame7(sessionId) {
    return {
      schemaVersion: 1,
      sessionId,
      question: cau,
      correct: dungNgay,
      sequence: [...oChuoi.querySelectorAll('.o-chuoi:not(.o-hoi)')].map(comboFromElement).filter(Boolean),
      answer: dapAn ? { h: dapAn.h, m: dapAn.m } : null,
      choices: [...oLuaChon.children].map(comboFromElement).filter(Boolean),
      seconds: giay,
      started: daBatDau
    };
  }

  function restoreGame7(state) {
    const question = Number.isInteger(state.question) ? state.question : -1;
    const sequence = Array.isArray(state.sequence) ? state.sequence : [];
    const choices = Array.isArray(state.choices) ? state.choices : [];
    const answer = state.answer;
    if (!CAC_QUY_LUAT[question] || !sequence.length || choices.length !== 4 || !answer) return false;

    clearInterval(dongHoChay);
    cau = question;
    dungNgay = Number.isFinite(state.correct) ? Math.max(0, Math.min(SO_CAU, state.correct)) : 0;
    giay = Number.isFinite(state.seconds) ? Math.max(0, state.seconds) : 0;
    daBatDau = Boolean(state.started);
    khoa = false;
    dapAn = { h: answer.h, m: answer.m };

    oChuoi.innerHTML = '';
    sequence.forEach((value) => {
      const item = document.createElement('div');
      item.className = 'o-chuoi';
      item.innerHTML = veHinh(value);
      oChuoi.appendChild(item);
    });
    const questionMark = document.createElement('div');
    questionMark.className = 'o-chuoi o-hoi';
    questionMark.id = 'oHoi';
    questionMark.textContent = '?';
    oChuoi.appendChild(questionMark);

    oLuaChon.innerHTML = '';
    choices.forEach((value) => {
      const button = document.createElement('div');
      button.className = 'nut-chon';
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');
      button.setAttribute('aria-label', 'Chọn hình này');
      button.innerHTML = veHinh(value);
      button.addEventListener('click', () => chon(value, button));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chon(value, button);
        }
      });
      oLuaChon.appendChild(button);
    });
    oSoCau.textContent = `${cau + 1}/${SO_CAU}`;
    oSoDung.textContent = String(dungNgay);
    thongBao.textContent = '';
    manThang.classList.remove('hien');
    startClock(false);
    return true;
  }

  const adapters = {
    game5: {
      capture: captureGame5,
      restore: restoreGame5,
      difficulty: () => 'connect-the-dots',
      duration: () => giay,
      moves: () => viTri + soSai,
      canSave: () => hinhHienTai && viTri < hinhHienTai.diem.length
    },
    game6: {
      capture: captureGame6,
      restore: restoreGame6,
      difficulty: () => '5-rounds',
      duration: () => giay,
      moves: () => vong + soSai,
      canSave: () => !khoa && vong < CAC_VONG.length
    },
    game7: {
      capture: captureGame7,
      restore: restoreGame7,
      difficulty: () => '8-patterns',
      duration: () => giay,
      moves: () => cau + 1,
      canSave: () => !khoa && Boolean(dapAn)
    }
  };

  window.BongModulesReady
    .then((modules) => core.start({
      gameId,
      source: 'games5-7-autosave',
      globalName: 'BongGames57Autosave',
      progress: modules?.progress,
      adapter: Object.assign({
        finishScreen: () => manThang,
        isFinished: () => manThang.classList.contains('hien')
      }, adapters[gameId]),
      resetSelectors: ['#nutHinhMoi', '#nutVanMoi', '#nutChoiLai']
    }))
    .catch((error) => console.error('[Bông Home] Autosave Game 5-7 không khởi động được', error));
})();
