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
- Nút native `disabled` và nút tùy biến `aria-disabled="true"` dùng trạng thái trực quan chung, không thể kích hoạt nhầm.
- Chữ trên các nút điều khiển chung được đo bằng màu render thực tế và phải đạt tỷ lệ tương phản tối thiểu 4.5:1.
- Game 1 dùng native button cho từng lá bài; trạng thái đang úp, đang mở và đã ghép đúng được đồng bộ bằng ARIA, lá đã ghép được loại khỏi thứ tự Tab.
- Game 2–4 có baseline thứ tự Tab cho các điều khiển chính; hộp thắng đang ẩn và điều khiển disabled không được nhận focus.
- Game 5–7 có baseline thứ tự Tab dựa trên điều khiển render thực tế; nút Về nhà đứng trước nội dung trò chơi và nút âm thanh đứng sau các điều khiển chính.
- Game 8–10 có baseline thứ tự Tab theo cùng hợp đồng render thực tế; phần tử ẩn và disabled bị bỏ qua.
- Game 2 có con trỏ bàn phím trên hai bức tranh: phím mũi tên di chuyển, Enter/Space chọn bằng luồng click hiện có, vị trí được thông báo qua live region.
- Game 3 hỗ trợ ghép hai bước bằng bàn phím: Enter/Space chọn hình màu, Tab tới bóng rồi Enter/Space để thả bằng luồng Pointer Events hiện có; hình và bóng đã ghép bị loại khỏi thứ tự Tab.
- Game 4 hỗ trợ gom đồ hai bước bằng bàn phím: Enter/Space chọn đồ vật, Tab tới giỏ cùng màu rồi Enter/Space để thả bằng luồng Pointer Events hiện có; đồ vật đã gom bị loại khỏi thứ tự Tab.
- Game 2 cấu hình mọi điểm khác biệt với đường kính vùng chạm tối thiểu 44 đơn vị trên viewBox 300×300; E2E quy đổi theo kích thước render thật và yêu cầu đạt tối thiểu 44×44px trên iPhone/iPad.
- Game 3 giữ hình màu 96×96px và ô bóng 110×110px; Game 4 giữ đồ vật 74×74px và giỏ responsive theo lưới 4 cột/2 cột. E2E đo trực tiếp `boundingBox()` của mọi mục tiêu đang hiển thị và yêu cầu tối thiểu 44×44px.
- Game 5 giữ chấm nhìn thấy bán kính 13 nhưng bổ sung vòng chạm trong suốt bán kính 27; vòng chạm được dựng lại sau mỗi lần đổi hình và đạt tối thiểu 44×44px trên iPhone/iPad.

## Baseline tự động

`tests/accessibility-baseline.test.js` khóa các yêu cầu nền tảng trên cho toàn bộ 13 trang. `tests/live-region-accessibility.test.js` ngăn hồi quy đối với thông báo động dành cho trình đọc màn hình. `e2e/touch-targets.spec.js` đo kích thước thực tế của các nút điều khiển chung trên iPhone/iPad. `e2e/focus-visible.spec.js` xác nhận focus ring khi điều hướng bằng bàn phím. `tests/disabled-controls.test.js` kiểm tra trạng thái disabled qua hợp đồng tải chung của `shared-ui.js`. `e2e/text-contrast.spec.js` đo màu chữ và nền thực tế của các nút dùng chung. `tests/game1-keyboard-accessibility.test.js` khóa trạng thái ARIA và vòng đời lá bài Game 1. `e2e/games2-4-tab-order.spec.js` kiểm tra thứ tự Tab và việc bỏ qua phần tử ẩn/disabled của Game 2–4. `e2e/games5-7-tab-order.spec.js` kiểm tra thứ tự Tab tương đối và phần tử ẩn/disabled của Game 5–7. `e2e/games8-10-tab-order.spec.js` áp dụng cùng baseline cho Game 8–10. `tests/game2-keyboard-cursor.test.js` và `e2e/game2-keyboard-cursor.spec.js` khóa hợp đồng tải, phản hồi trực quan và thao tác bàn phím của Game 2. `tests/game3-keyboard-matching.test.js` và `e2e/game3-keyboard-matching.spec.js` khóa luồng chọn hình, chọn bóng, kết quả đúng/sai và trạng thái focus của Game 3. `tests/game4-keyboard-sorting.test.js` và `e2e/game4-keyboard-sorting.spec.js` khóa luồng chọn đồ vật, chọn giỏ, kết quả đúng/sai và trạng thái focus của Game 4. `tests/game2-gameplay-touch-targets.test.js` khóa bán kính vùng chạm trong dữ liệu Game 2; `e2e/game2-gameplay-touch-targets.spec.js` đo vùng chạm quy đổi theo kích thước SVG render thật. `tests/games3-4-gameplay-touch-targets.test.js` khóa kích thước CSS và lưới responsive; `e2e/games3-4-gameplay-touch-targets.spec.js` đo trực tiếp mục tiêu render thật bằng `boundingBox()`. `tests/game5-touch-target.test.js` khóa vòng chạm mở rộng và chuỗi tải offline; `e2e/game5-touch-target.spec.js` đo mọi chấm và kích hoạt gameplay từ phần nằm ngoài chấm nhìn thấy.

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

1. Rà soát vùng chạm của vật thể gameplay trong Game 6–10.
2. Rà soát độ tương phản của chữ nội dung nhỏ, nhãn thống kê và vật thể gameplay.
3. Kiểm thử thực tế thông báo phần thưởng và auto-save với VoiceOver/TalkBack.
4. Mở rộng E2E accessibility cho các luồng tương tác hoàn chỉnh trên iPhone/iPad.

## Ngoài phạm vi baseline

Các phát hiện cần sửa tiếp tục được tách thành PR riêng để dễ kiểm thử và rollback. Không thay đổi dữ liệu hồ sơ, tiến độ hoặc phần thưởng trong quá trình audit.
