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
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.setAttribute(marker, 'true');
      script.addEventListener('load', () => resolve(script), { once: true });
      script.addEventListener('error', () => reject(new Error(`Không tải được ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  const isGame1 = /\/game1\.html$/.test(window.location.pathname);

  loadSharedStyle('./css/components.css', 'data-bh-components');
  loadSharedStyle('./css/common.css', 'data-bh-common');
  loadSharedStyle('./css/design-tokens.css', 'data-bh-design-tokens');
  if (isGame1) loadSharedStyle('./css/game1-autosave.css', 'data-bh-game1-autosave-style');
  loadSharedScript('./pwa-ios.js', 'data-bh-pwa-ios').catch(() => {});
  loadSharedScript('./pwa-quality.js', 'data-bh-pwa-quality').catch(() => {});

  window.BongModulesReady = loadSharedScript('./js/storage.js', 'data-bh-storage')
    .then(() => {
      window.BongStorage?.migrate();
      return loadSharedScript('./js/progress.js', 'data-bh-progress');
    })
    .then(() => {
      window.dispatchEvent(new CustomEvent('bonghome:modulesready'));
      return { storage: window.BongStorage, progress: window.BongProgress };
    })
    .catch((error) => {
      console.error('[Bông Home] Shared modules failed to load', error);
      return { storage: null, progress: null, error };
    });

  const STORAGE_KEY = 'bonghome_sound_enabled';
  const getEnabled = () => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'false'; }
    catch (error) { return true; }
  };
  const setEnabled = (enabled) => {
    try { localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false'); }
    catch (error) { /* Giữ thiết lập trong phiên hiện tại nếu storage bị chặn. */ }
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

  function loadGame1Content() {
    if (!isGame1) return Promise.resolve(null);
    return loadSharedScript('./js/game1-content.js', 'data-bh-game1-content')
      .then(() => window.BongGame1ContentLoader.load(window))
      .catch((error) => {
        console.warn('[Bông Home] Dùng nội dung Game 1 dự phòng', error);
        return null;
      });
  }

  function loadGame1Difficulty() {
    if (!isGame1) return Promise.resolve(null);
    const existing = document.querySelector('script[data-game1-difficulty]');
    if (existing?.dataset.loaded === 'true') return Promise.resolve(existing);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(existing), { once: true });
        existing.addEventListener('error', reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './game1-difficulty.js';
      script.dataset.game1Difficulty = 'true';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        updateDifficultyAria(document.getElementById('mucDo')?.parentElement || document);
        resolve(script);
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.body.appendChild(script);
    });
  }

  function loadGame1Autosave() {
    if (!isGame1) return;
    const contentAndDifficulty = loadGame1Content().then(() => loadGame1Difficulty());
    Promise.all([window.BongModulesReady, contentAndDifficulty])
      .then(([modules]) => {
        if (!modules.progress) return null;
        return loadSharedScript('./game1-autosave.js', 'data-bh-game1-autosave');
      })
      .catch((error) => console.error('[Bông Home] Game 1 autosave failed to load', error));
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
    loadGame1Autosave();
    addSoundButton();
    updateDifficultyAria();
    improveDialogs();
  });
})();
