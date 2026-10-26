(() => {
  'use strict';

  const root = document.documentElement;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);

  root.classList.toggle('bh-ios', isIOS);
  root.classList.toggle('bh-standalone', isStandalone);
  root.classList.toggle('bh-browser', !isStandalone);
  root.classList.toggle('bh-offline', !navigator.onLine);

  function ensureHeadMetadata() {
    const entries = [
      ['meta', { name: 'theme-color', content: '#FFB7C5' }],
      ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
      ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
      ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }],
      ['meta', { name: 'apple-mobile-web-app-title', content: "Bông Home's" }],
      ['link', { rel: 'manifest', href: './manifest.json' }],
      ['link', { rel: 'apple-touch-icon', href: './apple-touch-icon.png' }]
    ];

    entries.forEach(([tag, attributes]) => {
      const selector = tag === 'meta'
        ? `meta[name="${attributes.name}"]`
        : `${tag}[rel="${attributes.rel}"]`;
      if (document.head.querySelector(selector)) return;
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
      document.head.appendChild(element);
    });
  }

  // CSS nằm ở tệp riêng (CSP không cho <style> inline); gắn cuối <head> để đè padding của body trong CSS trang.
  function injectIOSStyles() {
    if (document.getElementById('bhPwaIosStyles')) return;
    const link = document.createElement('link');
    link.id = 'bhPwaIosStyles';
    link.rel = 'stylesheet';
    link.href = './css/pwa-ios.css';
    document.head.appendChild(link);
  }

  function showInstallTip() {
    if (!isIOS || !isSafari || isStandalone || sessionStorage.getItem('bh_install_tip_closed') === '1') return;
    if (document.querySelector('.bh-install-tip')) return;

    const tip = document.createElement('aside');
    tip.className = 'bh-install-tip';
    tip.setAttribute('role', 'status');
    tip.innerHTML = '<span>📲 Để dùng như ứng dụng: chạm <strong>Chia sẻ</strong> rồi chọn <strong>Thêm vào Màn hình chính</strong>.</span><button type="button" aria-label="Đóng hướng dẫn">Đã hiểu</button>';
    tip.querySelector('button').addEventListener('click', () => {
      sessionStorage.setItem('bh_install_tip_closed', '1');
      tip.remove();
    });
    document.body.appendChild(tip);
  }

  /*
   * Nút âm thanh (shared-ui.js) và banner cài app cùng nổi ở đáy màn hình. Xếp nút âm thanh lên trên banner
   * (CSS đọc --bh-install-tip-space) và chừa đáy trang bằng chiều cao cả chồng nổi (--bh-floating-space),
   * để nút cuối trang (ví dụ "Tranh mới" của Game 2 trên iPhone) luôn cuộn lên trên chúng được.
   */
  const FLOATING_GAP = 8;
  const FLOATING_SELECTOR = '#nutAmThanh, .bh-install-tip';

  // Tính theo kích thước (không theo vị trí): lúc CSS chưa tải xong nút âm thanh còn nằm trong luồng trang,
  // còn khi CSS tải xong nút chỉ đổi vị trí nên ResizeObserver không báo.
  function updateFloatingSpace() {
    const tip = document.querySelector('.bh-install-tip');
    const sound = document.getElementById('nutAmThanh');
    const tipSpace = tip?.offsetHeight ? tip.offsetHeight + FLOATING_GAP : 0;
    // Trang tự xếp nút âm thanh vào bố cục (Game 11 đặt nó cạnh thanh trạng thái) thì không chừa chỗ cho nút.
    const soundDocked = document.body.hasAttribute('data-bh-sound-docked');
    const soundSpace = sound?.offsetHeight && !soundDocked ? sound.offsetHeight + FLOATING_GAP : 0;
    root.style.setProperty('--bh-install-tip-space', `${tipSpace}px`);
    const space = tipSpace + soundSpace;
    root.style.setProperty('--bh-floating-space', `${space}px`);
    // Đáy cơ sở của chồng nút nổi (như CSS của nút); không có gì cần chừa thì giữ nguyên đáy trang như cũ.
    root.style.setProperty('--bh-floating-base', space ? 'max(12px, env(safe-area-inset-bottom))' : '0px');
  }

  function setupFloatingSpace() {
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(() => updateFloatingSpace()) : null;
    const watch = () => {
      document.querySelectorAll(FLOATING_SELECTOR).forEach((element) => resizeObserver?.observe(element));
      updateFloatingSpace();
    };
    // Chỉ theo dõi con trực tiếp của body: nút âm thanh và banner đều được gắn thẳng vào body.
    new MutationObserver(watch).observe(document.body, { childList: true });
    addEventListener('resize', updateFloatingSpace);
    addEventListener('load', updateFloatingSpace, { once: true });
    watch();
  }

  function setupNetworkStatus() {
    let status = document.querySelector('.bh-network-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'bh-network-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.hidden = true;
      document.body.appendChild(status);
    }

    let hideTimer;
    const update = () => {
      clearTimeout(hideTimer);
      root.classList.toggle('bh-offline', !navigator.onLine);
      status.textContent = navigator.onLine
        ? '✅ Đã có mạng trở lại'
        : '📴 Đang ngoại tuyến — các trò đã tải vẫn chơi được';
      status.hidden = false;
      if (navigator.onLine) hideTimer = setTimeout(() => { status.hidden = true; }, 2600);
    };

    addEventListener('online', update);
    addEventListener('offline', update);
    if (!navigator.onLine) update();
  }

  function setupAudioRecovery() {
    const resumeAudio = () => {
      const contexts = [window.BongAudio?.getContext?.(), window.boLoa].filter(Boolean);
      contexts.forEach((context) => {
        if (context.state === 'suspended') context.resume().catch(() => {});
      });
    };

    document.addEventListener('pointerdown', resumeAudio, { passive: true });
    document.addEventListener('touchstart', resumeAudio, { passive: true });
    addEventListener('pageshow', resumeAudio);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resumeAudio();
    });
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('Không thể bật chế độ ngoại tuyến', error);
    }
  }

  ensureHeadMetadata();
  injectIOSStyles();
  setupAudioRecovery();

  const start = () => {
    setupNetworkStatus();
    showInstallTip();
    setupFloatingSpace();
    registerServiceWorker();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
