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

  function injectIOSStyles() {
    if (document.getElementById('bhPwaIosStyles')) return;
    const style = document.createElement('style');
    style.id = 'bhPwaIosStyles';
    style.textContent = `
      html, body { min-height: 100%; min-height: 100dvh; }
      body {
        padding-top: max(var(--bh-existing-top, 0px), env(safe-area-inset-top));
        padding-right: max(var(--bh-existing-right, 0px), env(safe-area-inset-right));
        padding-bottom: max(var(--bh-existing-bottom, 0px), env(safe-area-inset-bottom));
        padding-left: max(var(--bh-existing-left, 0px), env(safe-area-inset-left));
        overscroll-behavior-y: contain;
      }
      button, a, input, select, textarea { touch-action: manipulation; }
      .bh-install-tip {
        position: fixed;
        z-index: 500;
        left: max(12px, env(safe-area-inset-left));
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 620px;
        margin-inline: auto;
        padding: 12px 14px;
        border: 3px solid #C9B6F5;
        border-radius: 20px;
        background: rgba(255,255,255,.97);
        color: #6B4E71;
        box-shadow: 0 12px 32px rgba(80,50,95,.22);
        font: 700 14px/1.35 system-ui, sans-serif;
      }
      .bh-install-tip button {
        flex: 0 0 auto;
        border: 0;
        border-radius: 999px;
        padding: 8px 11px;
        background: #FFF0F4;
        color: #7A4E86;
        font: inherit;
      }
      .bh-network-status {
        position: fixed;
        z-index: 490;
        left: 50%;
        bottom: max(12px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        border-radius: 999px;
        padding: 8px 13px;
        background: #FFF8E7;
        color: #7A5A2A;
        border: 2px solid #FFE0A3;
        font: 800 13px/1.2 system-ui, sans-serif;
        box-shadow: 0 8px 22px rgba(80,50,95,.15);
      }
      .bh-network-status[hidden] { display: none; }
      @media (display-mode: standalone) {
        .bh-install-tip { display: none !important; }
      }
    `;
    document.head.appendChild(style);
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
    registerServiceWorker();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
