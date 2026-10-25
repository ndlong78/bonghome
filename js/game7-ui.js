/*
 * Game 7 – Đoán Hình Tiếp Theo: giao diện. Dựng DOM, nhận chạm/bàn phím, âm thanh, pháo giấy,
 * kỷ lục; mọi luật chơi nằm trong js/game7-engine.js. Lưu ván do js/games5-7-autosave.js
 * đảm nhận qua window.BongGame7 (serialize/restore), không đọc biến toàn cục.
 */
(function () {
  'use strict';

  const engine = window.BongGame7Engine;
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
  const amDung = () => { keoChuong(784, 0.15, 0, 0.16); keoChuong(1046.5, 0.32, 0.1, 0.16); };
  const amSai = () => keoChuong(196, 0.26, 0, 0.11, 'sine');
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((note, index) => keoChuong(note, 0.45, index * 0.16, 0.18));

  /* ===== KHO HÌNH: 8 kiểu × 6 màu, vẽ bằng SVG ===== */
  const MAU = [
    { c: '#FFB7C5', v: '#E9799C' }, { c: '#FFE0A3', v: '#E0A94F' }, { c: '#A8E6CF', v: '#7FCFB0' },
    { c: '#C9B6F5', v: '#9B85D6' }, { c: '#BFE3FF', v: '#7FB6E8' }, { c: '#FFCBA4', v: '#D99A6C' }
  ];
  const DUONG = [
    'M50 8 L61 38 L93 41 L68 61 L76 93 L50 75 L24 93 L32 61 L7 41 L39 38 Z', /* ngôi sao */
    'M50 90 C12 66 14 30 33 24 C43 21 50 30 50 38 C50 30 57 21 67 24 C86 30 88 66 50 90 Z', /* trái tim */
    'M20 80 L50 18 L80 80 Z', /* tam giác */
    'M50 6 C86 22 90 66 50 94 C10 66 14 22 50 6 Z', /* chiếc lá */
    'M50 10 A40 40 0 1 1 49.9 10 Z', /* hình tròn */
    'M18 18 h64 v64 h-64 Z', /* hình vuông */
    'M50 8 L92 50 L50 92 L8 50 Z', /* kim cương */
    'M8 50 A42 34 0 0 1 92 50 L64 50 L64 82 A8 8 0 0 1 36 82 L36 50 Z' /* cây nấm */
  ];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function veHinh(combo) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', DUONG[combo.h]);
    path.setAttribute('fill', MAU[combo.m].c);
    path.setAttribute('stroke', MAU[combo.m].v);
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  const $ = (id) => document.getElementById(id);
  const oChuoi = $('chuoi');
  const oLuaChon = $('luaChon');
  const oSoCau = $('soCau');
  const oSoDung = $('soDung');
  const oKyLuc = $('kyLuc');
  const thongBao = $('thongBao');
  const manThang = $('manThang');
  if (!oChuoi || !oLuaChon || !oSoCau || !oSoDung || !oKyLuc || !thongBao || !manThang) return;

  let state = engine.createGame();
  let dongHoChay = null;
  let questionTimer = null;

  /* ===== KỶ LỤC ===== */
  let kyLucTam = null;
  const docKyLuc = () => {
    try {
      const value = localStorage.getItem('kyluc_game7');
      return value ? parseInt(value, 10) : null;
    } catch (error) { return kyLucTam; }
  };
  const ghiKyLuc = (seconds) => {
    try { localStorage.setItem('kyluc_game7', seconds); } catch (error) { kyLucTam = seconds; }
  };
  const dinhDangGio = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  /* ===== ĐỒNG HỒ (Game 7 không hiện giờ trên màn chơi, chỉ dùng cho kỷ lục) ===== */
  function dungDongHo() {
    clearInterval(dongHoChay);
    dongHoChay = null;
  }
  function chayDongHo() {
    dungDongHo();
    if (!state.started || state.finished) return;
    dongHoChay = setInterval(() => { state = engine.tick(state); }, 1000);
  }

  /* ===== DỰNG MỘT CÂU HỎI ===== */
  function raCau() {
    thongBao.textContent = '';
    oSoCau.textContent = `${state.question + 1}/${engine.QUESTION_COUNT}`;
    oSoDung.textContent = String(state.correct);

    const cells = state.sequence.map((combo) => {
      const cell = document.createElement('div');
      cell.className = 'o-chuoi';
      cell.appendChild(veHinh(combo));
      return cell;
    });
    const hoi = document.createElement('div');
    hoi.className = 'o-chuoi o-hoi';
    hoi.id = 'oHoi';
    hoi.textContent = '?';
    oChuoi.replaceChildren(...cells, hoi);

    oLuaChon.replaceChildren(...state.choices.map((combo, index) => {
      const button = document.createElement('div');
      button.className = 'nut-chon';
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');
      button.setAttribute('aria-label', 'Chọn hình này');
      button.appendChild(veHinh(combo));
      button.addEventListener('click', () => chon(index));
      /* Cho phép chọn bằng bàn phím: Enter hoặc phím cách */
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chon(index);
        }
      });
      return button;
    }));
  }

  /* ===== BÉ CHỌN MỘT HÌNH ===== */
  function chon(index) {
    batLoa();
    const result = engine.choose(state, index);
    if (result.event === 'ignored') return;
    state = result.state;
    if (result.startedNow) chayDongHo();
    const button = oLuaChon.children[index];

    if (result.event === 'correct') {
      button.classList.add('dung');
      amDung();
      /* Điền hình đúng vào ô dấu hỏi */
      const hoi = $('oHoi');
      hoi.classList.add('da-dien');
      hoi.replaceChildren(veHinh(state.answer));
      oSoDung.textContent = String(state.correct);
      thongBao.textContent = 'Chính xác! Quy luật đúng rồi!';
      questionTimer = setTimeout(() => {
        state = engine.nextQuestion(state);
        if (state.finished) thangCuoc();
        else raCau();
      }, 1200);
    } else {
      button.classList.add('sai');
      amSai();
      thongBao.textContent = 'Bé nhìn lại chuỗi hình xem nhé!';
      // Mỗi lần chọn sai có hẹn giờ riêng, để chọn sai liên tiếp không làm kẹt viền đỏ ở hình trước.
      setTimeout(() => { button.classList.remove('sai'); thongBao.textContent = ''; }, 900);
    }
  }

  /* ===== THẮNG CUỘC ===== */
  function thangCuoc() {
    dungDongHo();
    nhacThang();
    banPhaoGiay();
    $('tgCuoi').textContent = dinhDangGio(state.seconds);
    $('dungCuoi').textContent = `${state.correct}/${engine.QUESTION_COUNT}`;
    const cu = docKyLuc();
    if (cu === null || state.seconds < cu) {
      ghiKyLuc(state.seconds);
      $('bangKyLuc').classList.add('hien');
      $('loiKhen').textContent = 'Bé nghĩ nhanh hơn lần trước rồi!';
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

  /* ===== BẮT ĐẦU CẢ VÁN (8 câu) ===== */
  function hienBang() {
    const kyLuc = docKyLuc();
    oKyLuc.textContent = kyLuc ? dinhDangGio(kyLuc) : '--';
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();
    raCau();
  }

  function vanMoi() {
    clearTimeout(questionTimer);
    dungDongHo();
    state = engine.createGame();
    hienBang();
  }

  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  addEventListener('resize', () => {
    if (canvas.style.display === 'block') { canvas.width = innerWidth; canvas.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* API cho lớp lưu ván (js/games5-7-autosave.js) và cho test. */
  window.BongGame7 = Object.freeze({
    serialize: (sessionId) => engine.serialize(state, sessionId),
    restore(saved) {
      const restored = engine.restore(saved);
      if (!restored) return false;
      clearTimeout(questionTimer);
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
