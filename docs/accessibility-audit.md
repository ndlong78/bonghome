# Accessibility audit baseline

Ngày rà soát: 24/07/2026

## Phạm vi

- Trang chủ `index.html`.
- Trang `parents.html` và `collection.html`.
- Game 1–10.
- Lớp giao diện dùng chung `shared-ui.js` và `pwa-quality.js`.

## Hiện trạng đã xác nhận

- Tất cả trang dùng `lang="vi"` và viewport có `viewport-fit=cover` cho iPhone/iPad.
- Game 1–10 có hộp hoàn thành dùng `role="dialog"`, `aria-modal`, tiêu đề được gắn nhãn và nhóm nút hành động.
- `pwa-quality.js` đưa focus vào hộp thắng, giữ phím Tab trong hộp, đặt phần nền ở trạng thái `inert` và trả focus khi đóng.
- Tất cả game có khai báo `prefers-reduced-motion`.
- Trang phụ huynh và Bộ sưu tập có landmark `main` được gắn nhãn bởi tiêu đề cấp 1.
- Các điều khiển tùy biến có `role="button"` được bổ sung `tabindex` và hỗ trợ Enter/Space qua module dùng chung.
- Các vùng thông báo phần thưởng, auto-save, tiếp tục chơi và cập nhật PWA được chuẩn hóa `aria-atomic="true"`, kể cả vùng được tạo động sau khi trang đã tải.
- Phần thưởng Game 1 khai báo trực tiếp `role="status"`, `aria-live="polite"` và `aria-atomic="true"` trước khi chèn nội dung; cập nhật phần thưởng không làm thay đổi focus hiện tại.
- Phần thưởng Game 2–4 khai báo trực tiếp đầy đủ `role="status"`, `aria-live="polite"` và `aria-atomic="true"` trước khi chèn nội dung; cập nhật phần thưởng không làm thay đổi focus hiện tại.
- Các nút điều khiển giao diện chung được kiểm tra vùng chạm tối thiểu 44×44px trên cấu hình iPhone 13 và iPad Mini.
- Focus bàn phím của các điều khiển chung được kiểm tra bằng phím Tab; focus ring phải có outline nhìn thấy, rộng tối thiểu 3px và tách khỏi nút tối thiểu 2px.
- Nút native `disabled` và nút tùy biến `aria-disabled="true"` dùng trạng thái trực quan chung, không thể kích hoạt nhầm.
- Chữ trên các nút điều khiển chung được đo bằng màu render thực tế và phải đạt tỷ lệ tương phản tối thiểu 4.5:1.
- Nhãn thống kê nhỏ trong Game 1–10 và chữ hướng dẫn dùng token `--bh-color-muted: #806987`; màu này đạt khoảng 4.62:1 trên nền kem và 4.9:1 trên nền trắng.
- Hộp tiếp tục Game 1 dùng màu chữ phụ qua token chung; hai nút tiếp tục/chơi lại đạt lần lượt khoảng 5.66:1 và 5.1:1 trên nền pastel tương ứng.
- Câu khen trong hộp hoàn thành Game 1–10 dùng token chữ phụ chung và đạt khoảng 4.9:1 trên nền trắng.
- Thông báo lưu tiến độ Game 1 dùng chữ `#3D7962` trên nền `#EAFBF3`, đạt khoảng 4.77:1.
- Game 1 dùng native button cho từng lá bài; trạng thái đang úp, đang mở và đã ghép đúng được đồng bộ bằng ARIA, lá đã ghép được loại khỏi thứ tự Tab.
- Game 2–4 có baseline thứ tự Tab cho các điều khiển chính; hộp thắng đang ẩn và điều khiển disabled không được nhận focus.
- Game 5–7 có baseline thứ tự Tab dựa trên điều khiển render thực tế; nút Về nhà đứng trước nội dung trò chơi và nút âm thanh đứng sau các điều khiển chính.
- Game 8–10 có baseline thứ tự Tab theo cùng hợp đồng render thực tế; phần tử ẩn và disabled bị bỏ qua.
- Game 2 có con trỏ bàn phím trên hai bức tranh: phím mũi tên di chuyển, Enter/Space chọn bằng luồng click hiện có, vị trí được thông báo qua live region.
- Game 3 hỗ trợ ghép hai bước bằng bàn phím: Enter/Space chọn hình màu, Tab tới bóng rồi Enter/Space để thả bằng luồng Pointer Events hiện có; hình và bóng đã ghép bị loại khỏi thứ tự Tab.
- Game 4 hỗ trợ gom đồ hai bước bằng bàn phím: Enter/Space chọn đồ vật, Tab tới giỏ cùng màu rồi Enter/Space để thả bằng luồng Pointer Events hiện có; đồ vật đã gom bị loại khỏi thứ tự Tab.
- Game 2 cấu hình mọi điểm khác biệt với đường kính vùng chạm tối thiểu 44 đơn vị trên viewBox 300×300; E2E quy đổi theo kích thước SVG render thật và yêu cầu đạt tối thiểu 44×44px trên iPhone/iPad.
- Game 3 giữ hình màu 96×96px và ô bóng 110×110px; Game 4 giữ đồ vật 74×74px và giỏ responsive theo lưới 4 cột/2 cột. E2E đo trực tiếp `boundingBox()` của mọi mục tiêu đang hiển thị và yêu cầu tối thiểu 44×44px.
- Game 5 giữ chấm nhìn thấy bán kính 13 nhưng bổ sung vòng chạm trong suốt bán kính 27; vòng chạm được dựng lại sau mỗi lần đổi hình và đạt tối thiểu 44×44px trên iPhone/iPad.
- Game 6 giữ ô nhỏ nhất 48×48px ở vòng dày nhất 6 cột trên chiều rộng iPhone 390px; Game 7 chuyển bốn lựa chọn sang lưới 2 cột dưới 520px và các lựa chọn render đều đạt tối thiểu 44×44px.
- Game 8 giữ bốn phím hướng 72×72px; Game 9 và Game 10 dùng nút gameplay toàn chiều rộng với vùng chạm lớn hơn đáng kể so với ngưỡng 44×44px trên iPhone/iPad.

## Baseline tự động

Các yêu cầu trên được kiểm trên trang thật (cây trợ năng, kích thước và màu đã render) cho cả 16 trang:

- **Quét axe-core:** `e2e/accessibility-axe.spec.js` — mọi trang (và hộp thoại thắng Game 1–10) không có vi phạm axe: landmark (`main` cho Game 1–10, live region nằm trong landmark), vai trò ARIA (lưới Game 11 có `role="row"`), tên truy cập khớp chữ nhìn thấy (emoji/hình trang trí `aria-hidden`), `dl` chỉ chứa `dt`/`dd`, không lồng điều khiển trong `role="img"`. Tạm tắt luật `color-contrast` cho tới khi sửa màu chữ nhạt (xem mục việc tiếp theo).
- **Cấu trúc:** `e2e/page-structure.spec.js` — `lang="vi"`, `viewport-fit=cover`, vùng nội dung chính có tên, hộp thoại thắng là modal có tên, điều khiển game 11–13 có tên, trang phụ huynh chỉ đọc.
- **Kiểu dùng chung:** `e2e/shared-styles.spec.js` — nút bị vô hiệu, vùng chạm và focus ring của `role="button"`, giảm chuyển động cho cả phần tử chèn sau khi tải.
- **Vùng chạm:** `e2e/touch-targets.spec.js` (điều khiển chung), `e2e/game2-gameplay-touch-targets.spec.js`, `e2e/games3-4-gameplay-touch-targets.spec.js`, `e2e/game5-touch-target.spec.js`, `e2e/games6-7-gameplay-touch-targets.spec.js`, `e2e/games8-10-gameplay-touch-targets.spec.js` (mục tiêu trong vùng chơi, đo bằng `boundingBox()`); `e2e/gameplay-layout.spec.js` (số cột theo bề rộng, phím hướng Game 8, nút toàn chiều rộng Game 9/10). Dữ liệu vùng chạm trong engine: `tests/game2-gameplay-touch-targets.test.js`, `tests/games6-7-gameplay-touch-targets.test.js`.
- **Focus và bàn phím:** `e2e/focus-visible.spec.js`, `e2e/games2-4-tab-order.spec.js`, `e2e/games5-7-tab-order.spec.js`, `e2e/games8-10-tab-order.spec.js`, `e2e/game2-keyboard-cursor.spec.js`, `e2e/game3-keyboard-matching.spec.js`, `e2e/game4-keyboard-sorting.spec.js`.
- **Tương phản (màu đã render):** `e2e/text-contrast.spec.js`, `e2e/stat-label-contrast.spec.js`, `e2e/instruction-text-contrast.spec.js`, `e2e/completion-message-contrast.spec.js`, `e2e/game1-resume-contrast.spec.js`, `e2e/game1-save-status-contrast.spec.js` (kèm `tests/game1-save-status-contrast.test.js`).
- **Live region:** `e2e/game1-reward-live-region.spec.js`, `e2e/games2-4-reward-live-region.spec.js` và các spec `*-autosave-live-region` / `*-reward-live-region` của game 5–10; khai báo live region trước khi chèn: `tests/reward-announcements.test.js`.
- **Giảm chuyển động:** `e2e/reduced-motion-all-pages.spec.js`.

## Quy ước viết regression test

- Kiểm tra hành vi hoặc hợp đồng ổn định, không khóa chi tiết triển khai ở tầng thấp hơn.
- Khi tài nguyên được tải qua module chung, kiểm tra chuỗi liên kết `trang → module chung → tài nguyên`, không yêu cầu trang nhúng trực tiếp tài nguyên.
- Không khóa cứng số phiên bản Service Worker hoặc tên cache đầy đủ; chỉ kiểm tra định dạng và tài nguyên cần được cache.
- E2E phải dựa trên số phần tử và trạng thái render thực tế, không dùng giới hạn cố định dễ sai khi giao diện mở rộng.
- Callback chạy trong trình duyệt không được phụ thuộc vào closure của Node/Playwright; ưu tiên API locator như `boundingBox()` khi chỉ cần kích thước phần tử.
- Khi kiểm tra ngưỡng kích thước render, thêm biên an toàn thay vì đặt runtime đúng sát 44px để tránh sai số làm tròn giữa các engine.
- Thông báo lỗi test phải nêu rõ trang, điều khiển hoặc hợp đồng bị vi phạm để sửa đúng nguyên nhân.

## Việc cần rà soát tiếp theo

Mỗi mục sẽ được xử lý trong PR nhỏ, độc lập:

1. Sửa 43 phần tử axe báo thiếu tương phản (chữ nhạt trên trang chủ, phụ huynh, Game 1–11 và hộp thắng), rồi bật lại luật `color-contrast` trong `e2e/accessibility-axe.spec.js`.
2. Kiểm thử thực tế thông báo phần thưởng và auto-save với VoiceOver/TalkBack cho Game 5–10.
3. Mở rộng E2E accessibility cho các luồng tương tác hoàn chỉnh trên iPhone/iPad.

## Ngoài phạm vi baseline

Các phát hiện cần sửa tiếp tục được tách thành PR riêng để dễ kiểm thử và rollback. Không thay đổi dữ liệu hồ sơ, tiến độ hoặc phần thưởng trong quá trình audit.