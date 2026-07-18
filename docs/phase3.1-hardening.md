# Giai đoạn 3.1 — Hardening

Mục tiêu của giai đoạn này là làm cho nền tảng Giai đoạn 3 đáng tin cậy hơn trước khi merge và phát triển thêm tính năng.

## Đợt 1

- Sửa GitHub Actions không còn phụ thuộc npm cache khi chưa có lockfile.
- Cài Chromium, Firefox và WebKit trong CI.
- Chạy iPhone/iPad bằng WebKit thay vì chỉ mô phỏng viewport trên Chromium.
- Bắt lỗi JavaScript runtime trong Playwright.
- Smoke test đủ 10 game.
- Thêm kiểm tra cơ bản cho game lật hình ở mức dễ.

## Đợt tiếp theo

- Chuẩn hóa audio engine dùng chung.
- Loại bỏ HTML injection từ dữ liệu hồ sơ.
- Thêm HTML validation và accessibility automation.
- Làm sạch build artifact theo whitelist.
- Cải thiện chiến lược cập nhật Service Worker giữa phiên chơi.
