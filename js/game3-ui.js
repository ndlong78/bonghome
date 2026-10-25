/*
 * Game 3 – Tìm Bóng Cho Hình: giao diện (SVG, kéo thả bằng Pointer Events, âm thanh, pháo giấy).
 * Logic nằm trong js/game3-engine.js; tệp này chỉ gọi engine rồi vẽ lại.
 * Thao tác bàn phím (js/game3-keyboard-matching.js) và chống giật layout khi kéo
 * (js/game3-drag-stability.js) vẫn gắn lên cùng DOM như trước.
 * window.BongGame3 là API cho adapter js/games2-4-autosave.js.
 */
(() => {
  'use strict';

  const engine = window.BongGame3Engine;
  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';

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
  const amNhac = () => keoChuong(660, 0.1, 0, 0.09); /* khi nhấc hình lên */
  const amDung = () => { keoChuong(784, 0.15, 0, 0.16); keoChuong(1046.5, 0.32, 0.1, 0.16); };
  const amSai = () => keoChuong(196, 0.26, 0, 0.11, 'sine');
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));

  /* ===== VẼ HÌNH: bản màu và bản bóng ===== */
  function veHinh(shape, bong) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', shape.d);
    if (bong) {
      path.setAttribute('fill', '#8E7BA6');
      path.setAttribute('opacity', '0.42');
    } else {
      path.setAttribute('fill', shape.fill);
      path.setAttribute('stroke', shape.stroke);
      path.setAttribute('stroke-width', '4');
      path.setAttribute('stroke-linejoin', 'round');
    }
    svg.append(path);
    return svg;
  }
  const veMau = (shape) => veHinh(shape, false);
  const veBong = (shape) => veHinh(shape, true);

  /* ===== TRẠNG THÁI ===== */
  const khay = $('khay');
  const hangBong = $('hangBong');
  const oDung = $('soDung');
  const oDongHo = $('dongHo');
  const oKyLuc = $('kyLuc');
  const manThang = $('manThang');

  let state = engine.createGame();
  let dongHoChay = null;
  /* Hẹn giờ hiện màn thắng; hủy khi bé bấm "Ván mới" giữa chừng. */
  let winTimer = null;

  let kyLucTam = null;
  const docKyLuc = () => {
    try {
      const value = localStorage.getItem('kyluc_game3');
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      return kyLucTam;
    }
  };
  const ghiKyLuc = (seconds) => {
    try { localStorage.setItem('kyluc_game3', seconds); } catch (error) { kyLucTam = seconds; }
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

  /** Dựng lại khay hình, hàng bóng và bảng số từ trạng thái hiện tại (ván mới và khi khôi phục). */
  function veLai() {
    clearTimeout(winTimer);
    oDung.textContent = `${state.matched.length}/${engine.PIECE_COUNT}`;
    oDongHo.textContent = dinhDangGio(state.seconds);
    const kl = docKyLuc();
    oKyLuc.textContent = kl ? dinhDangGio(kl) : '--';
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();

    /* Khay hình màu */
    khay.replaceChildren(...state.colorOrder.map((id) => {
      const shape = engine.shapeById(id);
      const piece = document.createElement('div');
      piece.className = `mieng-hinh${engine.isMatched(state, id) ? ' xong' : ''}`;
      piece.dataset.id = id;
      piece.setAttribute('aria-label', `Hình ${shape.name}`);
      piece.append(veMau(shape));
      ganKeoTha(piece);
      return piece;
    }));

    /* Hàng bóng (thứ tự khác khay) */
    hangBong.replaceChildren(...state.shadowOrder.map((id) => {
      const shape = engine.shapeById(id);
      const matched = engine.isMatched(state, id);
      const target = document.createElement('div');
      target.className = `o-bong${matched ? ' dung' : ''}`;
      target.dataset.id = id;
      target.append(matched ? veMau(shape) : veBong(shape));
      return target;
    }));
  }

  function batDau(next) {
    dungDongHo();
    state = next;
    veLai();
  }
  const vanMoi = () => batDau(engine.createGame());

  /* ===== KÉO THẢ (Pointer Events: chạy tốt cả chuột lẫn ngón tay) ===== */
  function ganKeoTha(hinh) {
    let dangKeo = false;
    let lechX = 0;
    let lechY = 0;
    let oCu = null;

    hinh.addEventListener('pointerdown', bd);

    function bd(event) {
      batLoa();
      const result = engine.pickUp(state, hinh.dataset.id);
      if (result.event === 'ignored') return;
      state = result.state;
      if (result.startedNow) chayDongHo();
      amNhac();
      dangKeo = true;
      const o = hinh.getBoundingClientRect();
      lechX = event.clientX - o.left;
      lechY = event.clientY - o.top;
      hinh.classList.add('dang-keo');
      hinh.style.width = `${o.width}px`;
      hinh.style.height = `${o.height}px`;
      dat(event.clientX, event.clientY);
      hinh.setPointerCapture(event.pointerId);
      hinh.addEventListener('pointermove', di);
      hinh.addEventListener('pointerup', tha);
      hinh.addEventListener('pointercancel', tha);
      event.preventDefault();
    }
    function dat(x, y) {
      hinh.style.left = `${x - lechX}px`;
      hinh.style.top = `${y - lechY}px`;
    }

    function di(event) {
      if (!dangKeo) return;
      dat(event.clientX, event.clientY);
      const o = timOBong(event.clientX, event.clientY);
      if (o !== oCu) {
        if (oCu) oCu.classList.remove('gan-toi');
        if (o && !o.classList.contains('dung')) o.classList.add('gan-toi');
        oCu = o;
      }
    }

    function tha(event) {
      if (!dangKeo) return;
      dangKeo = false;
      hinh.removeEventListener('pointermove', di);
      hinh.removeEventListener('pointerup', tha);
      hinh.removeEventListener('pointercancel', tha);
      hinh.classList.remove('dang-keo');
      hinh.style.cssText = '';
      if (oCu) oCu.classList.remove('gan-toi');
      oCu = null;

      const o = timOBong(event.clientX, event.clientY);
      const result = engine.drop(state, hinh.dataset.id, o ? o.dataset.id : null);
      state = result.state;
      if (result.event === 'wrong') {
        o.classList.add('sai');
        amSai();
        setTimeout(() => o.classList.remove('sai'), 420);
        return;
      }
      if (result.event !== 'correct' && result.event !== 'completed') return;
      /* Ghép đúng: hình màu nằm đè lên bóng */
      o.classList.add('dung');
      o.replaceChildren(veMau(engine.shapeById(o.dataset.id)));
      hinh.classList.add('xong');
      amDung();
      oDung.textContent = `${state.matched.length}/${engine.PIECE_COUNT}`;
      if (result.event === 'completed') {
        dungDongHo();
        winTimer = setTimeout(thangCuoc, 600);
      }
    }
  }

  /* Tìm ô bóng nằm dưới ngón tay/con trỏ */
  function timOBong(x, y) {
    return [...hangBong.children].find((o) => {
      const r = o.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }) || null;
  }

  /* ===== THẮNG CUỘC ===== */
  function thangCuoc() {
    nhacThang();
    banPhaoGiay();
    $('tgCuoi').textContent = dinhDangGio(state.seconds);
    $('saiCuoi').textContent = String(state.wrong);
    const cu = docKyLuc();
    if (cu === null || state.seconds < cu) {
      ghiKyLuc(state.seconds);
      $('bangKyLuc').classList.add('hien');
      $('loiKhen').textContent = 'Bé ghép nhanh hơn lần trước rồi!';
    } else {
      $('loiKhen').textContent = 'Lần sau bé thử phá kỷ lục nhé!';
    }
    oKyLuc.textContent = dinhDangGio(docKyLuc());
    manThang.classList.add('hien');
  }

  /* ===== PHÁO GIẤY (Canvas) ===== */
  const canvas = $('phaoGiay');
  const ctx2d = canvas.getContext('2d');
  let hatGiay = [];
  let vongLap = null;
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
    cancelAnimationFrame(vongLap);
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
    vongLap = requestAnimationFrame(veGiay);
  }
  function dungPhaoGiay() {
    cancelAnimationFrame(vongLap);
    canvas.style.display = 'none';
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* ===== NÚT ===== */
  $('nutVanMoi').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  window.addEventListener('resize', () => {
    if (canvas.style.display === 'block') { canvas.width = innerWidth; canvas.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* ===== API cho adapter tự lưu ===== */
  window.BongGame3 = Object.freeze({
    getState: () => state,
    serialize: (sessionId) => engine.serialize(state, sessionId),
    restore(saved) {
      const restored = engine.restore(saved);
      if (!restored) return false;
      batDau(restored);
      if (state.started) chayDongHo();
      return true;
    },
    canSave: () => engine.canSave(state),
    moves: () => engine.moves(state),
    seconds: () => state.seconds,
    newGame: vanMoi
  });

  veLai();
})();
