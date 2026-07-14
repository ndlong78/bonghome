# 🌈 Bông Home's

Nền tảng web giáo dục gồm **10 trò chơi rèn trí não** cho bé gái 6 tuổi.
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
| `sw.js` | Service Worker — tải sẵn game vào máy để chơi khi mất mạng |
| `manifest.json` | Cho phép cài lên màn hình chính như một app |
| `icon-192.png` · `icon-512.png` · `apple-touch-icon.png` | Icon ứng dụng |
| `icon-maskable-512.png` | Icon "maskable" cho Android (chừa lề an toàn để không bị cắt khi bo tròn) |

---

## ▶️ Cách 1: Chơi ngay trên máy tính

Giải nén, nhấp đúp vào **`index.html`**. Xong. Không cần cài gì cả.

---

## 🌐 Cách 2: Đưa lên GitHub Pages

1. Tạo repo mới trên GitHub.
2. Tải **toàn bộ file** lên **thư mục gốc** của repo (không bỏ vào thư mục con).
3. Vào **Settings → Pages → Source: Deploy from a branch → main / (root)** → Save.
4. Đợi vài phút, link sẽ có dạng:
   `https://<tên-github>.github.io/<tên-repo>/`

> ⚠️ Tên file phân biệt hoa/thường trên máy chủ GitHub. Giữ nguyên chữ thường như hiện tại.

---

## 📱 Cách 3: Cài lên iPad như một app

1. Mở link GitHub Pages bằng **Safari**.
2. Đợi chân trang hiện **"✅ Đã sẵn sàng — chơi được cả khi không có mạng"**.
3. Bấm nút **Chia sẻ** → **Thêm vào MH chính**.
4. Xong! Icon cầu vồng xuất hiện trên màn hình. Mở ra là toàn màn hình, không thanh địa chỉ, **chạy được cả khi không có mạng**.

---

## 🔧 Khi bạn sửa nội dung game

Mở `sw.js`, đổi số phiên bản ở dòng đầu:

```js
const PHIEN_BAN = "ngoi-truong-nho-v1";   // → đổi thành "ngoi-truong-nho-v2"
```

Không đổi số này thì máy của bé vẫn chạy bản cũ đã lưu trong bộ nhớ.

---

## ✨ Đặc điểm kỹ thuật

- **Đơn file**: mỗi game gói trọn HTML + CSS + JavaScript trong 1 file `.html`
- **Không phụ thuộc bên ngoài**: không jQuery, không Bootstrap, không ảnh png/jpg từ mạng
- **Đồ họa tự vẽ**: toàn bộ nhân vật, mê cung, vật phẩm dựng bằng SVG / Canvas / CSS
- **Âm thanh tự sinh**: dùng Web Audio API tạo tần số trực tiếp, không có file mp3/wav
- **Thưởng**: pháo giấy phủ màn hình + chuỗi chimes + bảng thành tích + kỷ lục cá nhân
- **Cảm ứng & chuột**: dùng Pointer Events, chạy như nhau trên iPad và PC
- **Tôn trọng `prefers-reduced-motion`** cho bé nhạy cảm với chuyển động

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
