(() => {
  'use strict';

  const HINH_BO_SUNG = [
    `<svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="22" fill="#BFE3FF" stroke="#6EAAD3" stroke-width="3"/>
      <path d="M20 34c4 8 20 8 24 0" fill="none" stroke="#6B4E71" stroke-width="3" stroke-linecap="round"/>
      <circle cx="24" cy="27" r="3" fill="#6B4E71"/><circle cx="40" cy="27" r="3" fill="#6B4E71"/>
    </svg>`,
    `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 48h28l-3-24H21z" fill="#FFE0A3" stroke="#D6A94D" stroke-width="3" stroke-linejoin="round"/>
      <path d="M24 25c0-10 16-10 16 0" fill="none" stroke="#E9799C" stroke-width="4" stroke-linecap="round"/>
      <circle cx="26" cy="37" r="3" fill="#FFB7C5"/><circle cx="38" cy="37" r="3" fill="#C9B6F5"/>
    </svg>`,
    `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 42c0-10 8-18 18-18s18 8 18 18" fill="#A8E6CF" stroke="#58B792" stroke-width="3"/>
      <path d="M22 24l3-10 7 8 7-8 3 10" fill="#FFB7C5" stroke="#E9799C" stroke-width="3" stroke-linejoin="round"/>
      <rect x="13" y="41" width="38" height="10" rx="5" fill="#C9B6F5" stroke="#9B85D6" stroke-width="3"/>
    </svg>`,
    `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 8c8 10 17 16 17 27a17 17 0 1 1-34 0C15 24 24 18 32 8z" fill="#BFE3FF" stroke="#5B9FCB" stroke-width="3"/>
      <path d="M24 38c4 5 12 5 16 0" fill="none" stroke="#6B4E71" stroke-width="3" stroke-linecap="round"/>
      <circle cx="25" cy="31" r="2.5" fill="#6B4E71"/><circle cx="39" cy="31" r="2.5" fill="#6B4E71"/>
    </svg>`
  ];

  function applyTwelvePairLevel() {
    const group = document.getElementById('mucDo');
    if (!group || typeof KHO_HINH === 'undefined' || !Array.isArray(KHO_HINH)) return;

    if (KHO_HINH.length < 12) {
      KHO_HINH.push(...HINH_BO_SUNG.slice(0, 12 - KHO_HINH.length));
    }

    const buttons = group.querySelectorAll('button');
    if (buttons.length < 3) return;

    buttons[2].dataset.cap = '12';
    buttons[2].textContent = 'Khó · 24 lá';
    buttons[2].setAttribute('aria-label', 'Khó · 24 lá · 12 cặp');

    const instruction = document.querySelector('.huong-dan');
    if (instruction) {
      instruction.textContent = 'Bé lật 2 lá bài để tìm hai hình giống hệt nhau. Mức Khó có 12 cặp nhé!';
    }
  }

  applyTwelvePairLevel();
})();
