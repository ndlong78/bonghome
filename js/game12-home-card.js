(() => {
  'use strict';

  function updateHomeCopy() {
    const subtitle = document.querySelector('.phu-de');
    if (subtitle && /1[01] lớp học/.test(subtitle.textContent || '')) {
      subtitle.textContent = subtitle.textContent.replace(/1[01] lớp học/, '12 lớp học');
    }
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      const meta = document.querySelector(selector);
      if (meta && /1[01] trò chơi/.test(meta.content)) meta.content = meta.content.replace(/1[01] trò chơi/, '12 trò chơi');
    }
  }

  function createCard() {
    const schoolyard = document.getElementById('sanTruong');
    if (!schoolyard || schoolyard.querySelector('[data-game12-card]')) return;

    const card = document.createElement('a');
    card.className = 'bang-hieu';
    card.href = 'game12.html';
    card.dataset.game12Card = 'true';
    card.style.setProperty('--vien', '#67CFA6');
    card.style.setProperty('--nen', '#EAFBF3');
    card.setAttribute('aria-label', 'Lớp 12: Sudoku Vui Vẻ');
    card.innerHTML = `
      <div class="so">12</div>
      <div class="the">
        <div class="hinh" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect x="6" y="6" width="52" height="52" rx="8" fill="#fff" stroke="#7A4E86" stroke-width="4"/>
            <path d="M32 6v52M6 32h52" stroke="#7A4E86" stroke-width="3"/>
            <path d="M19 6v52M45 6v52M6 19h52M6 45h52" stroke="#C9B6F5" stroke-width="1.5"/>
            <text x="12.5" y="16" font-size="9" font-weight="700" text-anchor="middle" fill="#4F75AF">1</text>
            <text x="38.5" y="29" font-size="9" font-weight="700" text-anchor="middle" fill="#4F75AF">2</text>
            <text x="25.5" y="42" font-size="9" font-weight="700" text-anchor="middle" fill="#C23A5C">3</text>
            <text x="51.5" y="55" font-size="9" font-weight="700" text-anchor="middle" fill="#2F6F55">4</text>
          </svg>
        </div>
        <div class="ten">Sudoku Vui Vẻ</div>
        <span class="ky-nang">Suy luận logic</span>
      </div>`;
    const game11Card = schoolyard.querySelector('[data-game11-card]');
    if (game11Card) game11Card.after(card);
    else schoolyard.appendChild(card);
  }

  function init() {
    updateHomeCopy();
    createCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
