/*
 * Game 2 – Tìm Điểm Khác Biệt: giao diện (vẽ hai bức tranh SVG, âm thanh, gợi ý, pháo giấy).
 * Logic nằm trong js/game2-engine.js; tệp này chỉ gọi engine rồi vẽ lại.
 * Con trỏ bàn phím (js/game2-keyboard-cursor.js) vẫn gắn lên hai tranh như trước.
 * window.BongGame2 là API cho adapter js/games2-4-autosave.js.
 */
(() => {
  'use strict';

  const engine = window.BongGame2Engine;
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
  function keoChuong(tanSo, doDai = 0.3, treTho = 0, amLuong = 0.16, dang = 'triangle') {
    const ctx = batLoa();
    if (!ctx) return;
    const bd = ctx.currentTime + treTho;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = dang;
    osc.frequency.setValueAtTime(tanSo, bd);
    gain.gain.setValueAtTime(0.0001, bd);
    gain.gain.exponentialRampToValueAtTime(amLuong, bd + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, bd + doDai);
    osc.connect(gain).connect(ctx.destination);
    osc.start(bd);
    osc.stop(bd + doDai + 0.05);
  }
  const amDung = () => { keoChuong(784, 0.15, 0, 0.16); keoChuong(1046.5, 0.32, 0.10, 0.16); };
  const amSai = () => keoChuong(196, 0.26, 0, 0.11, 'sine'); // âm trầm dịu, không doạ bé
  const amGoiY = () => { keoChuong(659, 0.12, 0, 0.13); keoChuong(659, 0.12, 0.16, 0.13); };
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));

  /* ===== HÌNH VẼ TỪNG VẬT: bản gốc (tranh 1) và bản "khác" (tranh 2 khi vật này là điểm khác) =====
     Chuỗi SVG hằng trong mã, không dùng ảnh ngoài và không bao giờ dựng từ dữ liệu lưu. */
  const VE = {
    matTroi: (k) => (k
      ? '<circle cx="44" cy="44" r="20" fill="#FFB7C5" stroke="#E9799C" stroke-width="3"/>' /* mặt trời đổi sang màu hồng */
      : `<circle cx="44" cy="44" r="20" fill="#FFE0A3" stroke="#E0A94F" stroke-width="3"/>
         <g stroke="#E0A94F" stroke-width="3" stroke-linecap="round">
           <line x1="44" y1="12" x2="44" y2="4"/><line x1="44" y1="84" x2="44" y2="76"/>
           <line x1="12" y1="44" x2="4" y2="44"/><line x1="84" y1="44" x2="76" y2="44"/>
         </g>`),
    may: (k) => (k
      ? '' /* đám mây biến mất */
      : `<g fill="#FFFFFF" stroke="#D9E6F2" stroke-width="3">
           <circle cx="216" cy="44" r="15"/><circle cx="238" cy="36" r="19"/><circle cx="258" cy="46" r="13"/>
         </g>`),
    ngoiSao: (k) => (k
      ? '' /* ngôi sao biến mất */
      : `<path d="M132 20 l4.5 9.4 10.3 1.3 -7.6 7.2 1.9 10.3 -9.1-5 -9.1 5 1.9-10.3 -7.6-7.2 10.3-1.3z"
               fill="#FFF0B5" stroke="#EDC46F" stroke-width="2.5" stroke-linejoin="round"/>`),
    /* cửa ra vào đổi từ tím sang xanh mint */
    nhaKeo: (k) => `
      <rect x="120" y="170" width="60" height="46" rx="6" fill="#FFF3E0" stroke="#DCB88F" stroke-width="3"/>
      <path d="M112 172 L150 142 L188 172 Z" fill="#FFB7C5" stroke="#E9799C" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="150" cy="160" r="5" fill="#FFE0A3"/>
      <rect x="140" y="190" width="20" height="26" rx="5"
            fill="${k ? '#A8E6CF' : '#C9B6F5'}" stroke="${k ? '#7FCFB0' : '#9B85D6'}" stroke-width="2"/>`,
    /* sừng kỳ lân đổi từ tím sang vàng */
    kyLan: (k) => `
      <path d="M36 212c0-14 9-22 22-22 11 0 17 7 17 15 0 9-7 15-17 15H42a6 6 0 0 1-6-8z"
            fill="#FFFFFF" stroke="#E9A9C6" stroke-width="3"/>
      <path d="M66 192 l3-15 6 13z"
            fill="${k ? '#FFE0A3' : '#C9B6F5'}" stroke="${k ? '#EDC46F' : '#9B85D6'}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="68" cy="202" r="2.6" fill="#6B4E71"/>
      <path d="M42 198 q-8 4-6 16 q6-4 10-8z" fill="#FFB7C5"/>`,
    buom: (k) => (k
      ? '' /* con bướm bay mất */
      : `<path d="M235 126 C227 114 214 114 218 125 C213 133 226 141 235 128z" fill="#C9B6F5" stroke="#9B85D6" stroke-width="2"/>
         <path d="M237 126 C245 114 258 114 254 125 C259 133 246 141 237 128z" fill="#FFB7C5" stroke="#E9799C" stroke-width="2"/>
         <rect x="234.5" y="116" width="3" height="20" rx="1.5" fill="#FFE0A3" stroke="#E0A94F" stroke-width="1.5"/>`),
    /* trái trên cây đổi từ hồng sang vàng */
    cay: (k) => `
      <rect x="250" y="212" width="12" height="34" rx="4" fill="#D9A87E" stroke="#B8865C" stroke-width="2.5"/>
      <circle cx="256" cy="200" r="28" fill="#A8E6CF" stroke="#7FCFB0" stroke-width="3"/>
      <circle cx="245" cy="194" r="5" fill="${k ? '#FFE0A3' : '#FFB7C5'}"/>
      <circle cx="266" cy="204" r="5" fill="${k ? '#FFE0A3' : '#FFB7C5'}"/>
      <circle cx="258" cy="186" r="5" fill="${k ? '#FFE0A3' : '#FFB7C5'}"/>`,
    /* bông hoa đổi từ hồng sang tím */
    hoaTrai: (k) => `
      <line x1="26" y1="286" x2="26" y2="266" stroke="#7FCFB0" stroke-width="3" stroke-linecap="round"/>
      <g fill="${k ? '#C9B6F5' : '#FFB7C5'}" stroke="${k ? '#9B85D6' : '#E9799C'}" stroke-width="2">
        <circle cx="26" cy="254" r="7"/><circle cx="16" cy="262" r="7"/>
        <circle cx="36" cy="262" r="7"/><circle cx="26" cy="270" r="7"/>
      </g>
      <circle cx="26" cy="262" r="5" fill="#FFE0A3"/>`,
    meoCon: (k) => (k
      ? '' /* chú mèo trốn mất */
      : `<path d="M186 250 L184 240 l9 5z" fill="#FFCBA4" stroke="#D99A6C" stroke-width="2" stroke-linejoin="round"/>
         <path d="M206 250 L208 240 l-9 5z" fill="#FFCBA4" stroke="#D99A6C" stroke-width="2" stroke-linejoin="round"/>
         <circle cx="196" cy="264" r="14" fill="#FFE3CC" stroke="#D99A6C" stroke-width="3"/>
         <circle cx="191" cy="262" r="2.2" fill="#6B4E71"/>
         <circle cx="201" cy="262" r="2.2" fill="#6B4E71"/>
         <path d="M196 268 l-2.5 2.5 2.5 2 2.5-2z" fill="#FFB7C5"/>`),
    /* cây nấm đổi mũ từ hồng sang xanh */
    nam: (k) => `
      <rect x="90" y="266" width="12" height="16" rx="5" fill="#FFF3E0" stroke="#DCB88F" stroke-width="2"/>
      <path d="M76 266 a20 14 0 0 1 40 0z"
            fill="${k ? '#BFE3FF' : '#FF9FB3'}" stroke="${k ? '#7FB6E8' : '#E9799C'}" stroke-width="2.5"/>
      <circle cx="88" cy="258" r="3" fill="#fff"/><circle cx="104" cy="261" r="2.5" fill="#fff"/>`
  };
  const NEN = `
    <rect x="0" y="0" width="300" height="300" fill="#EAF6FF"/>
    <path d="M0 226 Q150 206 300 226 L300 300 L0 300 Z" fill="#C8EFD8"/>
    <path d="M0 244 Q150 228 300 244" fill="none" stroke="#A8E6CF" stroke-width="4"/>`;

  /** Phân tích chuỗi SVG hằng trong <template> (nội dung trơ) rồi lấy các nút con của <svg>. */
  function tuMau(svgInner) {
    const holder = document.createElement('template');
    holder.innerHTML = `<svg xmlns="${SVG_NS}">${svgInner}</svg>`;
    return [...holder.content.firstElementChild.childNodes];
  }

  /* ===== TRẠNG THÁI ===== */
  const tranhA = $('tranhA');
  const tranhB = $('tranhB');
  const oTim = $('soTimDuoc');
  const oDongHo = $('dongHo');
  const oKyLuc = $('kyLuc');
  const nutGoiY = $('nutGoiY');
  const manThang = $('manThang');

  let state = engine.createGame();
  let dongHoChay = null;
  /* Hẹn giờ hiện màn thắng; hủy khi bé bấm "Tranh mới" giữa chừng. */
  let winTimer = null;

  let kyLucTam = null;
  function docKyLuc() {
    try {
      const value = localStorage.getItem('kyluc_game2');
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      return kyLucTam;
    }
  }
  function ghiKyLuc(seconds) {
    try { localStorage.setItem('kyluc_game2', seconds); } catch (error) { kyLucTam = seconds; }
  }
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

  /* ===== VẼ MỘT BỨC TRANH: dsKhac = id các vật vẽ ở bản "khác" ===== */
  function veTranh(svg, dsKhac) {
    const vatVe = engine.OBJECTS.map((item) => VE[item.id](dsKhac.includes(item.id))).join('');
    const lop = document.createElementNS(SVG_NS, 'g');
    lop.setAttribute('class', 'lop-danh-dau');
    svg.replaceChildren(...tuMau(NEN + vatVe), lop);
  }

  function capNhatGoiY() {
    nutGoiY.textContent = state.hintsLeft > 0 ? `💡 Gợi ý (còn ${state.hintsLeft})` : '💡 Hết gợi ý';
    nutGoiY.disabled = state.hintsLeft === 0;
  }

  /** Dựng lại hai tranh và bảng số từ trạng thái hiện tại (ván mới và khi khôi phục). */
  function veLai() {
    clearTimeout(winTimer);
    veTranh(tranhA, []); /* tranh 1: bản gốc */
    veTranh(tranhB, state.differences); /* tranh 2: bản đã đổi 5 chỗ */
    state.found.forEach((id) => danhDauDung(engine.objectById(id)));
    oTim.textContent = `${state.found.length}/${engine.DIFFERENCE_COUNT}`;
    oDongHo.textContent = dinhDangGio(state.seconds);
    const kl = docKyLuc();
    oKyLuc.textContent = kl ? dinhDangGio(kl) : '--';
    capNhatGoiY();
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();
  }

  function batDau(next) {
    dungDongHo();
    state = next;
    veLai();
  }
  const vanMoi = () => batDau(engine.createGame());

  /* ===== BÉ CHẠM VÀO TRANH ===== */
  function chamVaoTranh(event, svg) {
    batLoa();
    /* Đổi toạ độ màn hình sang toạ độ trong tranh (viewBox 300x300) */
    const o = svg.getBoundingClientRect();
    const diem = event.touches ? event.touches[0] : event;
    const x = ((diem.clientX - o.left) / o.width) * 300;
    const y = ((diem.clientY - o.top) / o.height) * 300;

    const result = engine.tap(state, x, y);
    if (result.event === 'ignored') return;
    state = result.state;
    if (result.startedNow) chayDongHo();

    if (result.event === 'wrong') {
      veDauSai(svg, x, y);
      amSai();
      return;
    }
    danhDauDung(result.object);
    amDung();
    oTim.textContent = `${state.found.length}/${engine.DIFFERENCE_COUNT}`;
    if (result.event === 'completed') {
      dungDongHo();
      winTimer = setTimeout(thangCuoc, 600);
    }
  }

  function vongTron(vat, r, lop) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(vat.x));
    c.setAttribute('cy', String(vat.y));
    c.setAttribute('r', String(r));
    c.setAttribute('class', lop);
    return c;
  }

  /* Khoanh vòng xanh lên CẢ HAI tranh để bé thấy rõ */
  function danhDauDung(vat) {
    [tranhA, tranhB].forEach((svg) => svg.querySelector('.lop-danh-dau').appendChild(vongTron(vat, vat.r, 'vong-dung')));
  }

  /* Dấu X đỏ nhạt hiện thoáng qua rồi tự tan */
  function veDauSai(svg, x, y) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'dau-sai');
    [[x - 9, y - 9, x + 9, y + 9], [x + 9, y - 9, x - 9, y + 9]].forEach(([x1, y1, x2, y2]) => {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      g.appendChild(line);
    });
    svg.querySelector('.lop-danh-dau').appendChild(g);
    setTimeout(() => g.remove(), 700);
  }

  /* ===== GỢI Ý: nhấp nháy vòng vàng quanh 1 điểm chưa tìm ra ===== */
  nutGoiY.addEventListener('click', () => {
    batLoa();
    const result = engine.hint(state);
    if (!result.object) return;
    state = result.state;
    amGoiY();
    [tranhA, tranhB].forEach((svg) => {
      const c = vongTron(result.object, result.object.r + 4, 'goi-y');
      svg.querySelector('.lop-danh-dau').appendChild(c);
      setTimeout(() => c.remove(), 2900);
    });
    capNhatGoiY();
  });

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
      $('loiKhen').textContent = 'Bé nhìn nhanh hơn lần trước rồi!';
    } else {
      $('loiKhen').textContent = 'Lần sau bé thử phá kỷ lục nhé!';
    }
    oKyLuc.textContent = dinhDangGio(docKyLuc());
    manThang.classList.add('hien');
  }

  /* ===== PHÁO GIẤY PHỦ MÀN HÌNH (Canvas) ===== */
  const canvas = $('phaoGiay');
  const ctx2d = canvas.getContext('2d');
  let hatGiay = [];
  let vongLap = null;
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

  /* ===== GẮN SỰ KIỆN ===== */
  tranhA.addEventListener('click', (event) => chamVaoTranh(event, tranhA));
  tranhB.addEventListener('click', (event) => chamVaoTranh(event, tranhB));
  $('nutVanMoi').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); vanMoi(); });
  window.addEventListener('resize', () => {
    if (canvas.style.display === 'block') { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* ===== API cho adapter tự lưu ===== */
  window.BongGame2 = Object.freeze({
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

  /* Bắt đầu ván đầu tiên */
  veLai();
})();
