(() => {
  'use strict';

  function updateHomeCopy() {
    const subtitle = document.querySelector('.phu-de');
    if (subtitle && /1[0-3] lớp học/.test(subtitle.textContent || '')) {
      subtitle.textContent = subtitle.textContent.replace(/1[0-3] lớp học/, '14 lớp học');
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      const meta = document.querySelector(selector);
      if (meta && /1[0-3] trò chơi/.test(meta.content)) meta.content = meta.content.replace(/1[0-3] trò chơi/, '14 trò chơi');
    }
  }

  function createCard() {
    const schoolyard = document.getElementById('sanTruong');
    if (!schoolyard || schoolyard.querySelector('[data-game14-card]')) return;

    const card = document.createElement('a');
    card.className = 'bang-hieu';
    card.href = 'game14.html';
    card.dataset.game14Card = 'true';
    card.style.setProperty('--vien', '#E98FB0');
    card.style.setProperty('--nen', '#FFF0F5');
    card.innerHTML = `
      <div class="so"><span class="bh-visually-hidden">Lớp </span>14</div>
      <div class="the">
        <div class="hinh" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect x="6" y="6" width="52" height="52" rx="8" fill="#fff" stroke="#7A4E86" stroke-width="3"/>
            <path d="M16.4 8v48M26.8 8v48M37.2 8v48M47.6 8v48M8 16.4h48M8 26.8h48M8 37.2h48M8 47.6h48" stroke="#B9D3F2" stroke-width="1.6"/>
            <rect x="9" y="40" width="46" height="6" rx="3" fill="#FFE9A8"/>
            <path d="M10.5 40.5l4 4M14.5 40.5l-4 4M20.9 40.5l4 4M24.9 40.5l-4 4M31.3 40.5l4 4M35.3 40.5l-4 4M41.7 40.5l4 4M45.7 40.5l-4 4M52.1 40.5l-2 2" stroke="#C23A5C" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="22" cy="22" r="3" fill="none" stroke="#4F75AF" stroke-width="2.4"/>
            <circle cx="32" cy="32" r="3" fill="none" stroke="#4F75AF" stroke-width="2.4"/>
            <circle cx="42.4" cy="21.6" r="3" fill="none" stroke="#4F75AF" stroke-width="2.4"/>
          </svg>
        </div>
        <div class="ten">Cờ Caro Nối Năm</div>
        <span class="ky-nang">Tư duy chiến lược</span>
      </div>`;
    const previous = schoolyard.querySelector('[data-game13-card]')
      || schoolyard.querySelector('[data-game12-card]')
      || schoolyard.querySelector('[data-game11-card]');
    if (previous) previous.after(card);
    else schoolyard.appendChild(card);
  }

  function init() {
    updateHomeCopy();
    createCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
