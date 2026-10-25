/*
 * Game 8 – Mê Cung Về Nhà: giao diện (canvas, âm thanh, nút, bàn phím, vuốt tay, pháo giấy).
 * Logic nằm trong js/game8-engine.js; tệp này chỉ gọi engine rồi vẽ lại.
 * window.BongGame8 là API cho adapter js/games8-10-autosave.js.
 */
(() => {
  'use strict';

  const engine = window.BongGame8Engine;
  const $ = (id) => document.getElementById(id);

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
  function keoChuong(f, d = 0.3, t = 0, v = 0.16, dang = 'triangle') {
    const c = batLoa();
    if (!c) return;
    const bd = c.currentTime + t;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = dang;
    o.frequency.setValueAtTime(f, bd);
    g.gain.setValueAtTime(0.0001, bd);
    g.gain.exponentialRampToValueAtTime(v, bd + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, bd + d);
    o.connect(g).connect(c.destination);
    o.start(bd);
    o.stop(bd + d + 0.05);
  }
  const amBuoc = () => keoChuong(560, 0.07, 0, 0.07); /* tiếng chân nhẹ */
  const amTuong = () => keoChuong(150, 0.16, 0, 0.09, 'sine'); /* đụng tường: âm trầm dịu */
  const amNut = (v = 0.14) => keoChuong(880, v, 0, v);
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));

  /* ===== TRẠNG THÁI ===== */
  const canvas = $('meCung');
  const ctx = canvas.getContext('2d');
  const oBuoc = $('soBuoc');
  const oDongHo = $('dongHo');
  const oKyLuc = $('kyLuc');
  const manThang = $('manThang');

  let state = engine.createGame(engine.SIZES[0]);
  let dongHoChay = null;
  let winTimer = null;

  const kyLucTam = {};
  const docKyLuc = (n) => {
    try {
      const value = localStorage.getItem(`kyluc_game8_${n}`);
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      return kyLucTam[n] ?? null;
    }
  };
  const ghiKyLuc = (n, seconds) => {
    try { localStorage.setItem(`kyluc_game8_${n}`, seconds); } catch (error) { kyLucTam[n] = seconds; }
  };
  const dinhDangGio = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function dungDongHo() {
    clearInterval(dongHoChay);
    dongHoChay = null;
  }
  function chayDongHo() {
    dungDongHo();
    dongHoChay = setInterval(() => {
      state = engine.tick(state);
      oDongHo.textContent = dinhDangGio(state.seconds);
    }, 1000);
  }

  function hienMucDo() {
    document.querySelectorAll('#mucDo button').forEach((button) => {
      const selected = Number(button.dataset.o) === state.size;
      button.classList.toggle('dang-chon', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  /** Đồng bộ bảng số, mức độ và mê cung với trạng thái hiện tại. */
  function hienTrangThai() {
    clearTimeout(winTimer);
    oBuoc.textContent = String(state.steps);
    oDongHo.textContent = dinhDangGio(state.seconds);
    const kl = docKyLuc(state.size);
    oKyLuc.textContent = kl ? dinhDangGio(kl) : '--';
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    hienMucDo();
    dungPhaoGiay();
    ve();
  }

  /* ===== VÁN MỚI ===== */
  function vanMoi(size = state.size) {
    dungDongHo();
    state = engine.createGame(size);
    hienTrangThai();
  }

  /* ===== VẼ MÊ CUNG LÊN CANVAS ===== */
  function ve() {
    const N = state.size;
    const S = canvas.width;
    const coO = Math.floor((S - 24) / N);
    const le = Math.floor((S - coO * N) / 2);
    const veTuong = Math.max(3, Math.floor(coO * 0.09));

    ctx.clearRect(0, 0, S, S);

    /* Nền cỏ mint nhạt */
    ctx.fillStyle = '#F2FBF7';
    ctx.fillRect(le, le, coO * N, coO * N);

    /* Vệt đường bé đã đi qua */
    ctx.fillStyle = '#FFF0D9';
    state.path.forEach(([x, y]) => {
      ctx.fillRect(le + x * coO + 2, le + y * coO + 2, coO - 4, coO - 4);
    });

    /* Ngôi nhà kẹo ở ô đích (góc dưới phải) */
    veNgoiNha(le + (N - 1) * coO, le + (N - 1) * coO, coO);

    /* Các bức tường */
    ctx.strokeStyle = '#9BC7EA';
    ctx.lineWidth = veTuong;
    ctx.lineCap = 'round';
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const o = state.maze[y][x];
        const px = le + x * coO;
        const py = le + y * coO;
        ctx.beginPath();
        if (o.tren) { ctx.moveTo(px, py); ctx.lineTo(px + coO, py); }
        if (o.phai) { ctx.moveTo(px + coO, py); ctx.lineTo(px + coO, py + coO); }
        if (o.duoi) { ctx.moveTo(px, py + coO); ctx.lineTo(px + coO, py + coO); }
        if (o.trai) { ctx.moveTo(px, py); ctx.lineTo(px, py + coO); }
        ctx.stroke();
      }
    }

    /* Bạn kỳ lân */
    veKyLan(le + state.player.x * coO, le + state.player.y * coO, coO);
  }

  function veNgoiNha(px, py, s) {
    const m = s * 0.14;
    ctx.fillStyle = '#FFF3E0';
    ctx.fillRect(px + m, py + s * 0.46, s - 2 * m, s * 0.4);
    ctx.beginPath();
    ctx.moveTo(px + m * 0.6, py + s * 0.5);
    ctx.lineTo(px + s / 2, py + s * 0.16);
    ctx.lineTo(px + s - m * 0.6, py + s * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#FFB7C5';
    ctx.fill();
    ctx.fillStyle = '#C9B6F5';
    ctx.fillRect(px + s * 0.4, py + s * 0.6, s * 0.2, s * 0.26);
  }

  function veKyLan(px, py, s) {
    const cx = px + s / 2;
    const cy = py + s / 2;
    const r = s * 0.3;
    /* Thân */
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.strokeStyle = '#E9A9C6';
    ctx.stroke();
    /* Sừng vàng */
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.28, cy - r * 0.55);
    ctx.lineTo(cx, cy - r * 1.5);
    ctx.lineTo(cx + r * 0.28, cy - r * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#FFE0A3';
    ctx.fill();
    /* Bờm hồng */
    ctx.beginPath();
    ctx.arc(cx - r * 0.72, cy + r * 0.1, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#FFB7C5';
    ctx.fill();
    /* Mắt */
    ctx.beginPath();
    ctx.arc(cx + r * 0.28, cy - r * 0.1, Math.max(2, r * 0.13), 0, Math.PI * 2);
    ctx.fillStyle = '#6B4E71';
    ctx.fill();
  }

  /* ===== DI CHUYỂN ===== */
  function di(huong) {
    batLoa();
    const result = engine.move(state, huong);
    if (result.event === 'ignored') return;
    state = result.state;
    if (result.startedNow) chayDongHo();
    if (result.event === 'wall') {
      amTuong(); /* đụng tường: báo nhẹ, không phạt */
      return;
    }
    oBuoc.textContent = String(state.steps);
    amBuoc();
    ve();
    if (result.event === 'won') {
      dungDongHo();
      winTimer = setTimeout(thangCuoc, 250);
    }
  }

  /* ===== THẮNG CUỘC ===== */
  function thangCuoc() {
    nhacThang();
    banPhaoGiay();
    $('tgCuoi').textContent = dinhDangGio(state.seconds);
    $('buocCuoi').textContent = String(state.steps);
    const cu = docKyLuc(state.size);
    if (cu === null || state.seconds < cu) {
      ghiKyLuc(state.size, state.seconds);
      $('bangKyLuc').classList.add('hien');
      $('loiKhen').textContent = 'Bé về nhà nhanh hơn lần trước rồi!';
    } else {
      $('loiKhen').textContent = 'Lần sau bé thử phá kỷ lục nhé!';
    }
    oKyLuc.textContent = dinhDangGio(docKyLuc(state.size));
    manThang.classList.add('hien');
  }

  /* ===== ĐIỀU KHIỂN: nút bấm, bàn phím, vuốt tay ===== */
  document.querySelectorAll('.phim-huong button').forEach((button) => {
    button.addEventListener('click', () => di(button.dataset.h));
  });
  const PHIM = { ArrowUp: 'len', ArrowRight: 'phai', ArrowDown: 'xuong', ArrowLeft: 'trai', w: 'len', d: 'phai', s: 'xuong', a: 'trai' };
  window.addEventListener('keydown', (event) => {
    const huong = PHIM[event.key];
    if (huong) {
      event.preventDefault();
      di(huong);
    }
  });

  /* Vuốt ngón tay trên mê cung */
  let batX = 0;
  let batY = 0;
  canvas.addEventListener('pointerdown', (event) => { batX = event.clientX; batY = event.clientY; batLoa(); });
  canvas.addEventListener('pointerup', (event) => {
    const dx = event.clientX - batX;
    const dy = event.clientY - batY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) di(dx > 0 ? 'phai' : 'trai');
    else di(dy > 0 ? 'xuong' : 'len');
  });

  $('mucDo').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    amNut(0.12);
    vanMoi(parseInt(button.dataset.o, 10));
  });
  $('nutVanMoi').addEventListener('click', () => { amNut(); vanMoi(); });
  $('nutChoiLai').addEventListener('click', () => { amNut(); vanMoi(); });

  /* ===== PHÁO GIẤY ===== */
  const canvasPhao = $('phaoGiay');
  const ctx2d = canvasPhao.getContext('2d');
  let hatGiay = [];
  let vongLap = null;
  const MAU_GIAY = ['#FFB7C5', '#C9B6F5', '#FFE0A3', '#A8E6CF', '#BFE3FF', '#FFCBA4'];
  function banPhaoGiay() {
    canvasPhao.style.display = 'block';
    canvasPhao.width = innerWidth;
    canvasPhao.height = innerHeight;
    hatGiay = [];
    for (let i = 0; i < 160; i += 1) {
      hatGiay.push({
        x: Math.random() * canvasPhao.width,
        y: Math.random() * -canvasPhao.height,
        r: 5 + Math.random() * 7,
        mau: MAU_GIAY[i % MAU_GIAY.length],
        rung: Math.random() * 6.28,
        toc: 1.6 + Math.random() * 2.6,
        xoay: (Math.random() - 0.5) * 0.2
      });
    }
    cancelAnimationFrame(vongLap);
    veGiay();
  }
  function veGiay() {
    ctx2d.clearRect(0, 0, canvasPhao.width, canvasPhao.height);
    hatGiay.forEach((h) => {
      h.y += h.toc;
      h.rung += h.xoay;
      h.x += Math.sin(h.rung) * 1.4;
      if (h.y > canvasPhao.height + 20) { h.y = -20; h.x = Math.random() * canvasPhao.width; }
      ctx2d.save();
      ctx2d.translate(h.x, h.y);
      ctx2d.rotate(h.rung);
      ctx2d.fillStyle = h.mau;
      ctx2d.fillRect(-h.r / 2, -h.r / 2, h.r, h.r * 1.5);
      ctx2d.restore();
    });
    vongLap = requestAnimationFrame(veGiay);
  }
  function dungPhaoGiay() {
    cancelAnimationFrame(vongLap);
    canvasPhao.style.display = 'none';
    ctx2d.clearRect(0, 0, canvasPhao.width, canvasPhao.height);
  }

  window.addEventListener('resize', () => {
    if (canvasPhao.style.display === 'block') { canvasPhao.width = innerWidth; canvasPhao.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* ===== API cho adapter tự lưu ===== */
  window.BongGame8 = Object.freeze({
    getState: () => state,
    serialize: (sessionId) => engine.serialize(state, sessionId),
    restore(saved) {
      const restored = engine.restore(saved);
      if (!restored) return false;
      dungDongHo();
      state = restored;
      hienTrangThai();
      if (state.started) chayDongHo();
      return true;
    },
    canSave: () => engine.canSave(state),
    moves: () => engine.moves(state),
    seconds: () => state.seconds,
    difficulty: () => engine.difficulty(state),
    newGame: vanMoi
  });

  vanMoi();
})();
