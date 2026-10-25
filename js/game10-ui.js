/*
 * Game 10 – Gõ Phím Theo Nhịp: giao diện (canvas làn nhạc, âm thanh, nút gõ, phím cách, pháo giấy).
 * Logic và chấm điểm nằm trong js/game10-engine.js; tệp này đo thời gian, gọi engine rồi vẽ lại.
 * window.BongGame10 là API cho adapter js/games8-10-autosave.js.
 */
(() => {
  'use strict';

  const engine = window.BongGame10Engine;
  const $ = (id) => document.getElementById(id);

  /* ===== ÂM THANH TỰ SINH BẰNG WEB AUDIO API ===== */
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
  const amTrong = () => keoChuong(140, 0.09, 0, 0.10, 'sine'); /* tiếng trống nền mỗi nhịp */
  const AM_GO = {
    perfect: () => { keoChuong(880, 0.12, 0, 0.16); keoChuong(1318.5, 0.22, 0.06, 0.14); },
    good: () => keoChuong(784, 0.14, 0, 0.14),
    ok: () => keoChuong(587.3, 0.14, 0, 0.12)
  };
  const amTruot = () => keoChuong(196, 0.22, 0, 0.10, 'sine');
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));
  const LOI_GO = {
    perfect: ['Tuyệt vời!', '#E0729B'],
    good: ['Giỏi lắm!', '#4E9A78'],
    ok: ['Được rồi!', '#3E6E96']
  };

  /* ===== CANVAS ===== */
  const lan = $('lan');
  const ctx = lan.getContext('2d');
  const W = lan.width;
  const H = lan.height;
  const Y_VACH = H - 110; /* vạch gõ nhịp */

  /* ===== TRẠNG THÁI ===== */
  const oDiem = $('diem');
  const oChuoi = $('chuoi');
  const oConLai = $('conLai');
  const oKyLuc = $('kyLuc');
  const nutGo = $('nutGo');
  const chamDiem = $('chamDiem');
  const manThang = $('manThang');

  let state = engine.idle();
  /* performance.now() lúc t = 0 của bài đang chơi. */
  let batDauLuc = 0;
  let vongLap = null;
  let nhayVach = 0;

  let kyLucTam = null;
  const docKyLuc = () => {
    try {
      const value = localStorage.getItem('kyluc_game10');
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      return kyLucTam;
    }
  };
  const ghiKyLuc = (score) => {
    try { localStorage.setItem('kyluc_game10', score); } catch (error) { kyLucTam = score; }
  };

  const thoiGian = () => performance.now() - batDauLuc;

  function hienBangSo() {
    oDiem.textContent = String(state.score);
    oChuoi.textContent = String(state.streak);
    oConLai.textContent = String(state.stars.length ? engine.remaining(state) : engine.STAR_COUNT);
  }

  /** Bắt đầu chạy (bài mới hoặc bài khôi phục) từ thời điểm `elapsedMs` của bài. */
  function chayTu(elapsedMs) {
    nhayVach = 0;
    hienBangSo();
    const kl = docKyLuc();
    oKyLuc.textContent = kl !== null ? String(kl) : '--';
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();
    nutGo.disabled = !state.running;
    batDauLuc = performance.now() - elapsedMs;
    cancelAnimationFrame(vongLap);
    if (state.running) chay();
    else ve(elapsedMs);
  }

  function batDau() {
    batLoa();
    state = engine.start();
    chayTu(0);
  }

  /* ===== VÒNG LẶP VẼ ===== */
  function chay() {
    const t = thoiGian();
    const result = engine.advance(state, t);
    state = result.state;
    if (result.beat) amTrong(); /* tiếng trống nền giúp bé cảm được nhịp */
    for (let i = 0; i < result.missed; i += 1) {
      amTruot();
      hienChamDiem('Trượt rồi!', '#C7A6D4');
    }
    if (result.missed) hienBangSo();
    ve(t);
    if (result.finished) {
      ketThuc();
      return;
    }
    vongLap = requestAnimationFrame(chay);
  }

  /* ===== VẼ LÀN NHẠC ===== */
  function ve(t) {
    ctx.clearRect(0, 0, W, H);
    /* Nền làn và hai mép làn */
    ctx.fillStyle = '#F7F3FF';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#EDE4FB';
    ctx.fillRect(0, 0, 44, H);
    ctx.fillRect(W - 44, 0, 44, H);

    /* Vạch gõ nhịp (sáng lên khi bé gõ) */
    const sang = Math.max(0, 1 - (performance.now() - nhayVach) / 220);
    ctx.strokeStyle = sang > 0 ? '#FFD166' : '#FFB7C5';
    ctx.lineWidth = 8 + sang * 8;
    ctx.beginPath();
    ctx.moveTo(30, Y_VACH);
    ctx.lineTo(W - 30, Y_VACH);
    ctx.stroke();

    /* Vòng tròn đích trên vạch */
    ctx.beginPath();
    ctx.arc(W / 2, Y_VACH, 36 + sang * 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#E9799C';
    ctx.lineWidth = 5;
    ctx.stroke();

    /* Các ngôi sao đang rơi (sao đã gõ trúng thì nổ mất, sao trượt thì biến mất) */
    state.stars.forEach((star) => {
      if (star.done) return;
      const conLai = star.time - t; /* còn bao lâu nữa thì tới vạch */
      if (conLai > engine.FALL_MS) return; /* chưa tới lượt xuất hiện */
      const tienDo = 1 - conLai / engine.FALL_MS; /* 0 = đỉnh, 1 = tới vạch */
      veNgoiSao(W / 2, tienDo * Y_VACH, 30, tienDo);
    });
  }

  function veNgoiSao(cx, cy, r, tienDo) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tienDo * 1.4);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const bk = i % 2 === 0 ? r : r * 0.45;
      const goc = -Math.PI / 2 + i * Math.PI / 5;
      const x = bk * Math.cos(goc);
      const y = bk * Math.sin(goc);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#FFE0A3';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#E0A94F';
    ctx.stroke();
    ctx.restore();
  }

  /* ===== BÉ GÕ NHỊP ===== */
  function go() {
    batLoa();
    const result = engine.tap(state, thoiGian());
    if (result.event === 'ignored') return;
    nhayVach = performance.now();
    if (result.event === 'early') {
      /* Gõ khi chưa có sao nào tới: chỉ báo nhẹ, không trừ điểm */
      amTruot();
      hienChamDiem('Sớm quá!', '#C7A6D4');
      return;
    }
    state = result.state;
    AM_GO[result.event]();
    hienChamDiem(...LOI_GO[result.event]);
    hienBangSo();
  }

  function hienChamDiem(chu, mau) {
    chamDiem.textContent = chu;
    chamDiem.style.color = mau;
    chamDiem.classList.remove('hien');
    void chamDiem.offsetWidth;
    chamDiem.classList.add('hien');
  }

  /* ===== KẾT THÚC ===== */
  function ketThuc() {
    nutGo.disabled = true;
    cancelAnimationFrame(vongLap);

    $('diemCuoi').textContent = String(state.score);
    $('trungCuoi').textContent = `${engine.hits(state)}/${engine.STAR_COUNT}`;
    $('chuoiCuoi').textContent = String(state.longestStreak);

    if (engine.misses(state) === 0) {
      $('tieuDeThang').textContent = 'Bé bắt trọn nhịp!';
      $('loiKhen').textContent = 'Không trượt ngôi sao nào cả!';
    } else {
      $('tieuDeThang').textContent = 'Bé gõ hay quá!';
      $('loiKhen').textContent = 'Lần sau bé thử không trượt sao nào nhé!';
    }

    const cu = docKyLuc();
    if (cu === null || state.score > cu) {
      ghiKyLuc(state.score);
      $('bangKyLuc').classList.add('hien');
    }
    oKyLuc.textContent = String(docKyLuc());

    nhacThang();
    banPhaoGiay();
    manThang.classList.add('hien');
  }

  /* ===== NÚT & PHÍM ===== */
  nutGo.addEventListener('pointerdown', (event) => { event.preventDefault(); go(); });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' && event.key !== ' ') return;
    // Đang chơi: phím cách là gõ nhịp. Chưa chơi: để phím cách bấm được nút đang được chọn
    // ("Bắt đầu", "Chơi lại"…); chỉ chặn cuộn trang khi không đứng trên nút hay liên kết.
    if (state.running) {
      event.preventDefault();
      go();
    } else if (!event.target?.closest?.('button, a, input, select, textarea')) {
      event.preventDefault();
    }
  });
  $('nutBatDau').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); batDau(); });
  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); batDau(); });

  /* ===== PHÁO GIẤY ===== */
  const canvas = $('phaoGiay');
  const ctx2d = canvas.getContext('2d');
  let hatGiay = [];
  let vongPhao = null;
  const MAU_GIAY = ['#FFB7C5', '#C9B6F5', '#FFE0A3', '#A8E6CF', '#BFE3FF', '#FFCBA4'];
  function banPhaoGiay() {
    canvas.style.display = 'block';
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    hatGiay = [];
    for (let i = 0; i < 160; i += 1) {
      hatGiay.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        r: 5 + Math.random() * 7,
        mau: MAU_GIAY[i % MAU_GIAY.length],
        rung: Math.random() * 6.28,
        toc: 1.6 + Math.random() * 2.6,
        xoay: (Math.random() - 0.5) * 0.2
      });
    }
    cancelAnimationFrame(vongPhao);
    veGiay();
  }
  function veGiay() {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    hatGiay.forEach((h) => {
      h.y += h.toc;
      h.rung += h.xoay;
      h.x += Math.sin(h.rung) * 1.4;
      if (h.y > canvas.height + 20) { h.y = -20; h.x = Math.random() * canvas.width; }
      ctx2d.save();
      ctx2d.translate(h.x, h.y);
      ctx2d.rotate(h.rung);
      ctx2d.fillStyle = h.mau;
      ctx2d.fillRect(-h.r / 2, -h.r / 2, h.r, h.r * 1.5);
      ctx2d.restore();
    });
    vongPhao = requestAnimationFrame(veGiay);
  }
  function dungPhaoGiay() {
    cancelAnimationFrame(vongPhao);
    canvas.style.display = 'none';
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener('resize', () => {
    if (canvas.style.display === 'block') { canvas.width = innerWidth; canvas.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* ===== API cho adapter tự lưu ===== */
  window.BongGame10 = Object.freeze({
    getState: () => state,
    elapsedMs: () => (state.running ? Math.max(0, thoiGian()) : 0),
    serialize: (sessionId) => engine.serialize(state, sessionId, state.running ? thoiGian() : 0),
    restore(saved) {
      const restored = engine.restore(saved);
      if (!restored) return false;
      state = restored.state;
      chayTu(restored.elapsedMs);
      return true;
    },
    canSave: () => engine.canSave(state),
    moves: () => engine.moves(state),
    seconds: () => Math.round(Math.max(0, thoiGian()) / 1000),
    start: batDau
  });

  /* Vẽ sẵn làn nhạc để bé thấy vạch đích trước khi bấm Bắt đầu */
  ve(0);
})();
