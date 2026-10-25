/*
 * Game 4 – Gom Đồ Theo Màu: giao diện (SVG, kéo thả bằng Pointer Events, âm thanh, pháo giấy).
 * Logic nằm trong js/game4-engine.js; tệp này chỉ gọi engine rồi vẽ lại.
 * Thao tác bàn phím (js/game4-keyboard-sorting.js) vẫn gắn lên cùng DOM như trước.
 * window.BongGame4 là API cho adapter js/games2-4-autosave.js.
 */
(() => {
  'use strict';

  const engine = window.BongGame4Engine;
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
  const amNhac = () => keoChuong(660, 0.1, 0, 0.09);
  const amDung = () => { keoChuong(784, 0.15, 0, 0.16); keoChuong(1046.5, 0.3, 0.1, 0.16); };
  const amSai = () => keoChuong(196, 0.26, 0, 0.11, 'sine');
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));

  /* ===== VẼ ĐỒ VẬT VÀ GIỎ =====
     Mẫu SVG là chuỗi hằng trong engine (giữ nguyên từng ký tự để nhận lại bản lưu rất cũ chỉ có HTML).
     Phân tích trong <template> (nội dung trơ) rồi lấy nút ra; không bao giờ dựng từ dữ liệu lưu. */
  function tuMau(svgString) {
    const holder = document.createElement('template');
    holder.innerHTML = svgString;
    return holder.content;
  }
  const veGio = (m) => `<svg viewBox="0 0 100 80">
  <path d="M6 24 h88 l-11 44 a8 8 0 0 1 -8 6 h-50 a8 8 0 0 1 -8 -6z" fill="${m.main}" stroke="${m.dark}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M26 32 v40 M50 32 v42 M74 32 v40" stroke="${m.dark}" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M24 24 q26-22 52 0" fill="none" stroke="${m.dark}" stroke-width="5" stroke-linecap="round"/></svg>`;

  /** HTML do trình duyệt chuẩn hóa, để so chuỗi SVG trong bản lưu rất cũ với mẫu gốc. */
  function chuanHoa(html) {
    const holder = document.createElement('template');
    holder.innerHTML = html;
    return holder.innerHTML;
  }
  /** Nhận lại kiểu đồ vật từ HTML của bản lưu rất cũ; không khớp mẫu nào thì -1 (bỏ bản lưu, không chèn HTML lạ). */
  function kieuTuHtml(colorId, html) {
    const target = chuanHoa(html);
    for (let shape = 0; shape < engine.SHAPE_COUNT; shape += 1) {
      if (chuanHoa(engine.shapeSvg(shape, colorId)) === target) return shape;
    }
    return -1;
  }

  /* ===== TRẠNG THÁI ===== */
  const sanDo = $('sanDo');
  const hangGio = $('hangGio');
  const oGom = $('soGom');
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
      const value = localStorage.getItem('kyluc_game4');
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      return kyLucTam;
    }
  };
  const ghiKyLuc = (seconds) => {
    try { localStorage.setItem('kyluc_game4', seconds); } catch (error) { kyLucTam = seconds; }
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

  function capNhatSo() {
    oGom.textContent = `${engine.collected(state)}/${engine.ITEM_COUNT}`;
    const counts = engine.basketCounts(state);
    engine.COLORS.forEach((color) => { $(`dem-${color.id}`).textContent = String(counts[color.id]); });
  }

  /** Dựng lại giỏ, đồ vật và bảng số từ trạng thái hiện tại (ván mới và khi khôi phục). */
  function veLai() {
    clearTimeout(winTimer);
    oDongHo.textContent = dinhDangGio(state.seconds);
    const kl = docKyLuc();
    oKyLuc.textContent = kl ? dinhDangGio(kl) : '--';
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();

    /* 4 cái giỏ */
    hangGio.replaceChildren(...engine.COLORS.map((color) => {
      const basket = document.createElement('div');
      basket.className = 'gio';
      basket.dataset.mau = color.id;
      basket.style.setProperty('--mau', color.main);
      const name = document.createElement('span');
      name.className = 'ten-gio';
      name.textContent = `Giỏ ${color.name}`;
      const count = document.createElement('span');
      count.className = 'dem';
      count.id = `dem-${color.id}`;
      basket.append(tuMau(veGio(color)), name, count);
      return basket;
    }));

    /* 12 đồ vật */
    sanDo.replaceChildren(...state.objects.map((item, index) => {
      const element = document.createElement('div');
      element.className = `do-vat${item.done ? ' xong' : ''}`;
      element.dataset.mau = item.color;
      element.dataset.kieu = String(item.shape);
      element.setAttribute('aria-label', `Đồ vật màu ${engine.colorById(item.color).name}`);
      element.append(tuMau(engine.shapeSvg(item.shape, item.color)));
      ganKeoTha(element, index);
      return element;
    }));
    capNhatSo();
  }

  function batDau(next) {
    dungDongHo();
    state = next;
    veLai();
  }
  const vanMoi = () => batDau(engine.createGame());

  /* ===== KÉO THẢ BẰNG POINTER EVENTS (chuột + ngón tay) ===== */
  function ganKeoTha(doVat, index) {
    let keo = false;
    let lechX = 0;
    let lechY = 0;
    let gioCu = null;
    doVat.addEventListener('pointerdown', bd);

    function bd(event) {
      batLoa();
      const result = engine.pickUp(state, index);
      if (result.event === 'ignored') return;
      state = result.state;
      if (result.startedNow) chayDongHo();
      amNhac();
      keo = true;
      const o = doVat.getBoundingClientRect();
      lechX = event.clientX - o.left;
      lechY = event.clientY - o.top;
      doVat.classList.add('dang-keo');
      doVat.style.width = `${o.width}px`;
      doVat.style.height = `${o.height}px`;
      dat(event.clientX, event.clientY);
      doVat.setPointerCapture(event.pointerId);
      doVat.addEventListener('pointermove', di);
      doVat.addEventListener('pointerup', tha);
      doVat.addEventListener('pointercancel', tha);
      event.preventDefault();
    }
    function dat(x, y) {
      doVat.style.left = `${x - lechX}px`;
      doVat.style.top = `${y - lechY}px`;
    }
    function di(event) {
      if (!keo) return;
      dat(event.clientX, event.clientY);
      const g = timGio(event.clientX, event.clientY);
      if (g !== gioCu) {
        if (gioCu) gioCu.classList.remove('gan-toi');
        if (g) g.classList.add('gan-toi');
        gioCu = g;
      }
    }
    function tha(event) {
      if (!keo) return;
      keo = false;
      doVat.removeEventListener('pointermove', di);
      doVat.removeEventListener('pointerup', tha);
      doVat.removeEventListener('pointercancel', tha);
      doVat.classList.remove('dang-keo');
      doVat.style.cssText = '';
      if (gioCu) gioCu.classList.remove('gan-toi');
      gioCu = null;

      const g = timGio(event.clientX, event.clientY);
      const result = engine.drop(state, index, g ? g.dataset.mau : null);
      state = result.state;
      if (result.event === 'wrong') {
        g.classList.add('sai');
        amSai();
        setTimeout(() => g.classList.remove('sai'), 420);
        return;
      }
      if (result.event !== 'correct' && result.event !== 'completed') return;
      doVat.classList.add('xong');
      g.classList.add('dung');
      setTimeout(() => g.classList.remove('dung'), 460);
      amDung();
      capNhatSo();
      if (result.event === 'completed') {
        const loi = document.createElement('span');
        loi.className = 'loi-het';
        loi.textContent = 'Sân đã sạch bong rồi!';
        sanDo.replaceChildren(loi);
        dungDongHo();
        winTimer = setTimeout(thangCuoc, 600);
      }
    }
  }
  function timGio(x, y) {
    return [...hangGio.children].find((g) => {
      const r = g.getBoundingClientRect();
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
      $('loiKhen').textContent = 'Bé gom nhanh hơn lần trước rồi!';
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

  $('nutVanMoi').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  window.addEventListener('resize', () => {
    if (canvas.style.display === 'block') { canvas.width = innerWidth; canvas.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* ===== API cho adapter tự lưu ===== */
  window.BongGame4 = Object.freeze({
    getState: () => state,
    serialize: (sessionId) => engine.serialize(state, sessionId),
    restore(saved) {
      const restored = engine.restore(saved, { shapeFromHtml: kieuTuHtml });
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
