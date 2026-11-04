(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  if (root?.document) root.BongFullscreen = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function createFullscreen(root) {
  'use strict';

  /*
   * Chế độ toàn màn hình cho trang game.
   *  - Bật class `bh-fullscreen` trên <html>: CSS (css/fullscreen.css) ẩn lời giới thiệu/mẹo và co giãn bàn chơi
   *    theo đúng khung màn hình, nên game không còn phụ thuộc vào bố cục trang web.
   *  - Trình duyệt hỗ trợ Fullscreen API (máy tính, Android, iPad) thì xin toàn màn hình thật để ẩn thanh trình duyệt.
   *  - iPhone (Safari không cho trang tự mở toàn màn hình) vẫn có "chế độ chơi gọn"; gợi ý một lần cách thêm vào
   *    Màn hình chính để mở như ứng dụng, không còn thanh địa chỉ.
   * Chế độ gọn được nhớ trong phiên (sessionStorage) để sang game khác vẫn giữ; toàn màn hình thật thì trình duyệt
   * bắt buộc bé bấm lại.
   */

  const document = root.document;
  const html = document.documentElement;
  const CLASS_NAME = 'bh-fullscreen';
  const SESSION_KEY = 'bh_fullscreen_mode';
  const HINT_KEY = 'bh_fullscreen_hint_shown';
  const LABEL_ENTER = 'Chơi toàn màn hình';
  const LABEL_EXIT = 'Thoát toàn màn hình';
  const SIDE_CLASS = 'bh-fs-side';
  // Đã đo xong cỡ bàn: CSS chỉ ép bề rộng bàn khi có class này (chưa đo thì bàn giữ cỡ cũ của trang).
  const FITTED_CLASS = 'bh-fs-fitted';
  // Bàn chơi không nhỏ hơn mức này (bé còn bấm được); thiếu chỗ thì trang cuộn thay vì bàn bé tí.
  const MIN_BOARD = 220;

  const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const nativeSupported = () => Boolean(
    (document.fullscreenEnabled || document.webkitFullscreenEnabled)
    && (html.requestFullscreen || html.webkitRequestFullscreen)
  );
  const isStandalone = () => {
    try { return root.matchMedia?.('(display-mode: standalone)').matches || root.navigator?.standalone === true; }
    catch (error) { return false; }
  };
  const isIOS = () => /iPad|iPhone|iPod/.test(root.navigator?.userAgent || '')
    || (root.navigator?.platform === 'MacIntel' && root.navigator?.maxTouchPoints > 1);

  function session(action, key, value) {
    try {
      if (action === 'get') return root.sessionStorage.getItem(key);
      if (action === 'set') root.sessionStorage.setItem(key, value);
      else root.sessionStorage.removeItem(key);
    } catch (error) { /* Bộ nhớ phiên bị chặn: chế độ vẫn chạy, chỉ không nhớ khi sang trang khác. */ }
    return null;
  }

  function isActive() {
    return html.classList.contains(CLASS_NAME);
  }

  function syncButtons() {
    const active = isActive();
    document.querySelectorAll('[data-bh-fullscreen]').forEach((button) => {
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('aria-label', active ? LABEL_EXIT : LABEL_ENTER);
      button.title = active ? LABEL_EXIT : LABEL_ENTER;
      const icon = button.querySelector('.bh-fs-icon');
      if (icon) icon.textContent = active ? '✕' : '⛶';
    });
  }

  /*
   * Co giãn bàn chơi (phần tử có data-bh-fs-board) cho vừa khung màn hình: đo khoảng trống thật còn lại rồi đặt
   * --bh-fs-board-w (bề rộng bàn, giữ tỉ lệ) hoặc --bh-fs-board-h (chiều cao, với data-bh-fs-fit="height").
   * Màn hình thấp nằm ngang (điện thoại xoay ngang): bàn chơi đứng cột phải, thông tin và nút ở cột trái.
   */
  function board() {
    return document.querySelector('[data-bh-fs-board]');
  }

  /*
   * Bố cục hai cột (bàn cột phải): màn hình nằm ngang và thấp (điện thoại xoay ngang). Bàn vuông hoặc bàn dọc
   * (data-bh-fs-side="wide") thì dùng cho mọi màn hình nằm ngang, kể cả laptop: bàn được cao bằng cả màn hình.
   */
  function useSideLayout(element) {
    const mode = element.dataset.bhFsSide;
    if (mode === 'off') return false;
    const landscape = root.innerWidth > root.innerHeight * 1.25;
    return landscape && (mode === 'wide' || root.innerHeight < 640);
  }

  function floatingBottom() {
    const sound = document.getElementById('nutAmThanh');
    if (!sound) return 0;
    const rect = sound.getBoundingClientRect();
    return rect.height ? root.innerHeight - rect.top + 8 : 0;
  }

  function setVar(name, value) {
    html.classList.add(FITTED_CLASS);
    const current = parseFloat(html.style.getPropertyValue(name));
    if (!Number.isFinite(current) || Math.abs(current - value) >= 1) html.style.setProperty(name, `${Math.round(value)}px`);
  }

  function clearFit() {
    html.style.removeProperty('--bh-fs-board-w');
    html.style.removeProperty('--bh-fs-board-h');
    html.classList.remove(SIDE_CLASS, FITTED_CLASS);
  }

  let fitting = false;
  function fit() {
    const element = board();
    if (!isActive() || !element) {
      clearFit();
      return;
    }
    if (fitting) return;
    fitting = true;
    try {
      const byHeight = element.dataset.bhFsFit === 'height';
      const side = !byHeight && useSideLayout(element);
      html.classList.toggle(SIDE_CLASS, side);
      const pad = 8;
      // Ba vòng: đổi cỡ bàn có thể làm chữ bên cạnh xuống dòng, vòng sau chỉnh lại theo bố cục mới.
      for (let round = 0; round < 3; round += 1) {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) break;
        if (side) {
          const availH = root.innerHeight - pad * 2;
          const availW = Math.max(MIN_BOARD, root.innerWidth * 0.6);
          setVar('--bh-fs-board-w', Math.max(MIN_BOARD, Math.min(availW, availH * (rect.width / rect.height))));
          continue;
        }
        // Đo theo đáy khung game (không theo chiều cao tài liệu: body có min-height 100dvh nên luôn ≥ màn hình).
        const shell = element.closest('main') || document.body;
        const shellBottom = shell.getBoundingClientRect().bottom + root.scrollY
          + parseFloat(root.getComputedStyle(shell).marginBottom || 0)
          + parseFloat(root.getComputedStyle(document.body).paddingBottom || 0);
        const free = root.innerHeight - shellBottom;
        // Trang tự khoá khung vừa màn hình (Game 11 trên máy cảm ứng: body cố định, bàn co theo flex): giữ nguyên.
        if (root.getComputedStyle(document.body).position === 'fixed') {
          html.style.removeProperty('--bh-fs-board-w');
          html.classList.remove(FITTED_CLASS);
          break;
        }
        const targetH = rect.height + free;
        if (byHeight) {
          setVar('--bh-fs-board-h', Math.max(MIN_BOARD * 0.8, targetH));
          continue;
        }
        const parent = element.parentElement;
        const parentStyle = root.getComputedStyle(parent);
        const availW = parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);
        // Phần cao không co theo bề rộng (chữ chú thích dưới bàn) coi như cố định khi tính tỉ lệ.
        const width = Math.min(availW, rect.width * (targetH / rect.height));
        setVar('--bh-fs-board-w', Math.max(Math.min(MIN_BOARD, availW), width));
      }
      if (side) html.style.setProperty('--bh-fs-floating', `${floatingBottom()}px`);
    } finally {
      fitting = false;
    }
  }

  let fitFrame = 0;
  function scheduleFit() {
    if (fitFrame) return;
    fitFrame = (root.requestAnimationFrame || ((callback) => root.setTimeout(callback, 16)))(() => {
      fitFrame = 0;
      fit();
    });
  }

  /** Báo cho game vẽ lại theo khung mới (canvas, bàn tính cỡ bằng JS). */
  function notifyLayout() {
    root.dispatchEvent(new root.CustomEvent('bonghome:fullscreenchange', { detail: { active: isActive(), native: Boolean(nativeElement()) } }));
    root.requestAnimationFrame?.(() => root.dispatchEvent(new root.Event('resize')));
  }

  function setMode(active) {
    if (isActive() === active) {
      syncButtons();
      return;
    }
    html.classList.toggle(CLASS_NAME, active);
    if (active) session('set', SESSION_KEY, '1');
    else session('remove', SESSION_KEY);
    syncButtons();
    fit();
    notifyLayout();
  }

  function showHint(message) {
    if (session('get', HINT_KEY) === '1') return;
    session('set', HINT_KEY, '1');
    const hint = document.createElement('div');
    hint.className = 'bh-fs-hint';
    hint.setAttribute('role', 'status');
    hint.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Đã hiểu';
    close.addEventListener('click', () => hint.remove());
    hint.append(close);
    document.body.append(hint);
    root.setTimeout(() => hint.remove(), 9000);
  }

  async function enter() {
    setMode(true);
    if (nativeSupported() && !nativeElement()) {
      try {
        const request = html.requestFullscreen || html.webkitRequestFullscreen;
        await request.call(html, { navigationUI: 'hide' });
      } catch (error) {
        // Bị từ chối (iframe, chính sách trình duyệt): vẫn giữ chế độ chơi gọn.
      }
    } else if (!nativeSupported() && isIOS() && !isStandalone()) {
      showHint('Bông đã thu gọn trang để bé chơi rộng hơn. Muốn ẩn cả thanh địa chỉ: chạm Chia sẻ rồi chọn "Thêm vào Màn hình chính" và mở Bông Home từ đó.');
    }
  }

  async function exit() {
    setMode(false);
    if (nativeElement()) {
      try {
        const leave = document.exitFullscreen || document.webkitExitFullscreen;
        await leave.call(document);
      } catch (error) { /* Đã thoát sẵn. */ }
    }
  }

  function toggle() {
    return isActive() ? exit() : enter();
  }

  function onNativeChange() {
    // Bé bấm Esc hoặc vuốt thoát toàn màn hình của trình duyệt: thoát luôn chế độ chơi gọn cho khớp.
    if (!nativeElement() && isActive()) setMode(false);
    else {
      scheduleFit();
      notifyLayout();
    }
  }

  function init() {
    if (root.__bongFullscreenStarted) return;
    root.__bongFullscreenStarted = true;
    document.querySelectorAll('[data-bh-fullscreen]').forEach((button) => {
      button.addEventListener('click', () => { toggle(); });
    });
    document.addEventListener('fullscreenchange', onNativeChange);
    document.addEventListener('webkitfullscreenchange', onNativeChange);
    root.addEventListener('resize', scheduleFit);
    root.addEventListener('orientationchange', scheduleFit);
    // Bàn đổi cỡ theo ván (Game 1 đổi số lá, Game 12 đổi 4×4 ↔ 9×9): đo lại khi nội dung trang đổi.
    const main = document.querySelector('main');
    if (main && 'MutationObserver' in root) new root.MutationObserver(() => { if (isActive()) scheduleFit(); }).observe(main, { childList: true, subtree: true });
    // Sang game khác trong cùng phiên: giữ chế độ chơi gọn. Toàn màn hình thật cần bé bấm lại (luật của trình duyệt),
    // nên chỉ tự giữ khi không có toàn màn hình thật để xin (iPhone) hoặc đang mở như ứng dụng.
    if (session('get', SESSION_KEY) === '1' && (!nativeSupported() || isStandalone())) setMode(true);
    syncButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  return Object.freeze({ enter, exit, toggle, isActive, init, fit });
});
