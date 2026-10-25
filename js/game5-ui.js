/*
 * Game 5 – Nối Điểm Theo Số: giao diện (SVG, âm thanh, chạm/bàn phím, pháo giấy).
 * Logic nằm trong js/game5-engine.js; tệp này chỉ gọi engine rồi vẽ lại.
 * window.BongGame5 là API cho adapter js/games5-7-autosave.js.
 */
(() => {
  'use strict';

  const engine = window.BongGame5Engine;
  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';

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
  /* Mỗi chấm nối đúng phát một nốt cao dần → bé nghe được "giai điệu đếm số" */
  const amNoiDung = (i, tong) => keoChuong(440 * Math.pow(2, (i / tong) * 1.2), 0.16, 0, 0.14);
  const amSai = () => keoChuong(196, 0.26, 0, 0.11, 'sine');
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));

  /* ===== TRẠNG THÁI ===== */
  const lopDiem = $('lopDiem');
  const duongNoi = $('duongNoi');
  const hinhTo = $('hinhTo');
  const oKeTiep = $('chamKeTiep');
  const oDongHo = $('dongHo');
  const oKyLuc = $('kyLuc');
  const manThang = $('manThang');

  let state = engine.createGame(engine.pickShape());
  let dongHoChay = null;
  /* Hẹn giờ của chuỗi "nối xong → tô màu → màn thắng"; hủy khi bé vẽ lại hoặc đổi hình giữa chừng. */
  let finishTimers = [];

  let kyLucTam = null;
  const docKyLuc = () => {
    try {
      const value = localStorage.getItem('kyluc_game5');
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      return kyLucTam;
    }
  };
  const ghiKyLuc = (seconds) => {
    try { localStorage.setItem('kyluc_game5', seconds); } catch (error) { kyLucTam = seconds; }
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

  const pointsAttr = (points) => points.map(([x, y]) => `${x},${y}`).join(' ');

  function taoCham([x, y], index) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'diem');
    g.setAttribute('data-i', String(index));
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `Chấm số ${index + 1}`);
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(x));
    circle.setAttribute('cy', String(y));
    circle.setAttribute('r', '13');
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y));
    text.textContent = String(index + 1);
    g.append(circle, text);
    g.addEventListener('click', (event) => chamVaoDiem(engine.resolveTap(state, index, diemCham(event), banKinhCham())));
    g.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      chamVaoDiem(index, g);
    });
    return g;
  }

  /** Tọa độ chạm theo khung 400x400 của SVG; null khi bấm bằng bàn phím (click không có vị trí chuột). */
  function diemCham(event) {
    const svg = lopDiem.ownerSVGElement;
    const matrix = svg?.getScreenCTM?.();
    if (!matrix || event.detail === 0) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  /* Bán kính vùng chạm do js/game5-touch-target.js thêm vào; chưa có thì dùng bán kính chấm. */
  const banKinhCham = () => window.BongGame5TouchTarget?.hitRadius ?? 13;

  /** Đồng bộ chấm, đường nối và bảng số với trạng thái hiện tại (dùng cho ván mới và khi khôi phục). */
  function veLai() {
    finishTimers.forEach(clearTimeout);
    finishTimers = [];
    const shape = engine.shapeOf(state);
    oDongHo.textContent = dinhDangGio(state.seconds);
    oKeTiep.textContent = String(state.position + 1);
    const kl = docKyLuc();
    oKyLuc.textContent = kl ? dinhDangGio(kl) : '--';

    duongNoi.setAttribute('points', pointsAttr(engine.connectedPoints(state)));
    hinhTo.setAttribute('d', '');
    hinhTo.classList.remove('hien');
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();

    lopDiem.replaceChildren(...shape.points.map(taoCham));
    capNhatCham();
  }

  function capNhatCham() {
    [...lopDiem.querySelectorAll('.diem')].forEach((dot, index) => {
      dot.classList.toggle('xong', index < state.position);
      dot.classList.toggle('ke-tiep', index === state.position);
    });
  }

  function batDau(next) {
    dungDongHo();
    state = next;
    veLai();
  }
  /** "Hình mới": bốc một hình khác hình đang vẽ. */
  const hinhMoi = () => batDau(engine.createGame(engine.pickShape(Math.random, state.shapeIndex)));
  /** "Vẽ lại": vẽ lại đúng hình đang có từ đầu. */
  const veLaiTuDau = () => batDau(engine.createGame(state.shapeIndex));

  /* ===== BÉ CHẠM VÀO MỘT CHẤM ===== */
  function chamVaoDiem(index, g = lopDiem.querySelector(`.diem[data-i="${index}"]`)) {
    batLoa();
    const result = engine.tap(state, index);
    if (result.event === 'ignored') return;
    state = result.state;
    if (result.startedNow) chayDongHo();

    if (result.event === 'wrong') {
      /* Chạm nhầm: báo nhẹ, không phạt gì cả. Mỗi lần chạm có hẹn giờ riêng. */
      amSai();
      g.classList.add('sai');
      setTimeout(() => g.classList.remove('sai'), 400);
      return;
    }

    /* Chạm đúng: nối thêm một đoạn thẳng */
    duongNoi.setAttribute('points', pointsAttr(engine.connectedPoints(state)));
    amNoiDung(index, engine.dotCount(state));
    capNhatCham();
    oKeTiep.textContent = result.event === 'completed' ? '✓' : String(state.position + 1);
    if (result.event === 'completed') {
      dungDongHo();
      finishTimers.push(setTimeout(veXong, 300));
    }
  }

  /* ===== NỐI XONG: khép kín và tô màu bức hình ===== */
  function veXong() {
    const shape = engine.shapeOf(state);
    duongNoi.setAttribute('points', pointsAttr([...shape.points, shape.points[0]])); /* nối chấm cuối về chấm 1 */
    hinhTo.setAttribute('d', `M${shape.points.map((point) => point.join(',')).join(' L')} Z`);
    hinhTo.setAttribute('fill', shape.fill);
    hinhTo.setAttribute('stroke', shape.stroke);
    hinhTo.setAttribute('stroke-width', '5');
    hinhTo.setAttribute('stroke-linejoin', 'round');
    finishTimers.push(setTimeout(() => hinhTo.classList.add('hien'), 80));
    finishTimers.push(setTimeout(thangCuoc, 700));
  }

  function thangCuoc() {
    nhacThang();
    banPhaoGiay();
    $('tieuDeThang').textContent = `Đó là ${engine.shapeOf(state).name}!`;
    $('tgCuoi').textContent = dinhDangGio(state.seconds);
    $('saiCuoi').textContent = String(state.wrong);
    const cu = docKyLuc();
    if (cu === null || state.seconds < cu) {
      ghiKyLuc(state.seconds);
      $('bangKyLuc').classList.add('hien');
      $('loiKhen').textContent = 'Bé đếm nhanh hơn lần trước rồi!';
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

  $('nutHinhMoi').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); hinhMoi(); });
  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); hinhMoi(); });
  $('nutLamLai').addEventListener('click', () => { keoChuong(660, 0.14, 0, 0.14); veLaiTuDau(); });
  window.addEventListener('resize', () => {
    if (canvas.style.display === 'block') { canvas.width = innerWidth; canvas.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  /* ===== API cho adapter tự lưu ===== */
  window.BongGame5 = Object.freeze({
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
    newShape: hinhMoi
  });

  veLai();
})();
