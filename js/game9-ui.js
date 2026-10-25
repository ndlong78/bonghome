/*
 * Game 9 – Nghe Truyện Tìm Từ: giao diện (hẹn giờ hiện từ, đọc to bằng giọng Việt của máy,
 * âm thanh, nút bắt từ khoá, phím cách, pháo giấy). Logic nằm trong js/game9-engine.js.
 * window.BongGame9 là API cho adapter js/games8-10-autosave.js.
 */
(() => {
  'use strict';

  const engine = window.BongGame9Engine;
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
  const amChu = () => keoChuong(420, 0.05, 0, 0.05); /* tiếng lật trang rất nhẹ */
  const amDung = () => { keoChuong(784, 0.14, 0, 0.16); keoChuong(1046.5, 0.3, 0.09, 0.16); };
  const amNham = () => keoChuong(196, 0.26, 0, 0.11, 'sine');
  const amBoLo = () => keoChuong(260, 0.2, 0, 0.08, 'sine');
  const nhacThang = () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51]
    .forEach((n, i) => keoChuong(n, 0.45, i * 0.16, 0.18));

  /* ===== TRẠNG THÁI ===== */
  const oChu = $('chu');
  const sanKhau = $('sanKhau');
  const oTuKhoa = $('tuKhoa');
  const vachTien = $('vachTien');
  const oDung = $('soDung');
  const oLo = $('soLo');
  const oNham = $('soNham');
  const oKyLuc = $('kyLuc');
  const nutBat = $('nutBat');
  const nutLoa = $('nutLoa');
  const manThang = $('manThang');

  let state = null;
  let hen = null;
  let batLoaDoc = true; /* đọc to bằng giọng máy có sẵn của thiết bị */

  let kyLucTam = null;
  const docKyLuc = () => {
    try {
      const value = localStorage.getItem('kyluc_game9');
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      return kyLucTam;
    }
  };
  const ghiKyLuc = (score) => {
    try { localStorage.setItem('kyluc_game9', score); } catch (error) { kyLucTam = score; }
  };

  /* ===== TÌM GIỌNG ĐỌC TIẾNG VIỆT CÓ THẬT TRÊN MÁY =====
     Chỉ đọc to khi máy có sẵn giọng tiếng Việt. Nếu không, ta IM LẶNG thay vì để giọng tiếng Anh
     đọc chữ Việt sai — bé vẫn đọc chữ hiện trên màn hình bình thường. */
  let giongViet = null;
  let coGiongViet = false;

  function timGiongViet() {
    if (!('speechSynthesis' in window)) return;
    const ds = speechSynthesis.getVoices();
    /* Ưu tiên mã ngôn ngữ vi / vi-VN, sau đó tới tên có chữ "Vietnam" */
    giongViet = ds.find((v) => /^vi(\b|[-_])/i.test(v.lang))
      || ds.find((v) => /vi[eệ]t\s*nam|vietnamese/i.test(v.name))
      || null;
    coGiongViet = Boolean(giongViet);
    capNhatNutLoa();
  }

  /* Cập nhật nút loa theo tình trạng giọng đọc của thiết bị */
  function capNhatNutLoa() {
    if (!('speechSynthesis' in window) || !coGiongViet) {
      nutLoa.textContent = '🔇 Máy chưa có giọng Việt';
      nutLoa.disabled = true;
      nutLoa.title = 'Thiết bị chưa cài giọng đọc tiếng Việt nên game không đọc to (bé vẫn đọc chữ trên màn hình).';
    } else {
      nutLoa.disabled = false;
      nutLoa.removeAttribute('title');
      nutLoa.textContent = batLoaDoc ? '🔊 Đọc to: Bật' : '🔇 Đọc to: Tắt';
    }
  }

  /* Đọc to một từ bằng chính giọng tiếng Việt của máy (không tải gì từ mạng) */
  function docTo(tu) {
    if (!batLoaDoc || !coGiongViet) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(tu);
      u.voice = giongViet;
      u.lang = giongViet.lang || 'vi-VN';
      u.rate = 0.85;
      u.pitch = 1.15;
      speechSynthesis.speak(u);
    } catch (error) { /* máy không đọc được thì bé vẫn đọc chữ trên màn hình */ }
  }

  function hienBangSo() {
    oDung.textContent = String(state.correct);
    oLo.textContent = String(state.missed);
    oNham.textContent = String(state.wrong);
  }

  /** Đồng bộ màn hình với trạng thái mới (chuyện mới hoặc chuyện khôi phục). */
  function veLai() {
    clearTimeout(hen);
    oTuKhoa.textContent = engine.storyOf(state).keyword;
    hienBangSo();
    const kl = docKyLuc();
    oKyLuc.textContent = kl !== null ? String(kl) : '--';
    nutBat.disabled = !state.running;
    manThang.classList.remove('hien');
    $('bangKyLuc').classList.remove('hien');
    dungPhaoGiay();
    capNhatNutLoa();
  }

  /* ===== BẮT ĐẦU MỘT CÂU CHUYỆN ===== */
  function chuyenMoi() {
    batLoa();
    state = engine.start();
    veLai();
    vachTien.style.width = '0';
    oChu.textContent = 'Chuẩn bị…';
    oChu.classList.remove('la-tu-khoa');
    hen = setTimeout(hienTu, engine.READY_MS);
  }

  /* ===== HIỆN TỪNG TỪ ===== */
  function hienTu() {
    state = engine.reveal(state);
    if (state.finished) {
      ketThuc();
      return;
    }
    veTu();
    amChu();
    hen = setTimeout(hetTu, engine.WORD_MS);
  }

  function veTu() {
    const tu = engine.currentWord(state);
    const story = engine.storyOf(state);
    oChu.textContent = tu;
    oChu.classList.toggle('la-tu-khoa', engine.isKeyword(state));
    /* Ép chạy lại hoạt hình xuất hiện chữ */
    oChu.style.animation = 'none';
    void oChu.offsetWidth;
    oChu.style.animation = '';
    docTo(tu);
    vachTien.style.width = `${((state.index + 1) / story.words.length) * 100}%`;
  }

  /* Hết thời gian của từ đang hiện: nếu là từ khoá mà bé không bấm → bỏ lỡ */
  function hetTu() {
    const result = engine.expire(state);
    state = result.state;
    if (result.missed) {
      oLo.textContent = String(state.missed);
      amBoLo();
    }
    hienTu();
  }

  /* ===== BÉ BẤM NÚT BẮT TỪ KHOÁ ===== */
  function bam() {
    batLoa();
    if (!state) return;
    const result = engine.tap(state);
    if (result.event === 'ignored') return;
    state = result.state;
    hienBangSo();
    if (result.event === 'correct') {
      amDung();
      nhayNen('bat-dung');
    } else {
      amNham();
      nhayNen('bat-nham');
    }
  }
  function nhayNen(lop) {
    sanKhau.classList.add(lop);
    setTimeout(() => sanKhau.classList.remove(lop), 260);
  }

  /* ===== KẾT THÚC CÂU CHUYỆN ===== */
  function ketThuc() {
    nutBat.disabled = true;
    clearTimeout(hen);
    oChu.textContent = 'Hết chuyện!';
    oChu.classList.remove('la-tu-khoa');

    const tongKhoa = engine.totalKeywords(state);
    const diem = engine.score(state);
    $('dungCuoi').textContent = `${state.correct}/${tongKhoa}`;
    $('loCuoi').textContent = String(state.missed);
    $('diemCuoi').textContent = String(diem);

    if (state.correct === tongKhoa && state.wrong === 0) {
      $('tieuDeThang').textContent = 'Tai bé thính quá!';
      $('loiKhen').textContent = 'Bé bắt trọn từ khoá, không sót từ nào!';
    } else {
      $('tieuDeThang').textContent = 'Bé nghe giỏi lắm!';
      $('loiKhen').textContent = `Lần sau bé thử bắt trọn cả ${tongKhoa} từ nhé!`;
    }

    const cu = docKyLuc();
    if (cu === null || diem > cu) {
      ghiKyLuc(diem);
      $('bangKyLuc').classList.add('hien');
    }
    oKyLuc.textContent = String(docKyLuc());

    nhacThang();
    banPhaoGiay();
    manThang.classList.add('hien');
  }

  /* ===== NÚT & PHÍM ===== */
  nutBat.addEventListener('click', bam);
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' && event.key !== ' ') return;
    // Đang kể chuyện: phím cách là nút bắt từ khoá. Chưa kể: để phím cách bấm được nút đang được chọn
    // ("Bắt đầu kể chuyện", "Đọc to"…); chỉ chặn cuộn trang khi không đứng trên nút hay liên kết.
    if (state?.running) {
      event.preventDefault();
      bam();
    } else if (!event.target?.closest?.('button, a, input, select, textarea')) {
      event.preventDefault();
    }
  });
  $('nutBatDau').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); chuyenMoi(); });
  $('nutChoiLai').addEventListener('click', () => { keoChuong(880, 0.14, 0, 0.14); chuyenMoi(); });
  nutLoa.addEventListener('click', () => {
    if (!coGiongViet) return; /* không có giọng Việt thì nút đã bị khoá */
    batLoaDoc = !batLoaDoc;
    capNhatNutLoa();
    if (!batLoaDoc && 'speechSynthesis' in window) speechSynthesis.cancel();
    keoChuong(660, 0.12, 0, 0.12);
  });

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
    for (let k = 0; k < 160; k += 1) {
      hatGiay.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        r: 5 + Math.random() * 7,
        mau: MAU_GIAY[k % MAU_GIAY.length],
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

  window.addEventListener('resize', () => {
    if (canvas.style.display === 'block') { canvas.width = innerWidth; canvas.height = innerHeight; }
  });
  document.addEventListener('touchstart', batLoa, { once: true });

  if ('speechSynthesis' in window) {
    timGiongViet();
    /* Danh sách giọng thường nạp bất đồng bộ → nghe sự kiện để dò lại */
    speechSynthesis.addEventListener('voiceschanged', timGiongViet);
  } else {
    capNhatNutLoa();
  }

  /* ===== API cho adapter tự lưu ===== */
  window.BongGame9 = Object.freeze({
    getState: () => state,
    serialize: (sessionId) => engine.serialize(state, sessionId, batLoaDoc),
    restore(saved) {
      const restored = engine.restore(saved);
      if (!restored) return false;
      state = restored.state;
      batLoaDoc = restored.readAloud;
      veLai();
      // Như bản cũ: hiện lại ngay từ đang dở và đếm tiếp thời gian của từ đó.
      veTu();
      if (state.running) hen = setTimeout(hetTu, engine.WORD_MS);
      return true;
    },
    canSave: () => Boolean(state) && engine.canSave(state),
    moves: () => (state ? engine.moves(state) : 0),
    seconds: () => (state ? engine.seconds(state) : 0),
    start: chuyenMoi
  });

  /* Hiện sẵn từ khoá của một chuyện để bé xem trước khi bấm Bắt đầu */
  oTuKhoa.textContent = engine.STORIES[0].keyword;
})();
