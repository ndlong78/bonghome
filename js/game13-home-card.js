(() => {
  'use strict';

  function updateHomeCopy() {
    const subtitle = document.querySelector('.phu-de');
    if (subtitle && /1[0-2] lớp học/.test(subtitle.textContent || '')) {
      subtitle.textContent = subtitle.textContent.replace(/1[0-2] lớp học/, '13 lớp học');
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      const meta = document.querySelector(selector);
      if (meta && /1[0-2] trò chơi/.test(meta.content)) meta.content = meta.content.replace(/1[0-2] trò chơi/, '13 trò chơi');
    }
  }

  function createCard() {
    const schoolyard = document.getElementById('sanTruong');
    if (!schoolyard || schoolyard.querySelector('[data-game13-card]')) return;

    const card = document.createElement('a');
    card.className = 'bang-hieu';
    card.href = 'game13.html';
    card.dataset.game13Card = 'true';
    card.style.setProperty('--vien', '#8FB8EA');
    card.style.setProperty('--nen', '#EEF6FF');
    card.setAttribute('aria-label', 'Lớp 13: Cờ Ca-rô Tí Hon');
    card.innerHTML = `
      <div class="so">13</div>
      <div class="the">
        <div class="hinh" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect x="6" y="6" width="52" height="52" rx="10" fill="#fff" stroke="#7A4E86" stroke-width="3"/>
            <path d="M23.3 10v44M40.7 10v44M10 23.3h44M10 40.7h44" stroke="#C9B6F5" stroke-width="3" stroke-linecap="round"/>
            <path d="M11 11l8 8M19 11l-8 8M45 45l8 8M53 45l-8 8" stroke="#C23A5C" stroke-width="3" stroke-linecap="round"/>
            <circle cx="32" cy="32" r="5" fill="none" stroke="#4F75AF" stroke-width="3"/>
            <circle cx="49" cy="15" r="5" fill="none" stroke="#4F75AF" stroke-width="3"/>
            <circle cx="15" cy="49" r="5" fill="none" stroke="#4F75AF" stroke-width="3"/>
            <path d="M12 52L52 12" stroke="#F2B53A" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="ten">Cờ Ca-rô Tí Hon</div>
        <span class="ky-nang">Tư duy chiến thuật</span>
      </div>`;
    const previous = schoolyard.querySelector('[data-game12-card]') || schoolyard.querySelector('[data-game11-card]');
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
