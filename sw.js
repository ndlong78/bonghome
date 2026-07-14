/* =========================================================
   BÔNG HOME'S - Service Worker
   Nhiệm vụ: tải sẵn toàn bộ 10 trò chơi vào máy ngay lần mở đầu tiên,
   để những lần sau bé vẫn chơi được bình thường khi KHÔNG CÓ MẠNG.

   Lưu ý cho người lớn: mỗi khi sửa nội dung game, hãy đổi số PHIEN_BAN
   bên dưới (v1 → v2 → v3...) để máy tải lại bản mới.
   ========================================================= */

const PHIEN_BAN = "ngoi-truong-nho-v5";

/* Danh sách mọi thứ cần lưu vào máy */
const DANH_SACH_LUU = [
  "./",
  "./index.html",
  "./game1.html",
  "./game2.html",
  "./game3.html",
  "./game4.html",
  "./game5.html",
  "./game6.html",
  "./game7.html",
  "./game8.html",
  "./game9.html",
  "./game10.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

/* 1. CÀI ĐẶT: tải hết mọi file về kho lưu trữ của máy */
self.addEventListener("install", (sk) => {
  sk.waitUntil(
    caches.open(PHIEN_BAN).then((kho) =>
      /* Dùng addAll từng file để một file lỗi không làm hỏng cả bộ */
      Promise.all(
        DANH_SACH_LUU.map((duongDan) =>
          kho.add(new Request(duongDan, { cache: "reload" })).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* 2. KÍCH HOẠT: dọn sạch các phiên bản cũ để khỏi tốn bộ nhớ */
self.addEventListener("activate", (sk) => {
  sk.waitUntil(
    caches.keys().then((ten) =>
      Promise.all(
        ten.filter((t) => t !== PHIEN_BAN).map((t) => caches.delete(t))
      )
    ).then(() => self.clients.claim())
  );
});

/* 3. LẤY FILE: ưu tiên kho trong máy trước (chạy tức thì, không cần mạng),
      nếu chưa có thì mới ra mạng tải rồi lưu lại cho lần sau */
self.addEventListener("fetch", (sk) => {
  const yeuCau = sk.request;

  /* Chỉ xử lý các yêu cầu tải trang/tệp thông thường */
  if (yeuCau.method !== "GET") return;

  sk.respondWith(
    caches.match(yeuCau).then((daCo) => {
      if (daCo) return daCo;

      return fetch(yeuCau)
        .then((phanHoi) => {
          /* Lưu lại bản sao nếu tải thành công */
          if (phanHoi && phanHoi.status === 200 && phanHoi.type === "basic") {
            const banSao = phanHoi.clone();
            caches.open(PHIEN_BAN).then((kho) => kho.put(yeuCau, banSao));
          }
          return phanHoi;
        })
        .catch(() => {
          /* Mất mạng mà file chưa được lưu: đưa bé về trang chủ */
          if (yeuCau.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 503, statusText: "Không có mạng" });
        });
    })
  );
});
