(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isGame1 = /\/game1\.html$/.test(location.pathname);

  function addStyles() {
    if (document.getElementById('bhQualityStyles')) return;
    const style = document.createElement('style');
    style.id = 'bhQualityStyles';
    style.textContent = `
      :root{--bh-page-transition:220ms;--bh-safe-bottom:max(14px,env(safe-area-inset-bottom));}
      html{background:#FFF7F0;}
      body{opacity:1;transform:none;transition:opacity var(--bh-page-transition) ease,transform var(--bh-page-transition) ease;}
      html.bh-entering body{opacity:0;transform:scale(.985);}
      html.bh-leaving body{opacity:0;transform:scale(.975);}
      .bh-launch-screen{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:linear-gradient(180deg,#E8F4FF,#FFF7F0 52%,#FFF0F4);transition:opacity .28s ease,visibility .28s ease;}
      .bh-launch-screen[hidden]{opacity:0;visibility:hidden;pointer-events:none;display:grid;}
      .bh-launch-card{text-align:center;color:#6B4E71;font:800 18px/1.3 system-ui,sans-serif;animation:bhLaunchIn .45s ease both;}
      .bh-launch-icon{width:112px;height:112px;border-radius:28px;display:block;margin:0 auto 14px;box-shadow:0 16px 40px rgba(107,78,113,.2);}
      @keyframes bhLaunchIn{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:none}}
      .bh-update-toast{position:fixed;z-index:9000;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:var(--bh-safe-bottom);max-width:620px;margin:auto;display:flex;align-items:center;gap:10px;padding:12px 14px;border:3px solid #C9B6F5;border-radius:20px;background:rgba(255,255,255,.98);box-shadow:0 14px 38px rgba(80,50,95,.24);color:#6B4E71;font:700 14px/1.35 system-ui,sans-serif;}
      .bh-update-toast[hidden]{display:none;}
      .bh-update-toast button{margin-left:auto;min-height:44px;border:0;border-radius:999px;padding:9px 13px;background:#FFB7C5;color:#fff;font:800 14px system-ui,sans-serif;cursor:pointer;touch-action:manipulation;}
      .bh-resume-toast{position:fixed;z-index:8500;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);padding:8px 13px;border-radius:999px;background:#EAFBF3;border:2px solid #A8E6CF;color:#3F7F65;font:800 13px system-ui,sans-serif;box-shadow:0 8px 22px rgba(80,50,95,.14);}
      .bh-resume-toast[hidden]{display:none;}
      html.bh-game1-compact #sanBai{gap:clamp(5px,1.2vw,9px)!important;grid-template-columns:repeat(var(--bh-game1-cols,4),minmax(0,1fr))!important;width:min(100%,720px);margin-inline:auto;}
      html.bh-game1-compact #sanBai .la-bai{width:auto!important;min-width:0!important;}
      @media(max-width:430px){html.bh-game1-compact #sanBai{--bh-game1-cols:4;}html.bh-game1-compact #sanBai .mat{border-width:3px!important;border-radius:11px!important;}}
      @media(min-width:700px){html.bh-game1-compact #sanBai{--bh-game1-cols:6;}}
      @media(prefers-reduced-motion:reduce){body,.bh-launch-screen,.bh-launch-card{transition:none!important;animation:none!important;}}
    `;
    document.head.appendChild(style);
  }

  function setupLaunchScreen() {
    if (!standalone || sessionStorage.getItem('bh_launched') === '1') return;
    const launch = document.createElement('div');
    launch.className = 'bh-launch-screen';
    launch.setAttribute('aria-hidden', 'true');
    launch.innerHTML = '<div class="bh-launch-card"><img class="bh-launch-icon" src="./apple-touch-icon.png" alt=""><div>Bông Home\'s</div></div>';
    document.documentElement.appendChild(launch);
    const hide = () => {
      sessionStorage.setItem('bh_launched', '1');
      launch.hidden = true;
      setTimeout(() => launch.remove(), 350);
    };
    if (document.readyState === 'complete') setTimeout(hide, 380);
    else addEventListener('load', () => setTimeout(hide, 260), { once: true });
  }

  function setupPageTransitions() {
    root.classList.add('bh-entering');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('bh-entering')));
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.hash || link.target === '_blank' || link.hasAttribute('download')) return;
      event.preventDefault();
      root.classList.add('bh-leaving');
      setTimeout(() => { location.href = url.href; }, reducedMotion ? 0 : 180);
    });
    addEventListener('pageshow', () => root.classList.remove('bh-leaving'));
  }

  function setupCustomButtons() {
    document.querySelectorAll('[role="button"]').forEach((button) => {
      if (!button.hasAttribute('tabindex')) button.tabIndex = 0;
    });
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return;
      const button = event.target.closest('[role="button"]');
      if (!button || button.getAttribute('aria-disabled') === 'true') return;
      event.preventDefault();
      button.click();
    });
  }

  function setupDialogFocus() {
    document.querySelectorAll('.man-thang').forEach((dialog) => {
      let previousFocus = null;
      let inertSiblings = [];
      dialog.setAttribute('aria-hidden', dialog.classList.contains('hien') ? 'false' : 'true');
      if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;

      const focusable = () => [...dialog.querySelectorAll('button:not([disabled]),a[href],[role="button"]:not([aria-disabled="true"]),[tabindex]:not([tabindex="-1"])')];
      const open = () => {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.setAttribute('aria-hidden', 'false');
        inertSiblings = [...document.body.children].filter((item) => item !== dialog && !item.contains(dialog));
        inertSiblings.forEach((item) => { item.inert = true; });
        const target = focusable()[0] || dialog;
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
      };
      const close = () => {
        dialog.setAttribute('aria-hidden', 'true');
        inertSiblings.forEach((item) => { item.inert = false; });
        inertSiblings = [];
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        previousFocus = null;
      };

      dialog.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab') return;
        const items = focusable();
        if (!items.length) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });

      new MutationObserver(() => {
        if (dialog.classList.contains('hien')) open();
        else close();
      }).observe(dialog, { attributes: true, attributeFilter: ['class'] });
    });
  }

  function setupLifecycle() {
    let hiddenAt = 0;
    const toast = document.createElement('div');
    toast.className = 'bh-resume-toast';
    toast.hidden = true;
    toast.setAttribute('role', 'status');
    toast.textContent = '🌷 Bé tiếp tục từ chỗ đang chơi nhé!';
    document.body.appendChild(toast);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        window.dispatchEvent(new CustomEvent('bonghome:pause', { detail: { at: hiddenAt } }));
        return;
      }
      const awayMs = hiddenAt ? Date.now() - hiddenAt : 0;
      window.dispatchEvent(new CustomEvent('bonghome:resume', { detail: { awayMs } }));
      if (awayMs > 15000) {
        toast.hidden = false;
        setTimeout(() => { toast.hidden = true; }, 2200);
      }
      const contexts = [window.BongAudio?.getContext?.(), window.boLoa].filter(Boolean);
      contexts.forEach((context) => context.state === 'suspended' && context.resume().catch(() => {}));
    });
  }

  function setupControlledUpdates() {
    if (!('serviceWorker' in navigator)) return;
    const toast = document.createElement('aside');
    toast.className = 'bh-update-toast';
    toast.hidden = true;
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<span>✨ Có phiên bản mới đã tải xong.</span><button type="button">Cập nhật</button>';
    document.body.appendChild(toast);

    let waitingWorker = null;
    const show = (worker) => { waitingWorker = worker; toast.hidden = false; };
    toast.querySelector('button').addEventListener('click', () => {
      if (!waitingWorker) return;
      sessionStorage.setItem('bh_reload_for_update', '1');
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) show(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) show(worker);
        });
      });
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('bh_reload_for_update') !== '1') return;
      sessionStorage.removeItem('bh_reload_for_update');
      location.reload();
    });
  }

  function setupGame1ResponsiveBoard() {
    if (!isGame1) return;
    root.classList.add('bh-game1-compact');
    const update = () => {
      const count = document.querySelectorAll('#sanBai .la-bai').length;
      root.style.setProperty('--bh-game1-cols', count >= 20 ? (innerWidth >= 700 ? 6 : 4) : count >= 16 ? 4 : innerWidth >= 700 ? 6 : 4);
    };
    new MutationObserver(update).observe(document.documentElement, { childList: true, subtree: true });
    addEventListener('resize', update, { passive: true });
    update();
  }

  addStyles();
  setupLaunchScreen();
  setupPageTransitions();

  const start = () => {
    setupCustomButtons();
    setupDialogFocus();
    setupLifecycle();
    setupControlledUpdates();
    setupGame1ResponsiveBoard();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
