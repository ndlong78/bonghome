/*
 * Game 6 – Tìm Cặp Sinh Đôi: giao diện. Dựng DOM, nhận chạm/bàn phím, âm thanh, pháo giấy,
 * kỷ lục; mọi luật chơi nằm trong js/game6-engine.js. Lưu ván do js/games5-7-autosave.js
 * đảm nhận qua window.BongGame6 (serialize/restore), không đọc biến toàn cục.
 */
(function () {
  'use strict';

  const engine = window.BongGame6Engine;
  if (!engine) return;

  /* ===== ÂM THANH WEB AUDIO API ===== */
  let boLoa = null;
  function batLoa() {
    if (window.BongSound && !window.BongSound.isEnabled()) return null;
    if (!boLoa) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) boLoa = new AudioCtor();
    }
    if (boLoa && boLoa.state === 'suspended') boLoa.resume();
    return boLoa;
  }
  // shared-ui.js dùng window.boLoa để mở lại âm thanh sau khi ứng dụng quay lại từ nền.
  Object.defineProperty(window, 'boLoa', { configurable: true, get: () => boLoa });

  function keoChuong(tanSo, doDai = 0.3, treTho = 0, amLuong = 0.16, dang = 'triangle') {
    const context = batLoa();
    if (!context) return;
    const batDau = context.currentTime + treTho;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = dang;
    oscillator.frequency.setValueAtTime(tanSo, batDau);
    gain.gain.setValueAtTime(0.0001, batDau);
    gain.gain.exponentialRampToValueAtTime(amLuong, batDau + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, batDau + doDai);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(batDau);
    oscillator.stop(batDau + doDai + 0.05);
  }
  const amChon = () => keoChuong(660, 0.1, 0, 0.1);
  const amDung = () => { keoChuong(784, 0.15, 0, 0.16); keoChuong(1046.5, 0.32, 0.1, 0.16); };
  const amSai = () => keoChuong(196, 0.26, 0, 0.11, 'sine');
  const amQuaVong = () => [659.25, 783.99, 1046.5].forEach((note, index) => keoChuong(note, 0.3, index * 0.12, 0.16));
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((note, index) => keoChuong(note, 0.45, index * 0.16, 0.18));

  /* ===== 8 KIỂU HÌNH × 6 MÀU, vẽ bằng SVG ===== */
  const MAU = [
    { c: '#FFB7C5', v: '#E9799C' }, { c: '#FFE0A3', v: '#E0A94F' }, { c: '#A8E6CF', v: '#7FCFB0' },
    { c: '#C9B6F5', v: '#9B85D6' }, { c: '#BFE3FF', v: '#7FB6E8' }, { c: '#FFCBA4', v: '#D99A6C' }
  ];
  const DUONG = [
    'M50 8 L61 38 L93 41 L68 61 L76 93 L50 75 L24 93 L32 61 L7 41 L39 38 Z', /* ngôi sao */
    'M50 90 C12 66 14 30 33 24 C43 21 50 30 50 38 C50 30 57 21 67 24 C86 30 88 66 50 90 Z', /* trái tim */
    'M10 78 L16 26 L34 46 L50 16 L66 46 L84 26 L90 78 Z', /* vương miện */
    'M50 6 C86 22 90 66 50 94 C10 66 14 22 50 6 Z', /* chiếc lá */
    'M50 8 L94 46 L82 46 L82 92 L18 92 L18 46 L6 46 Z', /* ngôi nhà */
    'M20 80 L50 18 L80 80 Z', /* tam giác */
    'M8 50 A42 34 0 0 1 92 50 L64 50 L64 82 A8 8 0 0 1 36 82 L36 50 Z', /* cây nấm */
    'M62 8 A44 44 0 1 0 62 92 A36 36 0 1 1 62 8 Z' /* trăng lưỡi liềm */
  ];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function veHinh(code) {
    const { shape, color } = engine.parseCode(code);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', DUONG[shape]);
    path.setAttribute('fill', MAU[color].c);
    path.setAttribute('stroke', MAU[color].v);
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  const $ = (id) => document.getElementById(id);
  const luoi = $('luoi');
  const thongBao = $('thongBao');
  const oVong = $('soVong');
  const oDongHo = $('dongHo');
  const oKyLuc = $('kyLuc');
  const manThang = $('manThang');
  if (!luoi || !thongBao || !oVong || !oDongHo || !oKyLuc || !manThang) return;

  let state = engine.createGame();
  let dongHoChay = null;
  let roundTimer = null;

  /* ===== KỶ LỤC ===== */
  let kyLucTam = null;
  const docKyLuc = () => {
    try {
      const value = localStorage.getItem('kyluc_game6');
      return value ? parseInt(value, 10) : null;
    } catch (error) { return kyLucTam; }
  };
  const ghiKyLuc = (seconds) => {
    try { localStorage.setItem('kyluc_game6', seconds); } catch (error) { kyLucTam = seconds; }
  };
  const dinhDangGio = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  /* ===== ĐỒNG HỒ ===== */
  function dungDongHo() {
    clearInterval(dongHoChay);
    dongHoChay = null;
  }
  function chayDongHo() {
    dungDongHo();
    if (!state.started || state.finished) return;
    dongHoChay = setInterval(() => {
      state = engine.tick(state);
      oDongHo.textContent = dinhDangGio(state.seconds);
    }, 1000);
  }

  /* ===== DỰNG LƯỚI ===== */
  function capNhatCoO() {
    const config = engine.ROUNDS[state.round];
    if (!config) return;
    const rong = engine.cellSize(innerWidth, config.columns);
    luoi.style.gridTemplateColumns = `repeat(${config.columns}, ${rong}px)`;
    [...luoi.children].forEach((cell) => { cell.style.height = `${rong}px`; });
  }

  function dungLuoi() {
    luoi.replaceChildren(...state.cells.map((code, index) => {
      const cell = document.createElement('div');
      cell.className = `o-hinh${index === state.selectedIndex ? ' chon' : ''}`;
      cell.dataset.ma = code;
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', 'Ô hình');
      cell.appendChild(veHinh(code));
      cell.addEventListener('click', () => chamVaoO(index));
      /* Chọn ô bằng bàn phím: Enter hoặc phím cách */
      cell.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chamVaoO(index);
        }
      });
      return cell;
    }));
    capNhatCoO();
    oVong.textContent = `${state.round + 1}/${engine.ROUNDS.length}`;
    thongBao.textContent = '';
  }

  /* ===== BÉ CHẠM VÀO MỘT Ô ===== */
  function chamVaoO(index) {
    batLoa();
    const result = engine.select(state, index);
    if (result.event === 'ignored') return;
    state = result.state;
    if (result.startedNow) chayDongHo();
    const cells = luoi.children;

    if (result.event === 'deselected') {
      cells[index].classList.remove('chon');
    } else if (result.event === 'selected') {
      cells[index].classList.add('chon');
      amChon();
    } else if (result.event === 'match') {
      /* Đúng là cặp sinh đôi! */
      result.pair.forEach((cellIndex) => {
        cells[cellIndex].classList.remove('chon');
        cells[cellIndex].classList.add('dung');
      });
      amDung();
      thongBao.textContent = 'Đúng rồi! Hai bạn sinh đôi đây!';
      roundTimer = setTimeout(() => {
        state = engine.nextRound(state);
        if (state.finished) thangCuoc();
        else { amQuaVong(); dungLuoi(); }
      }, 1100);
    } else if (result.event === 'mismatch') {
      /* Hai hình khác nhau */
      amSai();
      const [first, second] = result.pair.map((cellIndex) => cells[cellIndex]);
      first.classList.remove('chon');
      first.classList.add('sai');
      second.classList.add('sai');
      setTimeout(() => { first.classList.remove('sai'); second.classList.remove('sai'); }, 420);
    }
  }

  /* ===== THẮNG CUỘC ===== */
  function thangCuoc() {
    dungDongHo();
    nhacThang();
    banPhaoGiay();
    $('tgCuoi').textContent = dinhDangGio(state.seconds);
    $('saiCuoi').textContent = String(state.wrong);
    const cu = docKyLuc();
    if (cu === null || state.seconds < cu) {
      ghiKyLuc(state.seconds);
      $('bangKyLuc').classList.add('hien');
      $('loiKhen').textContent = 'Bé tìm nhanh hơn lần trước rồi!';
    } else {
      $('loiKhen').textContent = 'Lần sau bé thử phá kỷ lục nhé!';
    }
    oKyLuc.textContent = dinhDangGio(docKyLuc());
    manThang.classList.add('hien');
  }

  /* ===== PHÁO GIẤY ===== */
  const canvas = $('phaoGiay');
  const ctx2d = canvas.getContext('2d');
  let hatGiay = [];
  let vongLap = null;
  const MAU_GIAY = ['#FFB7C5', '#C9B6F5', '#FFE0A3', '#A8E6CF', '#BFE3FF', '#FFCBA4'];
  function banPhaoGiay() {
    canvas.style.display = 'block';
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    hatGiay = Array.from({ length: 160 }, (_, index) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: 5 + Math.random() * 7,
      mau: MAU_GIAY[index % MAU_GIAY.length],
      rung: Math.random() * 6.28,
      toc: 1.6 + Math.random() * 2.6,
      xoay: (Math.random() - 0.5) * 0.2
    }));
    cancelAnimationFrame(vongLap);
    veGiay();
  }
  function veGiay() {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    hatGiay.forEach((hat) => {
      hat.y += hat.toc;
      hat.rung += hat.xoay;
      hat.x += Math.sin(hat.rung) * 1.4;
      if (hat.y > canvas.height + 20) { hat.y = -20; hat.x = Math.random() * canvas.width; }
      ctx2d.save();
      ctx2d.translate(hat.x, hat.y);
      ctx2d.rotate(hat.rung);
      ctx2d.fillStyle = hat.mau;
      ctx2d.fillRect(-hat.r / 2, -hat.r / 2, hat.r, hat.r * 1.5);
      ctx2d.restore();
    });
    vongLap = requestAnimationFrame(veGiay);
  }
  function dungPhaoGiay() {
    cancelAnimationFrame(vongLap);
    canvas.style.display = 'none';
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* ===== BẮT ĐẦU CẢ VÁN (5 vòng) ===== */
  function hienBang() {
    const kyLuc = docKyLuc();
    oKyLuc.textContent = kyLuc ? dinhDangGio(kyLuc) : '--';
    oDongHo.textContent = dinhDangGio(state.seconds);
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();
    dungLuoi();
  }

  function vanMoi() {
    clearTimeout(roundTimer);
    dungDongHo();
    state = engine.createGame();
    hienBang();
  }

  $('nutVanMoi').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  addEventListener('resize', () => {
    if (!manThang.classList.contains('hien') && luoi.children.length) capNhatCoO();
    if (canvas.style.display === 'block') { canvas.width = innerWidth; canvas.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* API cho lớp lưu ván (js/games5-7-autosave.js) và cho test. */
  window.BongGame6 = Object.freeze({
    serialize: (sessionId) => engine.serialize(state, sessionId),
    restore(saved) {
      const restored = engine.restore(saved);
      if (!restored) return false;
      clearTimeout(roundTimer);
      dungDongHo();
      state = restored;
      hienBang();
      chayDongHo();
      return true;
    },
    canSave: () => engine.canSave(state),
    moves: () => engine.moves(state),
    seconds: () => state.seconds,
    getState: () => state,
    newGame: vanMoi
  });

  vanMoi();
})();
