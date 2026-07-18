# Checklist kiểm thử thiết bị thật — Bông Home

> Mục tiêu: xác nhận trải nghiệm thực tế ngoài giả lập Playwright. Mỗi dòng cần ghi thiết bị, hệ điều hành, trình duyệt, người kiểm thử, ngày và kết quả.

## Ma trận tối thiểu

| Nhóm | Thiết bị đề nghị | Trình duyệt | Kết quả |
|---|---|---|---|
| iPad | iPadOS bản đang sử dụng | Safari | ☐ Pass ☐ Fail |
| iPhone | iOS bản đang sử dụng | Safari | ☐ Pass ☐ Fail |
| Android | Điện thoại Android phổ biến | Chrome | ☐ Pass ☐ Fail |
| Desktop Windows | Windows 11 | Chrome, Edge | ☐ Pass ☐ Fail |
| Desktop macOS | macOS | Safari, Chrome | ☐ Pass ☐ Fail |

## Luồng kiểm thử bắt buộc

1. Mở trang chủ khi có mạng; xác nhận không vỡ bố cục, không cuộn ngang.
2. Thêm site vào màn hình chính nếu thiết bị hỗ trợ PWA.
3. Chọn hồ sơ **Bông** và kiểm tra trạng thái được giữ sau khi đóng/mở trình duyệt.
4. Bắt đầu phiên 15 phút; xác nhận đồng hồ rõ, không che nút chơi.
5. Kết thúc sớm; xác nhận màn tổng kết dễ đọc và đóng được.
6. Bắt đầu phiên 20 phút; khóa màn hình 30 giây rồi mở lại; xác nhận thời gian còn lại hợp lý.
7. Mở đủ 10 lớp; kiểm tra nút, âm thanh, thao tác chạm và vùng bấm tối thiểu.
8. Tắt âm thanh; đổi trang; xác nhận trạng thái im lặng được giữ.
9. Mở trang phụ huynh; xác nhận tiến độ và lịch sử đúng hồ sơ.
10. Sau khi đã tải đủ, bật chế độ máy bay; mở lại ứng dụng và chơi ít nhất một lớp.
11. Xoay ngang/dọc trên điện thoại và máy tính bảng; kiểm tra modal, thanh phiên chơi và bản đồ tiến độ.
12. Tăng cỡ chữ hệ thống hoặc zoom trình duyệt lên 200%; xác nhận nội dung vẫn dùng được.
13. Bật Reduce Motion/Giảm chuyển động; xác nhận không có hiệu ứng gây khó chịu.
14. Dùng bàn phím trên máy tính: Tab qua các nút, Enter/Space kích hoạt, focus nhìn rõ.
15. Kiểm tra VoiceOver/TalkBack tối thiểu trên trang chủ và màn tổng kết.

## Ghi nhận lỗi

Mỗi lỗi cần có:

- Thiết bị, hệ điều hành và trình duyệt.
- URL/trang và các bước tái hiện.
- Kết quả mong đợi và kết quả thực tế.
- Ảnh chụp hoặc quay màn hình.
- Mức độ: Blocker / High / Medium / Low.
- Xác nhận đã kiểm tra lại sau khi sửa.

## Điều kiện phát hành

- Không còn lỗi Blocker hoặc High.
- Toàn bộ luồng chính Pass trên ít nhất một iPad, một iPhone, một Android và một máy tính.
- Chơi offline hoạt động sau lần tải đầu tiên.
- Không mất hồ sơ và tiến độ khi refresh hoặc đóng/mở trình duyệt.
- Không có cuộn ngang ở hướng dọc trên điện thoại.
- Các nút chính có thể thao tác bằng chạm và bàn phím.
