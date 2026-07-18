(() => {
  'use strict';

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

  // Prevent speech output when sound is disabled (used by the listening game).
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

  function addSoundButton() {
    if (document.getElementById('nutAmThanh')) return;

    const style = document.createElement('style');
    style.textContent = `
      .nut-am-thanh{
        position:fixed; right:max(12px, env(safe-area-inset-right)); bottom:max(12px, env(safe-area-inset-bottom));
        z-index:120; border:3px solid #C9B6F5; border-radius:999px; background:#fff; color:#6B4E71;
        padding:10px 14px; font:800 14px/1.2 "Segoe UI","Nunito",Arial,sans-serif;
        box-shadow:0 5px 0 rgba(0,0,0,.08),0 10px 22px rgba(120,80,140,.18); cursor:pointer;
      }
      .nut-am-thanh:focus-visible{outline:5px solid #7A4E86;outline-offset:4px}
      .nut-am-thanh:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.08)}
    `;
    document.head.appendChild(style);

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
    addSoundButton();
    updateDifficultyAria();
    improveDialogs();
  });
})();
