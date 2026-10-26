# 🌈 Bông Home's

Nền tảng web giáo dục gồm **13 trò chơi vui giúp bé luyện trí nhớ, quan sát và tư duy** cho bé gái 6 tuổi.
Toàn bộ chạy **offline 100%**, không cần mạng, không tải thư viện hay hình ảnh từ bên ngoài.

---

## 📦 Danh sách file

| File | Nội dung |
|---|---|
| `index.html` | Trang chủ — cũng là nơi nút "Về nhà" trong các game quay lại |
| `game1.html` | Lật Hình Tìm Cặp — *Trí nhớ ngắn hạn* |
| `game2.html` | Tìm Điểm Khác Biệt — *Quét thị giác chi tiết* |
| `game3.html` | Tìm Bóng Cho Hình — *Nhận diện hình học không gian* |
| `game4.html` | Gom Đồ Theo Màu — *Phân loại và phản xạ* |
| `game5.html` | Nối Điểm Theo Số — *Tư duy số học tuần tự* |
| `game6.html` | Tìm Cặp Sinh Đôi — *Chú ý có chọn lọc* |
| `game7.html` | Đoán Hình Tiếp Theo — *Tư duy quy luật trừu tượng* |
| `game8.html` | Mê Cung Về Nhà — *Giải quyết vấn đề* |
| `game9.html` | Nghe Truyện Tìm Từ — *Tập trung thính giác* |
| `game10.html` | Gõ Phím Theo Nhịp — *Phối hợp đa giác quan* |
| `game11.html` | Xếp Khối Thông Minh — *Tư duy không gian* (hết bàn có dọn hàng thì tính hoàn thành: 1–3 hàng 1★, 4–9 hàng 2★, từ 10 hàng 3★ và huy hiệu) |
| `game12.html` | Sudoku Vui Vẻ — *Suy luận logic* (bàn 4×4 hình trái cây, 6×6, 9×9) |
| `game13.html` | Cờ Ca-rô Tí Hon — *Tư duy chiến thuật* (tic-tac-toe 3×3: chơi với Gấu Bông Dễ/Vừa/Khó hoặc chơi cùng bạn) |
| `parents.html` | Góc phụ huynh — tiến độ, phần thưởng, thống kê; xóa dữ liệu (có cổng phụ huynh) |
| `collection.html` | Bộ sưu tập sticker và huy hiệu của bé |
| `sw.js` | Service Worker — tải sẵn game vào máy để chơi khi mất mạng |
| `manifest.json` | Cho phép cài lên màn hình chính như một app |
| `icon-192.png` · `icon-512.png` · `apple-touch-icon.png` | Icon ứng dụng |
| `icon-maskable-512.png` | Icon "maskable" cho Android (chừa lề an toàn để không bị cắt khi bo tròn) |

---

## ▶️ Chạy thử trên máy tính

Các game tải nội dung JSON bằng `fetch`, nên **phải mở qua một máy chủ web** (mở thẳng tệp bằng `file://` thì Game 11–13, chủ đề và Góc phụ huynh không tải được):

```bash
python3 -m http.server 4173
# mở http://127.0.0.1:4173/index.html
```

---

## 🌐 Triển khai (Cloudflare Workers – static assets)

Trang đang chạy tại **https://bong.no.id.vn**, triển khai bằng tích hợp Git của Cloudflare Workers mỗi khi `main` thay đổi.

| Tệp | Vai trò |
|---|---|
| `wrangler.jsonc` | Cấu hình Worker chỉ phục vụ tệp tĩnh (`assets.directory: "."`, `html_handling: "none"` để giữ đuôi `.html`) |
| `_redirects` | `/game1` → `/game1.html` (301), `/` → `index.html` |
| `_headers` | Header bảo mật (CSP, `nosniff`, chặn nhúng iframe) và `Cache-Control: no-cache` cho `sw.js` |
| `.assetsignore` | Không xuất bản tệp phát triển (`tests/`, `e2e/`, `scripts/`, `docs/`, cấu hình…) |

Sau khi deploy, chạy workflow **Production Deployment Smoke** (Actions → Run workflow). Workflow kiểm tra:
- mọi trang trả HTTP 200 và có header bảo mật;
- các đường dẫn không đuôi chuyển hướng đúng;
- `manifest.json` hợp lệ;
- `sw.js` đúng `PHIEN_BAN` của commit đang chạy (`expected_version: local`).

---

## 📱 Cài lên iPad như một app

1. Mở **https://bong.no.id.vn** bằng **Safari**.
2. Đợi huy hiệu **"✅ Đã sẵn sàng — chơi được cả khi không có mạng"** ở chân trang chủ.
3. Bấm **Chia sẻ** → **Thêm vào MH chính**.
4. Mở từ icon trên màn hình chính: toàn màn hình, chạy được khi không có mạng. Khi có bản mới, app hiện nút **"Cập nhật"**.

---

## 🔧 Khi sửa nội dung game

Mọi thay đổi tệp nằm trong danh sách offline của `sw.js` phải **đổi `PHIEN_BAN`** ở dòng đầu `sw.js`, theo dạng `bonghome-v<số tăng dần>-<mô-tả-ngắn>`:

```js
const PHIEN_BAN = "bonghome-v77-review-fixes";
```

Không đổi số này thì máy của bé vẫn chạy bản cũ đã lưu. Thêm tệp mới thì nhớ khai báo vào `TEP_SHELL`, `TEP_GAME` hoặc `TEP_NOI_DUNG` trong `sw.js` (CI kiểm tra mọi đường dẫn tồn tại).

**Rollback:** revert commit trên `main` rồi đổi `PHIEN_BAN` lên một số **mới hơn** (không dùng lại số cũ), để máy của bé nhận bản revert như một lần cập nhật.

---

## 💾 Dữ liệu của bé (chỉ lưu trên thiết bị)

- `bonghome:data`: tài liệu chính, có `schemaVersion`. Chứa hồ sơ, tiến độ, sao, sticker, huy hiệu và chủ đề (`js/storage.js`, `progress.js`, `rewards.js`, `profile.js`).
- **Khi dữ liệu hỏng:** chuỗi gốc được sao lưu vào `bonghome:data:corrupt:<thời điểm>` (giữ tối đa 3 bản) trước khi tạo tài liệu mới.
- **Khi thiết bị từ chối ghi** (đầy bộ nhớ): dữ liệu được giữ trong phiên và ghi lại ở lần sau. Góc phụ huynh hiện cảnh báo.
- **Lịch sử không phình mãi:** chỉ giữ chi tiết 500 lượt hoàn thành và 500 giao dịch sao gần nhất. Phần cũ hơn được cộng dồn, nên tổng số liệu không đổi.
- **Khóa ngoài tài liệu chính** phải theo quy ước (`tests/storage-keys.test.js` chặn khóa sai):
  - `kyluc_*`: kỷ lục;
  - `bonghome_game<N>_<tên>`: ván đang chơi dở;
  - `bonghome_sound_enabled`: thiết lập của thiết bị.
- **Góc phụ huynh** (`parents.html`): xóa lịch sử hoặc xóa toàn bộ dữ liệu của bé. Thao tác xóa yêu cầu trả lời một phép nhân (cổng phụ huynh).

---

## ✨ Đặc điểm kỹ thuật

- **Không phụ thuộc bên ngoài:** không framework, không CDN, không ảnh tải từ mạng. Đồ họa vẽ bằng SVG/Canvas/CSS, âm thanh tạo bằng Web Audio API.
- **Cấu trúc:**
  - Game 1–10: mỗi game một tệp HTML có script inline; lưu ván, phần thưởng và trợ năng được gắn thêm từ `js/` và `game1-*.js`.
  - Game 11–13: tách engine và giao diện trong `js/`, nội dung trong `content/games/`.
  - `docs/refactor-plan.md`: lộ trình đưa game 1–10 về cùng mô hình với game 11–13.
- **Offline:**
  - Mở trang: thử mạng tối đa 3 giây, quá thời gian thì mở bản trong máy.
  - Tệp đã tải sẵn: phục vụ thẳng từ cache.
  - Tệp khác: cache runtime, giới hạn 60 mục.
- **Cảm ứng và chuột:** dùng Pointer Events. Tôn trọng `prefers-reduced-motion`. Có kiểm tra tương phản, vùng chạm và focus bàn phím.

---

## 🧪 Kiểm thử

```bash
for f in tests/*.test.js; do node "$f" || exit 1; done   # unit test (Node 22)
npm ci && npx playwright install chromium
npm run test:e2e                                         # E2E: Desktop, iPhone 13, iPad Mini, iPad Upgrade
```

- Project **iPad Upgrade** (`e2e/version-upgrade.spec.js`) dựng bản phát hành trước từ lịch sử git, tạo dữ liệu bằng code cũ, nâng cấp lên bản hiện tại. Sau đó kiểm tra dữ liệu còn nguyên và app mở được khi mất mạng hoặc mạng chập chờn.
- **CI** (`.github/workflows/verification.yml`) chạy cả hai nhóm test trên mọi PR vào `main`. E2E chia hai phần chạy song song (`--shard=1/2`, `--shard=2/2`, mỗi phần 1 worker); check gom **iPhone and iPad E2E** chỉ đạt khi cả hai phần đạt.
- Chạy lại riêng một phần như CI: `CI=1 npx playwright test --shard=1/2`. Máy yếu hoặc sandbox hay crash Chromium khi tạo context: thêm `--workers=1`, chạy lại test lỗi bằng `--last-failed`.

---

## 🔊 Lưu ý riêng cho lớp 9 (Nghe Truyện Tìm Từ)

Lớp này đọc to bằng **giọng tiếng Việt có sẵn của thiết bị**. Game **chỉ đọc khi máy thật sự có giọng Việt** — nếu không, nó sẽ *im lặng* (để tránh giọng tiếng Anh đọc chữ Việt sai), nút loa hiện **"🔇 Máy chưa có giọng Việt"** và bé vẫn **đọc chữ trên màn hình** bình thường.

Cách cài giọng tiếng Việt:
- **iPad/iPhone:** Cài đặt → Trợ năng → Nội dung nói → Giọng nói → Tiếng Việt → tải về.
- **Android:** Cài đặt → Ngôn ngữ → Đầu ra chuyển văn bản thành giọng nói → cài gói giọng Tiếng Việt.
- **Windows:** Cài đặt → Thời gian & ngôn ngữ → Giọng nói → Thêm giọng nói → Tiếng Việt.

---

## 👨‍👩‍👧 Vài lời cho ba mẹ

- Mỗi ngày **2–3 lớp, khoảng 20 phút** là đủ. Não bé cần thời gian củng cố.
- Luôn **kết thúc buổi chơi bằng một ván thắng**. Cảm giác thành công là thứ giữ bé quay lại.
- Khi bé bí, đừng chỉ đáp án. Hãy hỏi *"Con thử nhìn lại xem?"* — chính lúc bé tự nghĩ mới là lúc não phát triển.
