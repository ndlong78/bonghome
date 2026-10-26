/*
 * Góc phụ huynh: khởi động các nút xoá dữ liệu (có cổng phụ huynh) khi module dùng chung đã sẵn sàng.
 * Tách khỏi parents.html để CSP không cần 'unsafe-inline' cho script.
 */
window.addEventListener('DOMContentLoaded', () => {
  window.BongModulesReady?.then((modules) => {
    window.BongParentDataControlsFactory?.(modules.storage, window).init();
  });
});
