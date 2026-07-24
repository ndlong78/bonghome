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
- Các nút điều khiển giao diện chung được kiểm tra vùng chạm tối thiểu 44×44px trên cấu hình iPhone 13 và iPad Mini.
- Focus bàn phím của các điều khiển chung được kiểm tra bằng phím Tab; focus ring phải có outline nhìn thấy, rộng tối thiểu 3px và tách khỏi nút tối thiểu 2px.
- Nút native `disabled` và nút tùy biến `aria-disabled="true"` có trạng thái trực quan thống nhất; nút tùy biến bị vô hiệu hóa không nhận thao tác chuột hoặc bàn phím.

## Baseline tự động

`tests/accessibility-baseline.test.js` khóa các yêu cầu nền tảng trên cho toàn bộ 13 trang. `tests/live-region-accessibility.test.js` ngăn hồi quy đối với thông báo động dành cho trình đọc màn hình. `tests/disabled-controls.test.js` khóa trạng thái disabled dùng chung. `e2e/touch-targets.spec.js` đo kích thước thực tế của các nút điều khiển chung trên iPhone/iPad. `e2e/focus-visible.spec.js` xác nhận focus ring khi điều hướng bằng bàn phím.

## Việc cần rà soát tiếp theo

Mỗi mục sẽ được xử lý trong PR nhỏ, độc lập:

1. Kiểm tra thứ tự focus và thao tác chỉ bằng bàn phím trong từng loại game.
2. Rà soát riêng vùng chạm của các vật thể gameplay có cơ chế kéo, thả hoặc chọn trực tiếp.
3. Kiểm tra độ tương phản chữ và các trạng thái màu phụ trợ.
4. Kiểm thử thực tế thông báo phần thưởng và auto-save với VoiceOver/TalkBack.
5. Mở rộng E2E accessibility cho các luồng tương tác hoàn chỉnh trên iPhone/iPad.

## Ngoài phạm vi baseline

Các phát hiện cần sửa tiếp tục được tách thành PR riêng để dễ kiểm thử và rollback. Không thay đổi dữ liệu hồ sơ, tiến độ hoặc phần thưởng trong quá trình audit.
