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

## Baseline tự động

`tests/accessibility-baseline.test.js` khóa các yêu cầu nền tảng trên cho toàn bộ 13 trang. Mục tiêu của test là ngăn hồi quy khi HTML hoặc module dùng chung tiếp tục được chỉnh sửa.

## Việc cần rà soát tiếp theo

Mỗi mục sẽ được xử lý trong PR nhỏ, độc lập:

1. Kiểm tra thứ tự focus và thao tác chỉ bằng bàn phím trong từng loại game.
2. Kiểm tra kích thước vùng chạm tối thiểu trên iPhone/iPad.
3. Kiểm tra độ tương phản chữ, trạng thái focus và trạng thái disabled.
4. Kiểm tra thông báo động bằng trình đọc màn hình, đặc biệt phần thưởng và auto-save.
5. Bổ sung kiểm thử E2E accessibility ở kích thước iPhone/iPad.

## Ngoài phạm vi PR này

PR baseline không thay đổi giao diện, gameplay, localStorage hoặc Service Worker. Các phát hiện cần sửa sẽ được tách thành PR riêng để dễ kiểm thử và rollback.
