(() => {
  'use strict';

  function updateHomeCopy() {
    const subtitle = document.querySelector('.phu-de');
    if (subtitle && /10 lớp học/.test(subtitle.textContent || '')) {
      subtitle.textContent = subtitle.textContent.replace('10 lớp học', '11 lớp học');
    }
    const description = document.querySelector('meta[name="description"]');
    if (description && /10 trò chơi/.test(description.content)) {
      description.content = description.content.replace('10 trò chơi', '11 trò chơi');
    }
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && /10 trò chơi/.test(ogDescription.content)) {
      ogDescription.content = ogDescription.content.replace('10 trò chơi', '11 trò chơi');
    }
  }

  function createCard() {
    const schoolyard = document.getElementById('sanTruong');
    if (!schoolyard || schoolyard.querySelector('[data-game11-card]')) return;

    const card = document.createElement('a');
    card.className = 'bang-hieu';
    card.href = 'game11.html';
    card.dataset.game11Card = 'true';
    card.style.setProperty('--vien', '#6FA8FF');
    card.style.setProperty('--nen', '#EDF5FF');
    card.setAttribute('aria-label', 'Lớp 11: Xếp Khối Thông Minh');
    card.innerHTML = `
      <div class="so">11</div>
      <div class="the">
        <div class="hinh" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <rect x="7" y="8" width="14" height="14" rx="3" fill="#6FA8FF"/>
            <rect x="23" y="8" width="14" height="14" rx="3" fill="#6FA8FF"/>
            <rect x="7" y="24" width="14" height="14" rx="3" fill="#6FA8FF"/>
            <rect x="23" y="24" width="14" height="14" rx="3" fill="#6FA8FF"/>
            <rect x="43" y="22" width="14" height="14" rx="3" fill="#A889F4"/>
            <rect x="43" y="38" width="14" height="14" rx="3" fill="#A889F4"/>
            <rect x="27" y="38" width="14" height="14" rx="3" fill="#A889F4"/>
          </svg>
        </div>
        <div class="ten">Xếp Khối Thông Minh</div>
        <span class="ky-nang">Tư duy không gian</span>
      </div>`;
    schoolyard.appendChild(card);
  }

  function init() {
    updateHomeCopy();
    createCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
