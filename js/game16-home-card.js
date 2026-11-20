(() => {
  'use strict';

  function updateHomeCopy() {
    const subtitle = document.querySelector('.phu-de');
    if (subtitle && /1[0-5] lớp học/.test(subtitle.textContent || '')) {
      subtitle.textContent = subtitle.textContent.replace(/1[0-5] lớp học/, '16 lớp học');
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      const meta = document.querySelector(selector);
      if (meta && /1[0-5] trò chơi/.test(meta.content)) meta.content = meta.content.replace(/1[0-5] trò chơi/, '16 trò chơi');
    }
  }

  function createCard() {
    const schoolyard = document.getElementById('sanTruong');
    if (!schoolyard || schoolyard.querySelector('[data-game16-card]')) return;

    const card = document.createElement('a');
    card.className = 'bang-hieu';
    card.href = 'game16.html';
    card.dataset.game16Card = 'true';
    card.style.setProperty('--vien', '#7FC46A');
    card.style.setProperty('--nen', '#F1FBEA');
    card.innerHTML = `
      <div class="so"><span class="bh-visually-hidden">Lớp </span>16</div>
      <div class="the">
        <div class="hinh" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect x="6" y="6" width="52" height="52" rx="9" fill="#8FC77A"/>
            <rect x="10" y="10" width="13" height="13" rx="3" fill="#FDF3DF"/>
            <rect x="25.5" y="10" width="13" height="13" rx="3" fill="#FDF3DF"/>
            <rect x="41" y="10" width="13" height="13" rx="3" fill="#B8E6A0"/>
            <rect x="10" y="25.5" width="13" height="13" rx="3" fill="#FDF3DF"/>
            <rect x="25.5" y="25.5" width="13" height="13" rx="3" fill="#FDF3DF"/>
            <rect x="41" y="25.5" width="13" height="13" rx="3" fill="#FFE3EC"/>
            <rect x="10" y="41" width="13" height="13" rx="3" fill="#B8E6A0"/>
            <rect x="25.5" y="41" width="13" height="13" rx="3" fill="#B8E6A0"/>
            <rect x="41" y="41" width="13" height="13" rx="3" fill="#B8E6A0"/>
            <text x="32" y="21" font-size="10" font-weight="900" fill="#2F6FB3" text-anchor="middle">1</text>
            <text x="32" y="36.5" font-size="10" font-weight="900" fill="#2E7D4F" text-anchor="middle">2</text>
            <text x="16.5" y="36.5" font-size="10" font-weight="900" fill="#2F6FB3" text-anchor="middle">1</text>
            <path d="M45 37v-9l6 2.5-6 2.5" fill="#E8728F" stroke="#A3285A" stroke-width="1.2" stroke-linejoin="round"/>
            <ellipse cx="47.5" cy="47.5" rx="4.5" ry="3.5" fill="#FFCF3F"/>
            <path d="M46 44.3v6.4M49 44.3v6.4" stroke="#4A3A2A" stroke-width="1.4"/>
          </svg>
        </div>
        <div class="ten">Dò Ong Trong Vườn</div>
        <span class="ky-nang">Suy luận logic</span>
      </div>`;
    const previous = schoolyard.querySelector('[data-game15-card]')
      || schoolyard.querySelector('[data-game14-card]')
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
