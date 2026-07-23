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
  const isGames2To4 = /\/game[234]\.html$/.test(window.location.pathname);
  const isGames5To7 = /\/game[567]\.html$/.test(window.location.pathname);
  const isGames8To10 = /\/game(?:8|9|10)\.html$/.test(window.location.pathname);
  const isHome = /(?:^|\/)index\.html$/.test(window.location.pathname) || /\/$/.test(window.location.pathname);

  loadSharedStyle('./css/components.css', 'data-bh-components');
  loadSharedStyle('./css/common.css', 'data-bh-common');
  loadSharedStyle('./css/themes.css', 'data-bh-themes');
  loadSharedStyle('./css/theme-picker.css', 'data-bh-theme-picker');
  loadSharedStyle('./css/design-tokens.css', 'data-bh-design-tokens');
  if (isGame1) loadSharedStyle('./css/game1-autosave.css', 'data-bh-game1-autosave-style');
  if (isGames2To4 || isGames5To7 || isGames8To10) loadSharedStyle('./css/games-autosave.css', 'data-bh-games-autosave-style');
  if (isHome) loadSharedStyle('./css/profile.css', 'data-bh-profile-style');
  loadSharedScript('./pwa-ios.js', 'data-bh-pwa-ios').catch(() => {});
  loadSharedScript('./pwa-quality.js', 'data-bh-pwa-quality').catch(() => {});

  window.BongModulesReady = loadSharedScript('./js/storage.js', 'data-bh-storage')
    .then(() => {
      window.BongStorage?.migrate();
      return loadSharedScript('./js/themes.js', 'data-bh-themes-script');
    })
    .then(() => window.BongThemes.init())
    .catch((error) => {
      console.warn('[Bông Home] Dùng chủ đề mặc định dự phòng', error);
      return null;
    })
    .then(() => loadSharedScript('./js/progress.js', 'data-bh-progress'))
    .then(() => loadSharedScript('./js/rewards.js', 'data-bh-rewards'))
    .then(() => loadSharedScript('./js/profile.js', 'data-bh-profile'))
    .then(() => {
      window.BongRewards?.migrate();
      window.BongProfile?.migrate();
      window.dispatchEvent(new CustomEvent('bonghome:modulesready'));
      return {
        storage: window.BongStorage,
        themes: window.BongThemes,
        progress: window.BongProgress,
        rewards: window.BongRewards,
        profile: window.BongProfile
      };
    })
    .catch((error) => {
      console.error('[Bông Home] Shared modules failed to load', error);
      return { storage: null, themes: null, progress: null, rewards: null, profile: null, error };
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

  function loadGame1Content(themeId) {
    if (!isGame1) return Promise.resolve(null);
    return loadSharedScript('./js/game1-content.js', 'data-bh-game1-content')
      .then(() => window.BongGame1ContentLoader.load(window, undefined, themeId))
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
    window.BongModulesReady
      .then((modules) => {
        if (!modules.progress || !modules.themes || !modules.rewards) return null;
        const themeId = modules.themes.getActiveTheme()?.id || 'bong-home';
        return loadGame1Content(themeId)
          .then(() => loadGame1Difficulty())
          .then(() => loadSharedScript('./js/game1-theme-progress.js', 'data-bh-game1-theme-progress'))
          .then(() => {
            if (window.BongGame1Progress) window.BongProgress = window.BongGame1Progress;
            return loadSharedScript('./js/game1-rewards.js', 'data-bh-game1-rewards');
          })
          .then(() => loadSharedScript('./game1-autosave.js', 'data-bh-game1-autosave'));
      })
      .catch((error) => console.error('[Bông Home] Game 1 autosave failed to load', error));
  }

  function loadGames2To4Autosave() {
    if (!isGames2To4) return;
    window.BongModulesReady
      .then((modules) => {
        if (!modules.progress || !modules.rewards) return null;
        return loadSharedScript('./js/games2-4-rewards.js', 'data-bh-games2-4-rewards')
          .then(() => loadSharedScript('./js/games2-4-autosave.js', 'data-bh-games2-4-autosave'));
      })
      .catch((error) => console.error('[Bông Home] Autosave Game 2-4 failed to load', error));
  }

  function loadGames5To7Autosave() {
    if (!isGames5To7) return;
    window.BongModulesReady
      .then((modules) => {
        if (!modules.progress || !modules.rewards) return null;
        return loadSharedScript('./js/games5-7-rewards.js', 'data-bh-games5-7-rewards')
          .then(() => loadSharedScript('./js/games5-7-autosave.js', 'data-bh-games5-7-autosave'));
      })
      .catch((error) => console.error('[Bông Home] Autosave Game 5-7 failed to load', error));
  }

  function loadGames8To10Autosave() {
    if (!isGames8To10) return;
    window.BongModulesReady
      .then((modules) => {
        if (!modules.progress) return null;
        return loadSharedScript('./js/games8-10-autosave.js', 'data-bh-games8-10-autosave');
      })
      .catch((error) => console.error('[Bông Home] Autosave Game 8-10 failed to load', error));
  }

  function loadThemePicker() {
    window.BongModulesReady
      .then((modules) => {
        if (!modules.themes) return null;
        return loadSharedScript('./js/theme-picker.js', 'data-bh-theme-picker-script');
      })
      .catch((error) => console.warn('[Bông Home] Không tải được bộ chọn chủ đề', error));
  }

  function loadProfileUI() {
    if (!isHome) return;
    window.BongModulesReady
      .then((modules) => {
        if (!modules.profile) return null;
        return loadSharedScript('./js/profile-ui.js', 'data-bh-profile-ui');
      })
      .then(() => window.BongProfileUI?.init())
      .catch((error) => console.warn('[Bông Home] Không tải được giao diện hồ sơ', error));
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
    loadGames2To4Autosave();
    loadGames5To7Autosave();
    loadGames8To10Autosave();
    loadThemePicker();
    loadProfileUI();
    addSoundButton();
    updateDifficultyAria();
    improveDialogs();
  });
})();
