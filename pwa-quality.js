(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const FALLBACK_ROUTES = Object.freeze({
    isGame(gameId, pathname = location.pathname) {
      return new RegExp(`/game${Number(gameId)}(?:\\.html)?/?$`).test(pathname || '');
    }
  });
  const getRoutes = () => window.BongRoutes?.isGame ? window.BongRoutes : FALLBACK_ROUTES;
  const isGame = (gameId, pathname = location.pathname) => getRoutes().isGame(gameId, pathname);

  // CSS nằm ở tệp riêng (CSP không cho <style> inline); gắn cuối <head> để đè được CSS riêng của trang như trước.
  function addStyles() {
    if (document.getElementById('bhQualityStyles')) return;
    const link = document.createElement('link');
    link.id = 'bhQualityStyles';
    link.rel = 'stylesheet';
    link.href = './css/pwa-quality.css';
    document.head.appendChild(link);
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

  function setupLiveRegions() {
    const selector = '[role="status"],[aria-live]:not([aria-live="off"])';
    const enhance = (node) => {
      if (!(node instanceof Element)) return;
      const regions = node.matches(selector) ? [node] : [];
      regions.push(...node.querySelectorAll(selector));
      regions.forEach((region) => {
        if (!region.hasAttribute('aria-atomic')) region.setAttribute('aria-atomic', 'true');
      });
    };

    enhance(document.body);
    new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(enhance));
    }).observe(document.body, { childList: true, subtree: true });
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
    if (!isGame(1)) return;
    root.classList.add('bh-game1-compact');
    const update = () => {
      const count = document.querySelectorAll('#sanBai .la-bai').length;
      root.style.setProperty('--bh-game1-cols', count >= 20 ? (innerWidth >= 700 ? 6 : 4) : count >= 16 ? 4 : innerWidth >= 700 ? 6 : 4);
    };
    // Chỉ theo dõi việc thêm/bớt lá bài, không quan sát cả trang (mỗi lần lật bài đổi class ở rất nhiều nút).
    const board = document.getElementById('sanBai');
    if (board) new MutationObserver(update).observe(board, { childList: true });
    addEventListener('resize', update, { passive: true });
    update();
  }

  function loadGame3DragStability() {
    if (!isGame(3) || document.querySelector('script[data-bh-game3-drag-stability]')) return;
    const script = document.createElement('script');
    script.src = './js/game3-drag-stability.js';
    script.dataset.bhGame3DragStability = 'true';
    script.addEventListener('error', () => console.warn('[Bông Home] Không tải được bộ ổn định kéo thả Game 3'), { once: true });
    document.head.appendChild(script);
  }

  addStyles();
  setupLaunchScreen();
  setupPageTransitions();

  const start = () => {
    setupCustomButtons();
    setupLiveRegions();
    setupDialogFocus();
    setupLifecycle();
    setupControlledUpdates();
    setupGame1ResponsiveBoard();
    loadGame3DragStability();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
