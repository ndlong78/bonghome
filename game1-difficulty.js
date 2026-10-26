(() => {
  'use strict';

  function applyDifficultyContent() {
    const group = document.getElementById('mucDo');
    if (!group) return;

    const content = window.BongGame1Content;
    // Không tải được nội dung JSON thì chỉ có 8 hình dự phòng trong js/game1-ui.js: mức Khó dùng 8 cặp
    // (như nút mặc định trong game1.html), không phải 12 cặp của nội dung đầy đủ.
    const levels = Array.isArray(content?.difficulties) ? content.difficulties : [
      { pairs: 3, label: 'Dễ · 6 lá', ariaLabel: 'Dễ · 6 lá · 3 cặp' },
      { pairs: 6, label: 'Vừa · 12 lá', ariaLabel: 'Vừa · 12 lá · 6 cặp' },
      { pairs: 8, label: 'Khó · 16 lá', ariaLabel: 'Khó · 16 lá · 8 cặp' }
    ];

    const buttons = group.querySelectorAll('button');
    levels.forEach((level, index) => {
      const button = buttons[index];
      if (!button) return;
      button.dataset.cap = String(level.pairs);
      button.textContent = level.label;
      button.setAttribute('aria-label', level.ariaLabel);
    });

    if (content?.difficultyAriaLabel) group.setAttribute('aria-label', content.difficultyAriaLabel);
    const instruction = document.querySelector('.huong-dan');
    if (instruction && content?.instruction) instruction.textContent = content.instruction;
  }

  applyDifficultyContent();
})();
