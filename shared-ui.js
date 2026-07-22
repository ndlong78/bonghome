(() => {
  'use strict';

  function loadSharedStyle(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, 'true');
    document.head.prepend(link);
  }

  function loadSharedScript(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(marker, 'true');
    document.head.appendChild(script);
  }

  loadSharedStyle('./css/components.css', 'data-bh-components');
  loadSharedStyle('./css/common.css', 'data-bh-common');
  loadSharedStyle('./css/design-tokens.css', 'data-bh-design-tokens');
  loadSharedScript('./pwa-ios.js', 'data-bh-pwa-ios');
  loadSharedScript('./pwa-quality.js', 'data-bh-pwa-quality');

  const STORAGE_KEY = 'bonghome_sound_enabled';
  const getEnabled = () => localStorage.getItem(STORAGE_KEY) !== 'false';
  const setEnabled = (enabled) => {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    document.documentElement.dataset.sound = enabled ? 'on' : 'off';
    window.dispatchEvent(new CustomEvent('bonghome:soundchange', { detail: { enabled } }));
    if (!enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  window.BongSound = {
    isEnabled: getEnabled,
    setEnabled,
    toggle: () => setEnabled(!getEnabled())
  };

  if ('speechSynthesis' in window && typeof window.speechSynthesis.speak === 'function') {
    const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (utterance) => {
      if (getEnabled()) originalSpeak(utterance);
    };
  }

  function updateDifficultyAria(root = document) {
    root.querySelectorAll('.muc-do').forEach((group) => {
      group.setAttribute('role', 'group');
      if (!group.hasAttribute('aria-label')) group.setAttribute('aria-label', 'Chọn mức độ');
      group.querySelectorAll('button').forEach((button) => {
        button.setAttribute('aria-pressed', button.classList.contains('dang-chon') ? 'true' : 'false');
      });
    });
  }

  function loadGame1Difficulty() {
    if (!/\/game1\.html$/.test(window.location.pathname)) return;
    if (document.querySelector('script[data-game1-difficulty]')) return;
    const script = document.createElement('script');
    script.src = './game1-difficulty.js';
    script.dataset.game1Difficulty = 'true';
    script.onload = () => updateDifficultyAria(document.getElementById('mucDo')?.parentElement || document);
    document.body.appendChild(script);
  }

  function addSoundButton() {
    if (document.getElementById('nutAmThanh')) return;

    const button = document.createElement('button');
    button.id = 'nutAmThanh';
    button.className = 'nut-am-thanh';
    button.type = 'button';

    const render = () => {
      const enabled = getEnabled();
      button.textContent = enabled ? '🔊 Âm thanh' : '🔇 Im lặng';
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      button.setAttribute('aria-label', enabled ? 'Tắt âm thanh' : 'Bật âm thanh');
    };

    button.addEventListener('click', () => {
      window.BongSound.toggle();
      render();
    });
    window.addEventListener('bonghome:soundchange', render);
    render();
    document.body.appendChild(button);
  }

  function improveDialogs() {
    document.querySelectorAll('.man-thang').forEach((dialog, index) => {
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const heading = dialog.querySelector('h2');
      if (heading) {
        if (!heading.id) heading.id = `tieuDeThang${index || ''}`;
        dialog.setAttribute('aria-labelledby', heading.id);
      }
      const description = dialog.querySelector('.loi');
      if (description) {
        if (!description.id) description.id = `loiKhen${index || ''}`;
        dialog.setAttribute('aria-describedby', description.id);
      }
    });
  }

  function updateOfflineBadge(message) {
    const badge = document.getElementById('huyHieu');
    if (!badge) return;
    if (message.type === 'CACHE_READY') {
      badge.textContent = '✅ Đã sẵn sàng — chơi được cả khi không có mạng';
      badge.className = 'huy-hieu hien';
    }
    if (message.type === 'CACHE_FAILED') {
      badge.textContent = `⚠️ Chưa tải đủ ${message.failed?.length || 1} tệp — hãy mở lại khi có mạng`;
      badge.className = 'huy-hieu hien dang-tai';
    }
  }

  navigator.serviceWorker?.addEventListener('message', (event) => updateOfflineBadge(event.data || {}));

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.muc-do button');
    if (!button) return;
    queueMicrotask(() => updateDifficultyAria(button.closest('.muc-do')));
  });

  document.addEventListener('DOMContentLoaded', () => {
    setEnabled(getEnabled());
    loadGame1Difficulty();
    addSoundButton();
    updateDifficultyAria();
    improveDialogs();
  });
})();
