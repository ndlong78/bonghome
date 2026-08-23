(function (root) {
  'use strict';

  const FALLBACK_ROUTES = Object.freeze({
    isHome(pathname) {
      const path = typeof pathname === 'string' ? pathname : '';
      return path === '/' || path.endsWith('/') || /(?:^|\/)index(?:\.html)?$/.test(path);
    },
    isGame(gameId, pathname) {
      const path = typeof pathname === 'string' ? pathname : '';
      return new RegExp(`/game${Number(gameId)}(?:\\.html)?/?$`).test(path);
    }
  });
  const getRoutes = () => root.BongRoutes || FALLBACK_ROUTES;

  function isHomePage(pathname) {
    return getRoutes().isHome(pathname);
  }

  function isSupportedPage(pathname) {
    return isHomePage(pathname) || getRoutes().isGame(1, pathname);
  }

  function loadDailyJourney() {
    if (!isHomePage(root.location.pathname) || root.__bongDailyJourneyLoading) return;
    root.__bongDailyJourneyLoading = true;

    if (!root.document.querySelector('link[data-bh-daily-journey]')) {
      const link = root.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './css/daily-journey.css';
      link.dataset.bhDailyJourney = 'true';
      root.document.head.appendChild(link);
    }

    const start = () => root.BongDailyJourney?.init(root)
      .catch((error) => console.warn('[Bông Home] Không tải được Hôm nay của Bông', error));

    if (root.BongDailyJourney) {
      start();
      return;
    }

    const script = root.document.createElement('script');
    script.src = './js/daily-journey.js';
    script.dataset.bhDailyJourney = 'true';
    script.addEventListener('load', start, { once: true });
    script.addEventListener('error', () => console.warn('[Bông Home] Không tải được module Hôm nay của Bông'), { once: true });
    root.document.head.appendChild(script);
  }

  function start() {
    if (root.__bongThemePickerStarted || !root.BongThemes) return;
    if (!isSupportedPage(root.location.pathname)) return;
    root.__bongThemePickerStarted = true;
    loadDailyJourney();

    const themes = root.BongThemes.listThemes();
    if (themes.length < 2) return;

    const picker = root.document.createElement('section');
    picker.className = 'bh-theme-picker';
    picker.setAttribute('aria-label', 'Chọn chủ đề');
    picker.innerHTML = '<span class="bh-theme-picker-label">Chủ đề</span><div class="bh-theme-picker-options" role="group" aria-label="Các chủ đề"></div>';
    const options = picker.querySelector('.bh-theme-picker-options');

    function renderActive() {
      const activeId = root.BongThemes.getActiveTheme()?.id;
      options.querySelectorAll('button').forEach((button) => {
        const selected = button.dataset.themeId === activeId;
        button.classList.toggle('dang-chon', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }

    themes.forEach((theme) => {
      const button = root.document.createElement('button');
      button.type = 'button';
      button.dataset.themeId = theme.id;

      const icon = root.document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = theme.icon || '🎨';

      const name = root.document.createElement('span');
      name.textContent = theme.name;

      button.replaceChildren(icon, name);
      button.setAttribute('aria-label', `Chọn chủ đề ${theme.name}`);
      button.addEventListener('click', () => {
        if (root.BongThemes.getActiveTheme()?.id === theme.id) return;
        const isGame1 = getRoutes().isGame(1, root.location.pathname);
        if (isGame1) root.dispatchEvent(new CustomEvent('bonghome:pause'));
        root.BongThemes.setActiveTheme(theme.id);
        renderActive();
        if (isGame1) root.setTimeout(() => root.location.reload(), 80);
      });
      options.appendChild(button);
    });

    const anchor = root.document.querySelector('.huong-dan, main, .khung');
    if (anchor?.parentNode && anchor.classList.contains('huong-dan')) anchor.insertAdjacentElement('afterend', picker);
    else if (anchor) anchor.prepend(picker);
    else root.document.body.prepend(picker);

    root.addEventListener('bonghome:themechange', renderActive);
    renderActive();
  }

  function startWhenRoutesReady() {
    Promise.resolve(root.BongRoutesReady)
      .catch((error) => console.warn('[Bông Home] Dùng nhận dạng trang dự phòng cho chủ đề', error))
      .then(start);
  }

  if (typeof module === 'object' && module.exports) module.exports = { isHomePage, isSupportedPage };
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', startWhenRoutesReady, { once: true });
    else startWhenRoutesReady();
  }
})(typeof window !== 'undefined' ? window : globalThis);
