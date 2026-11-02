(() => {
  'use strict';

  function updateHomeCopy() {
    const subtitle = document.querySelector('.phu-de');
    if (subtitle && /1[0-4] lớp học/.test(subtitle.textContent || '')) {
      subtitle.textContent = subtitle.textContent.replace(/1[0-4] lớp học/, '15 lớp học');
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      const meta = document.querySelector(selector);
      if (meta && /1[0-4] trò chơi/.test(meta.content)) meta.content = meta.content.replace(/1[0-4] trò chơi/, '15 trò chơi');
    }
  }

  function createCard() {
    const schoolyard = document.getElementById('sanTruong');
    if (!schoolyard || schoolyard.querySelector('[data-game15-card]')) return;

    const card = document.createElement('a');
    card.className = 'bang-hieu';
    card.href = 'game15.html';
    card.dataset.game15Card = 'true';
    card.style.setProperty('--vien', '#F2B53A');
    card.style.setProperty('--nen', '#FFF8E1');
    card.innerHTML = `
      <div class="so"><span class="bh-visually-hidden">Lớp </span>15</div>
      <div class="the">
        <div class="hinh" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect x="4" y="4" width="56" height="56" rx="12" fill="#CFEBFF"/>
            <path d="M4 46h18v14H4zM30 46h30v14H30z" fill="#C98B5A"/>
            <path d="M4 46h18v4H4zM30 46h30v4H30z" fill="#6CC56C"/>
            <rect x="38" y="30" width="10" height="5" rx="2" fill="#D9A066"/>
            <path d="M44 16l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#FFD84D" stroke="#E0A100"/>
            <circle cx="20" cy="22" r="5" fill="#FFE0C7"/>
            <circle cx="16" cy="18" r="2.4" fill="#5A3B2E"/><circle cx="24" cy="18" r="2.4" fill="#5A3B2E"/>
            <path d="M16 27h8l4 10H12z" fill="#FF8FB1"/>
            <path d="M14 39l-3 4M26 39l4 3" stroke="#6B4E71" stroke-width="3" stroke-linecap="round"/>
            <path d="M28 30q6-10 12-4" fill="none" stroke="#7A4E86" stroke-width="2" stroke-dasharray="3 3"/>
          </svg>
        </div>
        <div class="ten">Bông Phiêu Lưu</div>
        <span class="ky-nang">Phối hợp vận động</span>
      </div>`;
    const previous = schoolyard.querySelector('[data-game14-card]')
      || schoolyard.querySelector('[data-game13-card]')
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
