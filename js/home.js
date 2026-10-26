/*
 * Trang chủ: dựng 10 bảng hiệu lớp học, âm thanh khi rê/chạm, sao bay và huy hiệu trạng thái offline.
 * Tách khỏi index.html để CSP không cần 'unsafe-inline' cho script. Nạp không defer ở cuối <body>, đúng chỗ khối
 * <script> inline cũ, nên thứ tự chạy không đổi.
 */
/* =========================================================
   DỮ LIỆU 10 LỚP HỌC
   Mỗi lớp có: tên file, tên hiển thị, kỹ năng, màu viền, màu nền,
   nốt nhạc riêng (tần số Hz) và hình vẽ SVG tự tạo.
   ========================================================= */
const DANH_SACH = [
  { file:"game1.html",  ten:"Lật Hình Tìm Cặp",      kyNang:"Trí nhớ",        vien:"#FFB7C5", nen:"#FFF0F4", not:523.25 },
  { file:"game2.html",  ten:"Tìm Điểm Khác Biệt",    kyNang:"Tinh mắt",       vien:"#C9B6F5", nen:"#F3EFFF", not:587.33 },
  { file:"game3.html",  ten:"Tìm Bóng Cho Hình",     kyNang:"Hình khối",      vien:"#A8E6CF", nen:"#EAFBF3", not:659.25 },
  { file:"game4.html",  ten:"Gom Đồ Theo Màu",       kyNang:"Phân loại",      vien:"#FFCBA4", nen:"#FFF2E6", not:698.46 },
  { file:"game5.html",  ten:"Nối Điểm Theo Số",      kyNang:"Đếm số",         vien:"#BFE3FF", nen:"#EDF7FF", not:783.99 },
  { file:"game6.html",  ten:"Tìm Cặp Sinh Đôi",      kyNang:"Chú ý",          vien:"#FFE0A3", nen:"#FFF8E7", not:880.00 },
  { file:"game7.html",  ten:"Đoán Hình Tiếp Theo",   kyNang:"Quy luật",       vien:"#F5B6D2", nen:"#FFEFF6", not:987.77 },
  { file:"game8.html",  ten:"Mê Cung Về Nhà",        kyNang:"Tìm đường",      vien:"#B6D7F5", nen:"#EDF5FF", not:1046.50 },
  { file:"game9.html",  ten:"Nghe Truyện Tìm Từ",    kyNang:"Lắng nghe",      vien:"#D4C1F9", nen:"#F5F0FF", not:1174.66 },
  { file:"game10.html", ten:"Gõ Phím Theo Nhịp",     kyNang:"Nhanh tay",      vien:"#A8E6CF", nen:"#EAFBF3", not:1318.51 }
];

/* =========================================================
   HÌNH VẼ SVG CHO TỪNG LỚP (vẽ 100% bằng mã, không dùng ảnh)
   ========================================================= */
const HINH_VE = [
  /* 1. Hai lá bài úp - Lật hình tìm cặp */
  `<svg viewBox="0 0 64 64">
     <rect x="6" y="12" width="24" height="34" rx="5" fill="#C9B6F5" stroke="#9B85D6" stroke-width="3" transform="rotate(-9 18 29)"/>
     <rect x="34" y="14" width="24" height="34" rx="5" fill="#FFB7C5" stroke="#EE8FA8" stroke-width="3" transform="rotate(8 46 31)"/>
     <path d="M46 26 l3 6 6 .8 -4.5 4.4 1.1 6.3 -5.6-3 -5.6 3 1.1-6.3 -4.5-4.4 6-.8z" fill="#fff"/>
     <circle cx="18" cy="29" r="6" fill="#fff"/>
   </svg>`,

  /* 2. Kính lúp soi hai bức tranh - Tìm điểm khác biệt */
  `<svg viewBox="0 0 64 64">
     <rect x="5" y="12" width="24" height="30" rx="4" fill="#F3EFFF" stroke="#9B85D6" stroke-width="3"/>
     <rect x="35" y="12" width="24" height="30" rx="4" fill="#F3EFFF" stroke="#9B85D6" stroke-width="3"/>
     <circle cx="17" cy="24" r="5" fill="#FFE0A3"/>
     <circle cx="47" cy="24" r="5" fill="#FFE0A3"/>
     <path d="M10 38 l7-8 6 8z" fill="#A8E6CF"/>
     <circle cx="42" cy="44" r="12" fill="none" stroke="#7A4E86" stroke-width="4"/>
     <line x1="51" y1="53" x2="59" y2="60" stroke="#7A4E86" stroke-width="5" stroke-linecap="round"/>
   </svg>`,

  /* 3. Ngôi sao và cái bóng của nó - Tìm bóng cho hình */
  `<svg viewBox="0 0 64 64">
     <path d="M40 34 l5 11 12 1.6 -9 8.6 2.3 12.1 -10.3-5.8 -10.3 5.8 2.3-12.1 -9-8.6 12-1.6z" fill="#B6A3C9" opacity=".5" transform="translate(-8 -14)"/>
     <path d="M24 6 l5.6 11.8 12.9 1.7 -9.5 9 2.4 12.9 -11.4-6.2 -11.4 6.2 2.4-12.9 -9.5-9 12.9-1.7z" fill="#FFE0A3" stroke="#EDC46F" stroke-width="2.5" stroke-linejoin="round"/>
     <path d="M36 46 h20" stroke="#A8E6CF" stroke-width="4" stroke-linecap="round"/>
   </svg>`,

  /* 4. Cái giỏ đựng trái cây theo màu - Gom đồ theo màu */
  `<svg viewBox="0 0 64 64">
     <circle cx="20" cy="20" r="8" fill="#FFB7C5" stroke="#EE8FA8" stroke-width="2.5"/>
     <circle cx="40" cy="14" r="7" fill="#A8E6CF" stroke="#7FCFB0" stroke-width="2.5"/>
     <circle cx="52" cy="26" r="6" fill="#C9B6F5" stroke="#9B85D6" stroke-width="2.5"/>
     <path d="M8 34 h48 l-6 22 a4 4 0 0 1 -4 3 h-28 a4 4 0 0 1 -4 -3z" fill="#FFE0A3" stroke="#D9A85A" stroke-width="3" stroke-linejoin="round"/>
     <path d="M18 40 v14 M32 40 v16 M46 40 v14" stroke="#D9A85A" stroke-width="2.5" stroke-linecap="round"/>
   </svg>`,

  /* 5. Các chấm số nối thành đường - Nối điểm theo số */
  `<svg viewBox="0 0 64 64">
     <polyline points="12,48 22,18 42,12 54,40" fill="none" stroke="#BFE3FF" stroke-width="4" stroke-dasharray="5 5" stroke-linecap="round"/>
     <circle cx="12" cy="48" r="7" fill="#fff" stroke="#7FB6E8" stroke-width="3"/>
     <circle cx="22" cy="18" r="7" fill="#fff" stroke="#7FB6E8" stroke-width="3"/>
     <circle cx="42" cy="12" r="7" fill="#fff" stroke="#7FB6E8" stroke-width="3"/>
     <circle cx="54" cy="40" r="7" fill="#fff" stroke="#7FB6E8" stroke-width="3"/>
     <text x="12" y="52" font-size="10" font-weight="800" fill="#4E7FA8" text-anchor="middle">1</text>
     <text x="22" y="22" font-size="10" font-weight="800" fill="#4E7FA8" text-anchor="middle">2</text>
     <text x="42" y="16" font-size="10" font-weight="800" fill="#4E7FA8" text-anchor="middle">3</text>
     <text x="54" y="44" font-size="10" font-weight="800" fill="#4E7FA8" text-anchor="middle">4</text>
   </svg>`,

  /* 6. Lưới hình có hai trái tim giống nhau - Tìm cặp sinh đôi */
  `<svg viewBox="0 0 64 64">
     <rect x="6" y="6" width="52" height="52" rx="8" fill="#FFF8E7" stroke="#EDC46F" stroke-width="3"/>
     <line x1="23" y1="6" x2="23" y2="58" stroke="#EDC46F" stroke-width="2"/>
     <line x1="41" y1="6" x2="41" y2="58" stroke="#EDC46F" stroke-width="2"/>
     <line x1="6" y1="23" x2="58" y2="23" stroke="#EDC46F" stroke-width="2"/>
     <line x1="6" y1="41" x2="58" y2="41" stroke="#EDC46F" stroke-width="2"/>
     <path d="M14 17c-4-3-1-8 2-5 3-3 6 2 2 5l-2 2z" fill="#FFB7C5"/>
     <path d="M50 52c-4-3-1-8 2-5 3-3 6 2 2 5l-2 2z" fill="#FFB7C5"/>
     <circle cx="32" cy="14" r="5" fill="#A8E6CF"/>
     <rect x="27" y="45" width="10" height="10" rx="2" fill="#C9B6F5"/>
   </svg>`,

  /* 7. Chuỗi hình lặp lại và dấu hỏi - Quy luật chu kỳ */
  `<svg viewBox="0 0 64 64">
     <circle cx="11" cy="32" r="8" fill="#FFB7C5"/>
     <rect x="21" y="24" width="16" height="16" rx="3" fill="#A8E6CF"/>
     <circle cx="47" cy="32" r="8" fill="#FFB7C5"/>
     <rect x="6" y="46" width="52" height="14" rx="6" fill="#FFF" stroke="#EE8FA8" stroke-width="3" stroke-dasharray="5 4"/>
     <text x="32" y="58" font-size="13" font-weight="800" fill="#EE8FA8" text-anchor="middle">?</text>
     <text x="58" y="37" font-size="16" font-weight="800" fill="#C9B6F5" text-anchor="middle">?</text>
   </svg>`,

  /* 8. Mê cung có ngôi nhà - Mê cung tìm đường */
  `<svg viewBox="0 0 64 64">
     <rect x="5" y="5" width="54" height="54" rx="7" fill="#EDF5FF" stroke="#7FB6E8" stroke-width="3"/>
     <path d="M5 20 h30 M50 20 h9 M18 20 v18 M18 38 h22 M40 30 v22 M28 52 h-14 M40 38 h19" fill="none" stroke="#7FB6E8" stroke-width="3.5" stroke-linecap="round"/>
     <path d="M44 10 l7 6 v8 h-14 v-8z" fill="#FFB7C5" stroke="#EE8FA8" stroke-width="2"/>
     <circle cx="11" cy="50" r="4.5" fill="#C9B6F5"/>
   </svg>`,

  /* 9. Cuốn sách và nốt nhạc - Nghe truyện tìm từ */
  `<svg viewBox="0 0 64 64">
     <path d="M8 16 q12-5 24 0 v34 q-12-5-24 0z" fill="#F5F0FF" stroke="#9B85D6" stroke-width="3" stroke-linejoin="round"/>
     <path d="M32 16 q12-5 24 0 v34 q-12-5-24 0z" fill="#FFF" stroke="#9B85D6" stroke-width="3" stroke-linejoin="round"/>
     <path d="M14 26 h12 M14 34 h12 M38 26 h12" stroke="#C9B6F5" stroke-width="2.5" stroke-linecap="round"/>
     <circle cx="41" cy="46" r="5" fill="#FFB7C5"/>
     <path d="M46 46 v-13 l8-2.5 v13" fill="none" stroke="#EE8FA8" stroke-width="3" stroke-linecap="round"/>
     <circle cx="54" cy="43.5" r="5" fill="#FFB7C5"/>
   </svg>`,

  /* 10. Nốt nhạc rơi xuống phím cách - Gõ theo nhịp */
  `<svg viewBox="0 0 64 64">
     <circle cx="20" cy="14" r="6" fill="#C9B6F5"/>
     <path d="M25 14 v-9" stroke="#9B85D6" stroke-width="3" stroke-linecap="round"/>
     <circle cx="42" cy="28" r="6" fill="#FFB7C5"/>
     <path d="M47 28 v-9" stroke="#EE8FA8" stroke-width="3" stroke-linecap="round"/>
     <path d="M32 38 v8 M26 42 l6 5 6-5" fill="none" stroke="#A8E6CF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
     <rect x="6" y="50" width="52" height="10" rx="5" fill="#FFE0A3" stroke="#D9A85A" stroke-width="3"/>
   </svg>`
];

/* =========================================================
   ÂM THANH TỰ SINH BẰNG WEB AUDIO API (không dùng file ngoài)
   ========================================================= */
let boAmThanh = null;
function batLoa(){
  if(window.BongSound && !window.BongSound.isEnabled()) return null;
  if(!boAmThanh){
    const A = window.AudioContext || window.webkitAudioContext;
    if(A) boAmThanh = new A();
  }
  if(boAmThanh && boAmThanh.state === "suspended") boAmThanh.resume();
  return boAmThanh;
}

/* Phát một nốt chuông trong trẻo */
function keoChuong(tanSo, doDai = 0.35, treTho = 0, amLuong = 0.16){
  const ctx = batLoa();
  if(!ctx) return;
  const bd  = ctx.currentTime + treTho;
  const osc = ctx.createOscillator();
  const gain= ctx.createGain();
  osc.type = "triangle";           // âm mềm, tròn, dễ chịu với tai bé
  osc.frequency.setValueAtTime(tanSo, bd);
  gain.gain.setValueAtTime(0.0001, bd);
  gain.gain.exponentialRampToValueAtTime(amLuong, bd + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, bd + doDai);
  osc.connect(gain).connect(ctx.destination);
  osc.start(bd);
  osc.stop(bd + doDai + 0.05);
}

/* Chuỗi nhạc reo vui khi bé bước vào lớp học */
function nhacVaoLop(notGoc){
  keoChuong(notGoc,        0.18, 0);
  keoChuong(notGoc * 1.26, 0.18, 0.09);   // quãng ba trưởng
  keoChuong(notGoc * 1.5,  0.45, 0.18);   // quãng năm
}

/* =========================================================
   DỰNG 10 BẢNG HIỆU LÊN SÂN TRƯỜNG
   ========================================================= */
const san = document.getElementById("sanTruong");

DANH_SACH.forEach((lop, i) => {
  const a = document.createElement("a");
  a.className = "bang-hieu";
  a.href = lop.file;
  a.style.setProperty("--vien", lop.vien);
  a.style.setProperty("--nen",  lop.nen);
  a.setAttribute("aria-label", `Lớp ${i+1}: ${lop.ten}`);
  a.innerHTML = `
    <div class="so">${i + 1}</div>
    <div class="the">
      <div class="hinh">${HINH_VE[i]}</div>
      <div class="ten">${lop.ten}</div>
      <span class="ky-nang">${lop.kyNang}</span>
    </div>`;

  /* Rê chuột qua bảng: nghe nốt nhạc riêng của lớp đó
     (10 bảng xếp thành một thang âm leo dần từ thấp lên cao) */
  a.addEventListener("mouseenter", () => keoChuong(lop.not, 0.22, 0, 0.09));

  /* Chạm hoặc bấm vào bảng: reo nhạc, bắn sao rồi mở lớp học */
  a.addEventListener("click", (e) => {
    e.preventDefault();
    nhacVaoLop(lop.not);
    const o = a.getBoundingClientRect();
    banSao(o.left + o.width / 2, o.top + o.height / 2);
    setTimeout(() => { window.location.href = lop.file; }, 220);
  });

  san.appendChild(a);
});

/* Bắn vài ngôi sao lung linh tại vị trí bé vừa chạm */
function banSao(x, y){
  const hinhSao = ["⭐", "✨", "🌟", "💖"];
  for(let i = 0; i < 7; i++){
    const s = document.createElement("div");
    s.className = "sao-bay";
    s.textContent = hinhSao[i % hinhSao.length];
    s.style.left = (x + (Math.random() * 120 - 60)) + "px";
    s.style.top  = (y + (Math.random() * 60  - 30)) + "px";
    s.style.animationDelay = (Math.random() * 0.18) + "s";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}

/* Chạm lần đầu vào màn hình để "mở loa" trên iPad/điện thoại */
document.addEventListener("touchstart", batLoa, { once: true });
document.addEventListener("click",      batLoa, { once: true });

/* =========================================================
   CHẠY NGOẠI TUYẾN: nhờ Service Worker tải sẵn cả 10 trò chơi vào máy.
   Chỉ hoạt động khi mở qua https:// (ví dụ GitHub Pages).
   Mở trực tiếp bằng file:// thì trình duyệt không cho, nhưng lúc đó
   các file vốn đã nằm sẵn trong máy nên bé vẫn chơi offline bình thường.
   ========================================================= */
const huyHieu = document.getElementById("huyHieu");

if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  huyHieu.textContent = "⏳ Đang tải các lớp học về máy…";
  huyHieu.className = "huy-hieu hien dang-tai";

  /* pwa-ios.js đăng ký Service Worker cho mọi trang; ở đây chỉ chờ nó sẵn sàng.
     `ready` chỉ resolve khi đã cài xong toàn bộ tệp offline; cài lỗi thì shared-ui.js
     nhận CACHE_FAILED và báo trên huy hiệu này. */
  navigator.serviceWorker.ready.then(() => {
    huyHieu.textContent = "✅ Đã sẵn sàng — chơi được cả khi không có mạng";
    huyHieu.className = "huy-hieu hien";
  });
}

/* Báo cho bé biết khi máy vừa mất mạng: mọi thứ vẫn chạy ngon lành */
addEventListener("offline", () => {
  huyHieu.textContent = "📴 Không có mạng — bé vẫn chơi được nhé!";
  huyHieu.className = "huy-hieu hien dang-tai";
});
addEventListener("online", () => {
  huyHieu.textContent = "✅ Đã sẵn sàng — chơi được cả khi không có mạng";
  huyHieu.className = "huy-hieu hien";
});
