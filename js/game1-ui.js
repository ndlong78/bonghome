/*
 * Game 1 – Lật Hình Tìm Cặp: giao diện (DOM, âm thanh, pháo giấy, hẹn giờ).
 * Logic nằm ở js/game1-engine.js; tệp này chỉ vẽ lại theo trạng thái engine.
 * window.BongGame1 là API cho game1-autosave.js và js/game1-content.js (đổi bộ hình theo chủ đề).
 */
(() => {
  'use strict';

  const engine = window.BongGame1Engine;
  const $ = (id) => document.getElementById(id);

  /* ===== KHO HÌNH VẼ DỰ PHÒNG (khi chưa/không tải được nội dung JSON) ===== */
  const KHO_HINH = [
    /* Kỳ lân */
    `<svg viewBox="0 0 64 64">
       <path d="M14 44c0-12 8-20 20-20 10 0 16 6 16 14 0 8-6 14-16 14H20a6 6 0 0 1-6-6z" fill="#FFF" stroke="#E9A9C6" stroke-width="3"/>
       <path d="M40 26 l3-14 6 12z" fill="#C9B6F5" stroke="#9B85D6" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M44 14 l2-11 4 3z" fill="#FFE0A3" stroke="#EDC46F" stroke-width="2" stroke-linejoin="round"/>
       <path d="M20 30 q-8 4-6 16 q6-4 10-8z" fill="#FFB7C5"/>
       <circle cx="43" cy="34" r="2.6" fill="#6B4E71"/>
       <path d="M50 40 q4 2 4 5" stroke="#E9A9C6" stroke-width="2.5" fill="none" stroke-linecap="round"/>
     </svg>`,
    /* Cầu vồng */
    `<svg viewBox="0 0 64 64">
       <g fill="none" stroke-linecap="round">
         <path d="M8 50 A24 24 0 0 1 56 50" stroke="#FFB7C5" stroke-width="6"/>
         <path d="M14 50 A18 18 0 0 1 50 50" stroke="#FFE0A3" stroke-width="6"/>
         <path d="M20 50 A12 12 0 0 1 44 50" stroke="#A8E6CF" stroke-width="6"/>
         <path d="M26 50 A6 6 0 0 1 38 50" stroke="#C9B6F5" stroke-width="6"/>
       </g>
       <circle cx="10" cy="52" r="6" fill="#fff" stroke="#DCD3E8" stroke-width="2"/>
       <circle cx="54" cy="52" r="6" fill="#fff" stroke="#DCD3E8" stroke-width="2"/>
     </svg>`,
    /* Ngôi sao lung linh */
    `<svg viewBox="0 0 64 64">
       <path d="M32 6 l7.4 15.6 17 2.2 -12.5 11.9 3.2 17 -15.1-8.2 -15.1 8.2 3.2-17 -12.5-11.9 17-2.2z"
             fill="#FFE0A3" stroke="#EDC46F" stroke-width="3" stroke-linejoin="round"/>
       <circle cx="26" cy="28" r="2.5" fill="#fff"/>
       <path d="M54 12 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6-3.4 -3.4-1.6 3.4-1.6z" fill="#FFF2C9"/>
     </svg>`,
    /* Vương miện công chúa */
    `<svg viewBox="0 0 64 64">
       <path d="M8 44 L12 18 l12 12 8-16 8 16 12-12 4 26z"
             fill="#FFE0A3" stroke="#E0A94F" stroke-width="3" stroke-linejoin="round"/>
       <rect x="8" y="44" width="48" height="10" rx="4" fill="#F5CC7A" stroke="#E0A94F" stroke-width="3"/>
       <circle cx="32" cy="34" r="3.5" fill="#FFB7C5"/>
       <circle cx="18" cy="38" r="3" fill="#C9B6F5"/>
       <circle cx="46" cy="38" r="3" fill="#A8E6CF"/>
     </svg>`,
    /* Mèo con */
    `<svg viewBox="0 0 64 64">
       <path d="M14 24 L12 8 l14 8z" fill="#FFCBA4" stroke="#D99A6C" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M50 24 L52 8 l-14 8z" fill="#FFCBA4" stroke="#D99A6C" stroke-width="2.5" stroke-linejoin="round"/>
       <circle cx="32" cy="36" r="20" fill="#FFE3CC" stroke="#D99A6C" stroke-width="3"/>
       <circle cx="24" cy="33" r="3" fill="#6B4E71"/>
       <circle cx="40" cy="33" r="3" fill="#6B4E71"/>
       <path d="M32 40 l-3 3 3 2 3-2z" fill="#FFB7C5"/>
       <path d="M10 34 h10 M10 40 h10 M44 34 h10 M44 40 h10" stroke="#D99A6C" stroke-width="2" stroke-linecap="round"/>
     </svg>`,
    /* Quả dâu tây */
    `<svg viewBox="0 0 64 64">
       <path d="M32 56c-12 0-20-9-20-20 0-8 9-14 20-14s20 6 20 14c0 11-8 20-20 20z"
             fill="#FFB7C5" stroke="#E9799C" stroke-width="3"/>
       <path d="M20 20 h24 l-6 6 h-12z" fill="#A8E6CF" stroke="#7FCFB0" stroke-width="2.5" stroke-linejoin="round"/>
       <path d="M32 20 v-9" stroke="#7FCFB0" stroke-width="3" stroke-linecap="round"/>
       <circle cx="25" cy="34" r="1.8" fill="#fff"/><circle cx="39" cy="34" r="1.8" fill="#fff"/>
       <circle cx="32" cy="42" r="1.8" fill="#fff"/><circle cx="22" cy="45" r="1.8" fill="#fff"/>
       <circle cx="42" cy="45" r="1.8" fill="#fff"/>
     </svg>`,
    /* Ngôi nhà kẹo ngọt */
    `<svg viewBox="0 0 64 64">
       <rect x="14" y="30" width="36" height="26" rx="5" fill="#FFF3E0" stroke="#DCB88F" stroke-width="3"/>
       <path d="M8 32 L32 12 L56 32 Z" fill="#FFB7C5" stroke="#E9799C" stroke-width="3" stroke-linejoin="round"/>
       <rect x="26" y="40" width="12" height="16" rx="4" fill="#C9B6F5"/>
       <circle cx="32" cy="24" r="4" fill="#FFE0A3"/>
       <circle cx="18" cy="46" r="3" fill="#A8E6CF"/>
       <circle cx="47" cy="46" r="3" fill="#A8E6CF"/>
     </svg>`,
    /* Con bướm */
    `<svg viewBox="0 0 64 64">
       <path d="M31 32 C22 16 6 16 10 30 C4 40 20 50 31 34z" fill="#C9B6F5" stroke="#9B85D6" stroke-width="2.5"/>
       <path d="M33 32 C42 16 58 16 54 30 C60 40 44 50 33 34z" fill="#FFB7C5" stroke="#E9799C" stroke-width="2.5"/>
       <rect x="29.5" y="20" width="5" height="30" rx="2.5" fill="#FFE0A3" stroke="#E0A94F" stroke-width="2"/>
       <path d="M31 20 l-6-8 M33 20 l6-8" stroke="#E0A94F" stroke-width="2.5" stroke-linecap="round"/>
     </svg>`
  ];

  /* Hình ngôi sao trên mặt úp của lá bài */
  const HINH_MAT_SAU = `<svg viewBox="0 0 64 64">
    <path d="M32 8 l7 15 16 2 -12 11 3 16 -14-8 -14 8 3-16 -12-11 16-2z" fill="#FFF" opacity=".85"/>
  </svg>`;

  /* Hình dựng từ chuỗi hằng (hoặc nội dung JSON đã kiểm định dạng) qua <template> trơ. */
  function tuMau(svg) {
    const template = document.createElement('template');
    template.innerHTML = svg.trim();
    return template.content;
  }

  /* ===== ÂM THANH TỰ SINH BẰNG WEB AUDIO API ===== */
  let boLoa = null;
  function batLoa() {
    if (window.BongSound && !window.BongSound.isEnabled()) return null;
    if (!boLoa) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) boLoa = new A();
    }
    if (boLoa && boLoa.state === 'suspended') boLoa.resume();
    return boLoa;
  }
  function keoChuong(tanSo, doDai = 0.3, treTho = 0, amLuong = 0.16, dang = 'triangle') {
    const ctx = batLoa(); if (!ctx) return;
    const bd = ctx.currentTime + treTho;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = dang;
    osc.frequency.setValueAtTime(tanSo, bd);
    gain.gain.setValueAtTime(0.0001, bd);
    gain.gain.exponentialRampToValueAtTime(amLuong, bd + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, bd + doDai);
    osc.connect(gain).connect(ctx.destination);
    osc.start(bd); osc.stop(bd + doDai + 0.05);
  }
  const amLatBai = () => keoChuong(660, 0.12, 0, 0.10);
  const amDung = () => { keoChuong(784, 0.16, 0, 0.16); keoChuong(988, 0.16, 0.09, 0.16); keoChuong(1175, 0.34, 0.18, 0.16); };
  const amSai = () => keoChuong(196, 0.28, 0, 0.12, 'sine');
  function nhacThang() {
    const giaiDieu = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51];
    giaiDieu.forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));
  }

  /* ===== TRẠNG THÁI GIAO DIỆN ===== */
  const sanBai = $('sanBai');
  const manThang = $('manThang');
  const UP_LAI_MS = 1000;            // hai lá khác nhau úp lại sau một nhịp để bé kịp ghi nhớ
  const UP_LAI_KHI_KHOI_PHUC_MS = 700;
  const CHO_THANG_MS = 700;

  let hinh = KHO_HINH.slice();
  let state = engine.createGame(3);
  let dongHo = null;
  let henUpLai = null;
  let henThang = null;
  const nguoiNghe = { win: [], change: [] };
  const bao = (loai, trangThai = state) => nguoiNghe[loai].forEach((fn) => { try { fn(trangThai); } catch (error) { console.error(error); } });

  /* Lưu kỷ lục vào máy (nếu trình duyệt cho phép), có bản dự phòng trong bộ nhớ tạm */
  const kyLucTam = {};
  function docKyLuc(cap) {
    try { const v = localStorage.getItem('kyluc_game1_' + cap); return v ? parseInt(v, 10) : null; }
    catch (e) { return kyLucTam[cap] ?? null; }
  }
  function ghiKyLuc(cap, giay) {
    try { localStorage.setItem('kyluc_game1_' + cap, giay); }
    catch (e) { kyLucTam[cap] = giay; }
  }
  function dinhDangGio(s) {
    const p = Math.floor(s / 60), g = s % 60;
    return p + ':' + String(g).padStart(2, '0');
  }

  /* ===== VẼ ===== */
  function chonMucDo(cap) {
    document.querySelectorAll('#mucDo button').forEach((nut) => {
      const chon = Number(nut.dataset.cap) === cap;
      nut.classList.toggle('dang-chon', chon);
      nut.setAttribute('aria-pressed', chon ? 'true' : 'false');
    });
  }

  function canCot() {
    const soCot = state.pairs === 3 ? 3 : 4;
    const rongMotLa = Math.min(140, Math.floor((Math.min(window.innerWidth - 40, 700)) / soCot) - 12);
    sanBai.style.gridTemplateColumns = `repeat(${soCot}, ${rongMotLa}px)`;
  }

  function veMatTruoc(nut) {
    const mat = nut.querySelector('.mat-truoc');
    mat.replaceChildren(tuMau(hinh[Number(nut.dataset.ma)] || ''));
  }

  /** Dựng lại toàn bộ lá bài theo bộ bài hiện tại (ván mới hoặc khôi phục). */
  function veBan() {
    const cacLa = state.deck.map((ma, index) => {
      const nut = document.createElement('button');
      nut.className = 'la-bai';
      nut.dataset.ma = String(ma);
      nut.setAttribute('aria-label', 'Lá bài úp');
      const matSau = document.createElement('div');
      matSau.className = 'mat mat-sau';
      matSau.append(tuMau(HINH_MAT_SAU));
      const matTruoc = document.createElement('div');
      matTruoc.className = 'mat mat-truoc';
      nut.append(matSau, matTruoc);
      veMatTruoc(nut);
      nut.addEventListener('click', () => chamVaoBai(index));
      return nut;
    });
    sanBai.replaceChildren(...cacLa);
    canCot();
  }

  /** Đồng bộ lớp CSS của từng lá với trạng thái (lật, đã ghép, đang sai). */
  function dongBoLa() {
    [...sanBai.children].forEach((nut, index) => {
      const daGhep = state.matched.includes(index);
      const dangMo = state.open.includes(index);
      nut.classList.toggle('lat', daGhep || dangMo);
      nut.classList.toggle('dung', daGhep);
      nut.classList.toggle('sai', dangMo && state.locked);
    });
  }

  function veSo() {
    $('soCap').textContent = `${engine.matchedPairs(state)}/${state.pairs}`;
    $('soLuot').textContent = String(state.moves);
    $('dongHo').textContent = dinhDangGio(state.seconds);
    const kl = docKyLuc(state.pairs);
    $('kyLuc').textContent = kl ? dinhDangGio(kl) : '--';
  }

  function dungHenGio() {
    clearInterval(dongHo); dongHo = null;
    clearTimeout(henUpLai); henUpLai = null;
    clearTimeout(henThang); henThang = null;
  }

  function chayDongHo() {
    clearInterval(dongHo);
    dongHo = setInterval(() => {
      state = engine.tick(state);
      $('dongHo').textContent = dinhDangGio(state.seconds);
    }, 1000);
  }

  function henUpLaiCapSai(delay) {
    clearTimeout(henUpLai);
    henUpLai = setTimeout(() => {
      henUpLai = null;
      state = engine.closeMismatch(state);
      dongBoLa();
      bao('change');
    }, delay);
  }

  /** Bắt đầu với một trạng thái (ván mới hoặc khôi phục): hủy mọi hẹn giờ của ván trước rồi vẽ lại. */
  function batDau(trangThaiMoi) {
    // Ván trước đã ghép đủ nhưng màn thắng chưa kịp hiện (bé đổi mức trong 0,7 giây): không hiện màn thắng
    // đè lên ván mới, nhưng vẫn báo thắng để lượt hoàn thành được ghi.
    const thangDangCho = henThang !== null ? state : null;
    dungHenGio();
    if (thangDangCho) bao('win', thangDangCho);
    state = trangThaiMoi;
    chonMucDo(state.pairs);
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();
    veBan();
    dongBoLa();
    veSo();
    if (state.started && !state.finished) chayDongHo();
    if (state.locked) henUpLaiCapSai(UP_LAI_KHI_KHOI_PHUC_MS);
  }

  function vanMoi(cap = state.pairs) {
    batDau(engine.createGame(cap));
  }

  /* ===== XỬ LÝ KHI BÉ CHẠM VÀO MỘT LÁ BÀI ===== */
  function chamVaoBai(index) {
    batLoa();
    const ketQua = engine.flip(state, index);
    if (ketQua.event === 'ignored') return;
    state = ketQua.state;
    if (ketQua.startedNow) chayDongHo();
    amLatBai();
    dongBoLa();
    veSo();
    if (ketQua.event === 'match') amDung();
    if (ketQua.event === 'completed') {
      amDung();
      clearInterval(dongHo); dongHo = null;
      henThang = setTimeout(thangCuoc, CHO_THANG_MS);
    }
    if (ketQua.event === 'mismatch') {
      amSai();
      henUpLaiCapSai(UP_LAI_MS);
    }
    bao('change');
  }

  /* ===== THẮNG CUỘC: PHÁO GIẤY + BẢNG THÀNH TÍCH + KỶ LỤC ===== */
  function thangCuoc() {
    henThang = null;
    nhacThang();
    banPhaoGiay();
    $('tgCuoi').textContent = dinhDangGio(state.seconds);
    $('luotCuoi').textContent = String(state.moves);

    const cu = docKyLuc(state.pairs);
    if (cu === null || state.seconds < cu) {
      ghiKyLuc(state.pairs, state.seconds);
      $('bangKyLuc').classList.add('hien');
      $('loiKhen').textContent = 'Bé nhớ giỏi hơn cả lần trước!';
    } else {
      $('loiKhen').textContent = 'Lần sau bé thử nhanh hơn kỷ lục nhé!';
    }
    $('kyLuc').textContent = dinhDangGio(docKyLuc(state.pairs));
    manThang.classList.add('hien');
    bao('win');
  }

  /* ===== HIỆU ỨNG PHÁO GIẤY PHỦ MÀN HÌNH (vẽ bằng Canvas) ===== */
  const canvas = $('phaoGiay');
  const ctx2d = canvas.getContext('2d');
  let hatGiay = [], vongLap = null;
  const MAU_GIAY = ['#FFB7C5', '#C9B6F5', '#FFE0A3', '#A8E6CF', '#BFE3FF', '#FFCBA4'];

  function banPhaoGiay() {
    canvas.style.display = 'block';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    hatGiay = [];
    for (let i = 0; i < 160; i += 1) {
      hatGiay.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        r: 5 + Math.random() * 7,
        mau: MAU_GIAY[Math.floor(Math.random() * MAU_GIAY.length)],
        rung: Math.random() * Math.PI * 2,
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

  /* ===== NÚT ĐIỀU KHIỂN ===== */
  $('mucDo').addEventListener('click', (event) => {
    const nut = event.target.closest('button');
    if (!nut) return;
    const cap = Number(nut.dataset.cap);
    if (!engine.PAIR_COUNTS.includes(cap)) return;
    batLoa(); keoChuong(880, 0.12, 0, 0.12);
    vanMoi(cap);
  });
  $('nutChoiLai').addEventListener('click', () => {
    keoChuong(880, 0.14, 0, 0.14);
    vanMoi();
  });
  window.addEventListener('resize', () => {
    canCot();
    if (canvas.style.display === 'block') {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });
  /* Chạm lần đầu để mở loa trên iPad/điện thoại */
  document.addEventListener('touchstart', batLoa, { once: true });

  /** Đổi bộ hình theo chủ đề: vẽ lại mặt trước các lá đang có, giữ nguyên ván. */
  function setCards(svgs) {
    if (!Array.isArray(svgs) || !svgs.length || !svgs.every((svg) => typeof svg === 'string')) return false;
    hinh = svgs.slice();
    [...sanBai.children].forEach(veMatTruoc);
    return true;
  }

  /* ===== API cho adapter tự lưu và lớp nội dung ===== */
  window.BongGame1 = Object.freeze({
    getState: () => state,
    serialize: () => engine.serialize(state),
    restore(saved) {
      const restored = engine.restore(saved);
      if (!restored || restored.deck.some((ma) => ma >= hinh.length)) return false;
      batDau(restored);
      return true;
    },
    newGame: vanMoi,
    pairs: () => state.pairs,
    moves: () => state.moves,
    seconds: () => state.seconds,
    canSave: () => engine.canSave(state),
    hasProgress: () => engine.hasProgress(state),
    setCards,
    /** Gọi một lần cho mỗi ván ghép đủ: sau khi màn thắng hiện, hoặc khi bé sang ván mới trước lúc đó. */
    onWin: (fn) => { nguoiNghe.win.push(fn); },
    /** Gọi sau mỗi lần lật lá hoặc úp lại cặp sai. */
    onChange: (fn) => { nguoiNghe.change.push(fn); }
  });

  if (window.BongGame1Content) setCards(window.BongGame1Content.cards.map((card) => card.svg));
  /* Bắt đầu ván đầu tiên theo mức đang chọn trên trang */
  vanMoi(Number(document.querySelector('#mucDo .dang-chon')?.dataset.cap) || 3);
})();
