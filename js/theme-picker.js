(function (root) {
  'use strict';

  function isSupportedPage(pathname) {
    const path = typeof pathname === 'string' ? pathname : '';
    return path.endsWith('/') || /\/index\.html$/.test(path) || /\/game1\.html$/.test(path);
  }

  function start() {
    if (root.__bongThemePickerStarted || !root.BongThemes) return;
    if (!isSupportedPage(root.location.pathname)) return;
    root.__bongThemePickerStarted = true;

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
      button.innerHTML = `<span aria-hidden="true">${theme.icon || '🎨'}</span><span>${theme.name}</span>`;
      button.setAttribute('aria-label', `Chọn chủ đề ${theme.name}`);
      button.addEventListener('click', () => {
        if (root.BongThemes.getActiveTheme()?.id === theme.id) return;
        const isGame1 = /\/game1\.html$/.test(root.location.pathname);
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

  if (typeof module === 'object' && module.exports) module.exports = { isSupportedPage };
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);