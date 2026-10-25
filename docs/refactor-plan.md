# Lộ trình tái cấu trúc game 1–10 và chuyển test sang kiểm tra hành vi

Đây là tài liệu kế hoạch, chưa thực hiện. Mục tiêu: đưa game 1–10 về cùng mô hình với game 11–13, và để test kiểm tra hành vi thay vì kiểm tra chuỗi trong mã nguồn. Hai việc đi cùng nhau, vì game đã tách engine thì mới test hành vi được trong Node.

## Hiện trạng (đo ngày 2026-10-24)

| Hạng mục | Số liệu |
|---|---|
| Unit test (`tests/*.test.js`) | 83 tệp. **72** tệp đọc mã nguồn bằng `readFileSync` rồi so regex hoặc `includes`. |
| Game 1–10 | Mỗi game là một tệp HTML, script inline 200–390 dòng, trạng thái nằm trong biến toàn cục (`giay`, `daBatDau`, `dongHoChay`, `KIEU_DO`…). |
| Lớp gắn thêm | `games2-4/5-7/8-10-autosave.js`, `*-rewards.js`, `game1-*.js` đọc và ghi thẳng vào các biến toàn cục đó. Đổi tên một biến trong game sẽ làm hỏng autosave mà không báo lỗi. |
| Game 11–13 | Engine và giao diện tách riêng (`js/game12-sudoku.js` xuất `BongSudokuEngine`, game 13 xuất engine qua `module.exports`). Phần thưởng là module riêng có test hành vi (`tests/game11-rewards.test.js`, `tests/game13-rewards.test.js`). |

Vì sao test kiểm chuỗi là vấn đề:
- **Bỏ lọt lỗi thật:** test vẫn xanh khi logic sai. Ví dụ, lỗi ghi đè dữ liệu hỏng ở `storage.js` chỉ bị phát hiện sau khi viết test hành vi.
- **Báo đỏ oan:** test đỏ khi refactor mà hành vi không đổi, nên refactor game 1–10 rất tốn công.

## Mô hình đích cho mỗi game

1. **`js/gameN-engine.js`:** logic thuần, không đụng DOM. Gồm tạo ván, xử lý nước đi, kiểm tra thắng, `serialize()` và `restore()` trạng thái. Xuất qua `module.exports` để test trong Node.
2. **`js/gameN-ui.js`:** dựng DOM, nhận Pointer/Keyboard Events, gọi engine, phát âm thanh.
3. **`js/gameN-rewards.js`:** theo mẫu `game11-rewards.js` và `game13-rewards.js`, gồm `complete()`, `trackProgress()` và `abandon()`.
4. **`gameN.html`:** chỉ còn markup và các thẻ `<script src>`, không còn script inline.
5. **Autosave:** gọi `engine.serialize()` và `engine.restore()`, không đọc biến toàn cục nữa. Định dạng bản lưu có `schemaVersion`; bản lưu cũ được chuyển đổi trong `restore()`, như cách Game 4 đã chuyển từ `html` sang `shape`.

Khi cả 10 game không còn script inline, có thể bỏ `'unsafe-inline'` khỏi `script-src` trong `_headers`. `e2e/security-headers.spec.js` sẽ xác nhận việc này.

## Thứ tự và tiêu chí xong cho mỗi bước

Mỗi game là **một PR riêng**, không gộp nhiều game vào một PR. Thứ tự từ game đơn giản đến game phức tạp: **6 → 7 → 5 → 3 → 4 → 8 → 10 → 9 → 2 → 1**. Game 1 nhiều lớp gắn thêm nhất (độ khó, chủ đề, trợ năng bàn phím), nên để cuối.

Một PR chỉ được merge khi đạt đủ các điều kiện sau:
- [ ] Engine có unit test hành vi: tạo ván, nước đi đúng và sai, thắng, `serialize()`/`restore()`, chuyển đổi bản lưu cũ.
- [ ] `e2e/version-upgrade.spec.js` xanh, tức là dữ liệu và ván đang chơi dở của bản trước vẫn mở được.
- [ ] Các test kiểm chuỗi của game đó được thay bằng test hành vi, không chỉ thêm test mới bên cạnh.
- [ ] Khóa `localStorage` không đổi, hoặc có chuyển đổi kèm test (`tests/storage-keys.test.js`).
- [ ] Đổi `PHIEN_BAN`, và E2E trên iPhone/iPad (tương phản, vùng chạm, focus, live region) vẫn xanh.

## Tiến độ

| Game | Trạng thái | Ghi chú |
|---|---|---|
| 6 | ✅ Đã tách | `js/game6-engine.js` + `js/game6-ui.js`; `game6.html` không còn script inline; `tests/game6-engine.test.js`, `e2e/game6-gameplay.spec.js` |
| 7 | ✅ Đã tách | `js/game7-engine.js` + `js/game7-ui.js`; `tests/game7-engine.test.js`, `e2e/game7-gameplay.spec.js` |
| 8 | ✅ Đã tách | `js/game8-engine.js` + `js/game8-ui.js`; `tests/game8-engine.test.js`, `e2e/game8-gameplay.spec.js`; làm trước 5/3/4 theo yêu cầu |
| 5 | ✅ Đã tách | `js/game5-engine.js` + `js/game5-ui.js`; `tests/game5-engine.test.js`, `e2e/game5-gameplay.spec.js`; `games5-7-autosave.js` không còn đọc biến toàn cục nào |
| 3, 4, 10, 9, 2, 1 | Chưa làm | theo thứ tự ở trên; Game 9, 10 còn dùng biến toàn cục trong `games8-10-autosave.js` |

Ghi chú khi làm Game 6, áp dụng cho các game sau:
- Giữ đúng định dạng bản lưu cũ (`serialize()` trả về cùng các trường). Unit test và E2E có một bản lưu dạng cũ để chắc ván đang chơi dở vẫn mở được.
- Giữ nguyên id và class trong DOM. Các E2E sẵn có về tương phản, vùng chạm, thứ tự Tab, live region và offline nhờ vậy là lưới an toàn miễn phí.
- Adapter dùng chung (`games5-7-autosave.js`) chỉ gọi API `window.BongGameN`. Phần dùng chung lấy hộp thoại thắng theo id, không dùng biến toàn cục.
- Vẽ SVG bằng `createElementNS`, không dùng `innerHTML`.
- Mọi vòng lặp phụ thuộc rng phải có giới hạn và đường lui tất định. Game 7 từng có vòng chọn hình gây nhiễu `while` không giới hạn; một rng kém trong test đã làm nó treo.
- Hẹn giờ phản hồi (ví dụ viền đỏ khi chọn sai) phải riêng cho mỗi lần chạm. Dùng chung một timer rồi hủy sẽ làm kẹt trạng thái của lần chạm trước.
- Hành vi lạ nhưng có sẵn (ví dụ "Đúng ngay" của Game 7 đếm cả câu đúng sau khi đã chọn sai) được giữ nguyên trong PR tái cấu trúc và ghi chú lại; sửa luật chơi là PR riêng (Game 7 đã sửa ở PR riêng sau đó, bản lưu thêm trường `missed` tùy chọn để vẫn đọc được bản lưu cũ).

Ghi chú khi làm Game 8:
- Bảng tra theo tên (ví dụ hướng đi `DIRECTIONS[direction]`) phải kiểm `Object.hasOwn`, nếu không `'toString'` sẽ lấy nhầm hàm của `Object.prototype`. Unit test có ca này.
- Đối chiếu danh sách giá trị hợp lệ trong adapter cũ với giao diện thật: adapter cũ chỉ nhận mê cung 8/10/12 trong khi mức độ là 8/12/16, nên ván Khó không bao giờ khôi phục được. Engine dùng chung một hằng `SIZES` cho cả sinh mê cung lẫn khôi phục.

Ghi chú khi làm Game 5:
- E2E chạm bằng con trỏ thật (`page.mouse.click` theo tọa độ) bắt được lỗi mà `dispatchEvent` bỏ qua: ở hình thuyền buồm, chấm 4 đè lên chấm 1 nên bé không chạm được số 1. Với game có dữ liệu ngẫu nhiên, test phải cố định dữ liệu (ở đây là chọn sẵn hình), nếu không lỗi chỉ hiện 1/5 số lần và trông như chập chờn.
- Phần tử có `tabindex="0"` thì phải có xử lý Enter/Space và `role` phù hợp; tab tới được mà không bấm được là lỗi trợ năng.
- Hẹn giờ của chuỗi hiệu ứng kết thúc (nối xong → tô màu → màn thắng) phải hủy khi bé vẽ lại hoặc đổi hình giữa chừng.

## Quy tắc cho test, áp dụng ngay

- **Test mới** kiểm tra hành vi: gọi hàm hoặc module thật, hoặc chạy E2E. Không thêm `assert.match(source, /…/)` cho logic.
- **Khi sửa một tệp**, chuyển các test kiểm chuỗi của tệp đó sang test hành vi trong cùng PR.
- **Test kiểm chuỗi vẫn hợp lý** cho các "hợp đồng cấu hình" không chạy được trong Node:
  - danh sách precache trong `sw.js`;
  - định dạng `PHIEN_BAN`;
  - nội dung `_headers`, `_redirects`, `.assetsignore`;
  - thứ tự `<script>` trong HTML.
- **Theo dõi tiến độ** bằng số tệp `tests/*.test.js` còn so regex trên mã nguồn logic. Hiện là 72; mục tiêu là chỉ còn các test hợp đồng cấu hình.

## Đã làm trong PR rà soát (#4–#15)

Các chỗ sửa đều có test hành vi:
- `tests/storage-keys.test.js`
- `tests/parent-gate.test.js`
- `tests/game11-rewards.test.js`
- `tests/service-worker-navigation.test.js`, mở rộng thêm các nhánh cache
- `e2e/game4-autosave-restore.spec.js`, `e2e/game11-rewards.spec.js`, `e2e/security-headers.spec.js`
- `tests/routes.test.js`, nay đối chiếu với các tệp `gameN.html` có thật thay vì một con số viết cứng
